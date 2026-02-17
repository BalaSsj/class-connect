import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, department_id } = await req.json();

    if (action === "workload-analysis") {
      // Fetch faculty and their timetable slots
      let facultyQuery = supabase.from("faculty").select("id, full_name, designation, max_periods_per_day, is_active, department_id, departments(name)").eq("is_active", true);
      if (department_id) facultyQuery = facultyQuery.eq("department_id", department_id);
      const { data: facultyList } = await facultyQuery;

      const { data: slots } = await supabase.from("timetable_slots").select("faculty_id, day_of_week, period_number, is_lab, subjects(name, code)");
      const { data: leaves } = await supabase.from("leave_requests").select("faculty_id, start_date, end_date, status").eq("status", "approved");
      const { data: reallocations } = await supabase.from("reallocations").select("substitute_faculty_id, reallocation_date, status").in("status", ["approved", "suggested"]);

      // Build workload map
      const workloadMap: Record<string, { slots: number; labSlots: number; days: Set<number>; subjects: Set<string>; leavesDays: number; substitutions: number }> = {};
      
      facultyList?.forEach((f: any) => {
        workloadMap[f.id] = { slots: 0, labSlots: 0, days: new Set(), subjects: new Set(), leavesDays: 0, substitutions: 0 };
      });

      slots?.forEach((s: any) => {
        if (workloadMap[s.faculty_id]) {
          workloadMap[s.faculty_id].slots++;
          if (s.is_lab) workloadMap[s.faculty_id].labSlots++;
          workloadMap[s.faculty_id].days.add(s.day_of_week);
          if (s.subjects) workloadMap[s.faculty_id].subjects.add(s.subjects.name);
        }
      });

      leaves?.forEach((l: any) => {
        if (workloadMap[l.faculty_id]) {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          workloadMap[l.faculty_id].leavesDays += diff;
        }
      });

      reallocations?.forEach((r: any) => {
        if (workloadMap[r.substitute_faculty_id]) {
          workloadMap[r.substitute_faculty_id].substitutions++;
        }
      });

      // Build analysis data
      const analysis = facultyList?.map((f: any) => {
        const w = workloadMap[f.id];
        const utilization = f.max_periods_per_day > 0 ? Math.round((w.slots / (f.max_periods_per_day * w.days.size || 1)) * 100) : 0;
        return {
          id: f.id,
          name: f.full_name,
          department: (f.departments as any)?.name,
          designation: f.designation,
          totalPeriods: w.slots,
          labPeriods: w.labSlots,
          teachingDays: w.days.size,
          subjects: Array.from(w.subjects),
          maxPerDay: f.max_periods_per_day,
          utilization: Math.min(utilization, 100),
          leavesDays: w.leavesDays,
          substitutions: w.substitutions,
          status: utilization > 90 ? "overloaded" : utilization > 70 ? "optimal" : utilization > 40 ? "moderate" : "underutilized",
        };
      }) || [];

      // Call AI for insights
      const prompt = `You are an academic workload analyst. Analyze this faculty workload data and provide:
1. A brief overall summary (2-3 sentences)
2. Top 3 specific actionable recommendations
3. Any workload imbalances or concerns

Faculty Data:
${JSON.stringify(analysis.map(a => ({
  name: a.name, dept: a.department, periods: a.totalPeriods, labs: a.labPeriods,
  days: a.teachingDays, utilization: a.utilization + "%", status: a.status,
  leaves: a.leavesDays, substitutions: a.substitutions, subjects: a.subjects.length
})), null, 2)}

Respond in JSON format: { "summary": "...", "recommendations": ["...", "...", "..."], "concerns": ["...", "..."], "overallHealth": "good|moderate|poor" }`;

      const aiResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      let aiInsights = { summary: "AI analysis unavailable", recommendations: [], concerns: [], overallHealth: "moderate" };
      
      if (aiResponse.ok) {
        try {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) aiInsights = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("AI parse error:", e);
        }
      }

      return new Response(JSON.stringify({ analysis, insights: aiInsights }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "smart-substitute") {
      // AI-powered substitution recommendations
      const { faculty_id, date, slot_id } = await req.json();

      // Get original faculty details
      const { data: originalFaculty } = await supabase.from("faculty").select("*, departments(name)").eq("id", faculty_id).single();
      
      // Get the slot details
      const { data: slot } = await supabase.from("timetable_slots").select("*, subjects(name, code, is_lab)").eq("id", slot_id).single();

      // Get all available faculty in same department
      const { data: availableFaculty } = await supabase.from("faculty")
        .select("id, full_name, designation, max_periods_per_day, lab_qualified, expertise")
        .eq("department_id", originalFaculty?.department_id)
        .eq("is_active", true)
        .neq("id", faculty_id);

      // Check who's busy on that day/period
      const dayOfWeek = new Date(date).getDay();
      const { data: busySlots } = await supabase.from("timetable_slots")
        .select("faculty_id")
        .eq("day_of_week", dayOfWeek === 0 ? 7 : dayOfWeek)
        .eq("period_number", slot?.period_number);

      const busyIds = new Set(busySlots?.map((s: any) => s.faculty_id) || []);

      // Check existing reallocations for that date
      const { data: existingReallocs } = await supabase.from("reallocations")
        .select("substitute_faculty_id")
        .eq("reallocation_date", date);

      const reallocCounts: Record<string, number> = {};
      existingReallocs?.forEach((r: any) => {
        reallocCounts[r.substitute_faculty_id] = (reallocCounts[r.substitute_faculty_id] || 0) + 1;
      });

      const candidates = availableFaculty?.filter((f: any) => !busyIds.has(f.id)).map((f: any) => ({
        ...f,
        existingSubstitutions: reallocCounts[f.id] || 0,
        available: true,
      })) || [];

      return new Response(JSON.stringify({
        original: originalFaculty,
        slot,
        candidates,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Analytics error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
