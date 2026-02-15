import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { leave_request_id, faculty_id, start_date, end_date } = await req.json();

  // Get the absent faculty's timetable slots
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("*, subjects(id, name, code, is_lab, department_id)")
    .eq("faculty_id", faculty_id);

  if (!slots || slots.length === 0) {
    return new Response(JSON.stringify({ count: 0, message: "No slots to reallocate" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get all active faculty
  const { data: allFaculty } = await supabase
    .from("faculty")
    .select("*, faculty_subjects(subject_id)")
    .eq("is_active", true)
    .neq("id", faculty_id);

  // Get all existing timetable slots for conflict checking
  const { data: allSlots } = await supabase.from("timetable_slots").select("*");

  // Get existing reallocations for workload balancing
  const { data: existingReallocations } = await supabase
    .from("reallocations")
    .select("substitute_faculty_id")
    .gte("reallocation_date", start_date)
    .lte("reallocation_date", end_date);

  const reallocationCounts: Record<string, number> = {};
  existingReallocations?.forEach((r) => {
    reallocationCounts[r.substitute_faculty_id] = (reallocationCounts[r.substitute_faculty_id] || 0) + 1;
  });

  // Generate dates between start and end
  const dates: string[] = [];
  const startD = new Date(start_date);
  const endD = new Date(end_date);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0=Sun
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }

  const reallocations: any[] = [];

  for (const date of dates) {
    const dayOfWeek = new Date(date).getDay(); // 1=Mon...6=Sat
    const daySlots = slots.filter((s) => s.day_of_week === dayOfWeek);

    for (const slot of daySlots) {
      // Score each candidate
      const candidates = (allFaculty || []).map((f) => {
        let score = 0;

        // 1. Subject expertise (+40)
        const hasSubject = f.faculty_subjects?.some((fs: any) => fs.subject_id === slot.subject_id);
        if (hasSubject) score += 40;

        // 2. Same department (+15)
        if (f.department_id === slot.subjects?.department_id) score += 15;

        // 3. Lab qualification (+20 if lab)
        if (slot.is_lab || slot.subjects?.is_lab) {
          if (f.lab_qualified) score += 20;
          else score -= 50; // Disqualify non-lab-qualified
        }

        // 4. Free period (+30 if no conflict)
        const hasConflict = allSlots?.some(
          (s) => s.faculty_id === f.id && s.day_of_week === dayOfWeek && s.period_number === slot.period_number
        );
        if (hasConflict) {
          score -= 100; // Can't be assigned
        } else {
          score += 30;
        }

        // 5. Workload fairness (-5 per existing reallocation)
        const existing = reallocationCounts[f.id] || 0;
        score -= existing * 5;

        // 6. Max periods check
        const periodsOnDay = (allSlots || []).filter(
          (s) => s.faculty_id === f.id && s.day_of_week === dayOfWeek
        ).length;
        if (periodsOnDay >= f.max_periods_per_day) score -= 100;

        return { faculty: f, score };
      });

      // Sort by score and pick the best
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates.find((c) => c.score > 0);

      if (best) {
        reallocations.push({
          leave_request_id,
          timetable_slot_id: slot.id,
          original_faculty_id: faculty_id,
          substitute_faculty_id: best.faculty.id,
          reallocation_date: date,
          score: best.score,
          status: "suggested",
          notes: `AI Score: ${best.score}. Subject match: ${best.faculty.faculty_subjects?.some((fs: any) => fs.subject_id === slot.subject_id) ? "Yes" : "No"}`,
        });
        reallocationCounts[best.faculty.id] = (reallocationCounts[best.faculty.id] || 0) + 1;
      }
    }
  }

  // Insert all reallocations
  if (reallocations.length > 0) {
    const { error } = await supabase.from("reallocations").insert(reallocations);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({ count: reallocations.length, message: `Generated ${reallocations.length} reallocation suggestions` }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
