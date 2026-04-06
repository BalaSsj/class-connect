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

  const body = await req.json();
  const { leave_request_id, faculty_id, start_date, end_date, reject_reallocation_id } = body;

  // If rejecting a reallocation, find next best substitute
  if (reject_reallocation_id) {
    const { data: rejected } = await supabase
      .from("reallocations")
      .select("*, timetable_slots(*, subjects(id, name, code, is_lab, department_id))")
      .eq("id", reject_reallocation_id)
      .single();

    if (!rejected) {
      return new Response(JSON.stringify({ error: "Reallocation not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as rejected
    await supabase.from("reallocations").update({ status: "rejected" }).eq("id", reject_reallocation_id);

    // Find all previously rejected/current substitutes for this slot+date to exclude
    const { data: existingForSlot } = await supabase
      .from("reallocations")
      .select("substitute_faculty_id")
      .eq("timetable_slot_id", rejected.timetable_slot_id)
      .eq("reallocation_date", rejected.reallocation_date);

    const excludeIds = new Set((existingForSlot || []).map((r: any) => r.substitute_faculty_id));
    excludeIds.add(rejected.original_faculty_id);

    // Find next best faculty
    const slot = rejected.timetable_slots;
    const dayOfWeek = new Date(rejected.reallocation_date).getDay();

    const { data: allFaculty } = await supabase
      .from("faculty")
      .select("*, faculty_subjects(subject_id)")
      .eq("is_active", true);

    const { data: allSlots } = await supabase.from("timetable_slots").select("*");

    const candidates = (allFaculty || [])
      .filter((f: any) => !excludeIds.has(f.id))
      .map((f: any) => {
        let score = 0;
        const hasSubject = f.faculty_subjects?.some((fs: any) => fs.subject_id === slot?.subject_id);
        if (hasSubject) score += 40;
        if (f.department_id === slot?.subjects?.department_id) score += 15;
        if (slot?.is_lab || slot?.subjects?.is_lab) {
          if (f.lab_qualified) score += 20; else score -= 50;
        }
        // Expertise keyword match
        if (f.expertise && slot?.subjects?.name) {
          const subName = slot.subjects.name.toLowerCase();
          for (const exp of f.expertise) {
            if (subName.includes(exp.toLowerCase())) { score += 25; break; }
          }
        }
        const hasConflict = allSlots?.some(
          (s: any) => s.faculty_id === f.id && s.day_of_week === dayOfWeek && s.period_number === slot?.period_number
        );
        if (hasConflict) score -= 100; else score += 30;
        const periodsOnDay = (allSlots || []).filter(
          (s: any) => s.faculty_id === f.id && s.day_of_week === dayOfWeek
        ).length;
        if (periodsOnDay >= f.max_periods_per_day) score -= 100;
        return { faculty: f, score };
      })
      .sort((a: any, b: any) => b.score - a.score);

    const best = candidates.find((c: any) => c.score > 0);
    if (best) {
      const { error } = await supabase.from("reallocations").insert({
        leave_request_id: rejected.leave_request_id,
        timetable_slot_id: rejected.timetable_slot_id,
        original_faculty_id: rejected.original_faculty_id,
        substitute_faculty_id: best.faculty.id,
        reallocation_date: rejected.reallocation_date,
        score: best.score,
        status: "approved",
        notes: `Auto-reassigned after rejection. AI Score: ${best.score}`,
      });

      // Notify the new substitute
      const { data: subFac } = await supabase.from("faculty").select("user_id").eq("id", best.faculty.id).single();
      if (subFac?.user_id) {
        await supabase.from("notifications").insert({
          user_id: subFac.user_id,
          title: "🔄 New Substitution Assignment",
          message: `You've been assigned to cover ${slot?.subjects?.name} (${slot?.subjects?.code}) on ${rejected.reallocation_date}, Period ${slot?.period_number}. This was reassigned after the previous substitute was unavailable.`,
          type: "info",
        });
      }

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Reassigned to ${best.faculty.full_name}`,
        new_substitute: best.faculty.full_name,
        score: best.score,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: "No suitable substitute found. All candidates exhausted.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Standard auto-reallocate flow — directly approve (no suggestion step)
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("*, subjects(id, name, code, is_lab, department_id)")
    .eq("faculty_id", faculty_id);

  if (!slots || slots.length === 0) {
    return new Response(JSON.stringify({ count: 0, message: "No slots to reallocate" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: allFaculty } = await supabase
    .from("faculty")
    .select("*, faculty_subjects(subject_id)")
    .eq("is_active", true)
    .neq("id", faculty_id);

  const { data: allSlots } = await supabase.from("timetable_slots").select("*");

  const { data: existingReallocations } = await supabase
    .from("reallocations")
    .select("substitute_faculty_id")
    .gte("reallocation_date", start_date)
    .lte("reallocation_date", end_date);

  const reallocationCounts: Record<string, number> = {};
  existingReallocations?.forEach((r: any) => {
    reallocationCounts[r.substitute_faculty_id] = (reallocationCounts[r.substitute_faculty_id] || 0) + 1;
  });

  // Generate working dates (skip weekends)
  const dates: string[] = [];
  const startD = new Date(start_date);
  const endD = new Date(end_date);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }

  // Check holidays
  const { data: holidays } = await supabase
    .from("holidays")
    .select("holiday_date")
    .gte("holiday_date", start_date)
    .lte("holiday_date", end_date);
  const holidaySet = new Set((holidays || []).map((h: any) => h.holiday_date));
  const workingDates = dates.filter(d => !holidaySet.has(d));

  const reallocations: any[] = [];

  for (const date of workingDates) {
    const dayOfWeek = new Date(date).getDay();
    const daySlots = slots.filter((s: any) => s.day_of_week === dayOfWeek);

    for (const slot of daySlots) {
      const candidates = (allFaculty || []).map((f: any) => {
        let score = 0;
        const hasSubject = f.faculty_subjects?.some((fs: any) => fs.subject_id === slot.subject_id);
        if (hasSubject) score += 40;
        if (f.department_id === slot.subjects?.department_id) score += 15;
        if (slot.is_lab || slot.subjects?.is_lab) {
          if (f.lab_qualified) score += 20; else score -= 50;
        }
        // Expertise keyword match
        if (f.expertise && slot.subjects?.name) {
          const subName = slot.subjects.name.toLowerCase();
          for (const exp of f.expertise) {
            if (subName.includes(exp.toLowerCase())) { score += 25; break; }
          }
        }
        const hasConflict = allSlots?.some(
          (s: any) => s.faculty_id === f.id && s.day_of_week === dayOfWeek && s.period_number === slot.period_number
        );
        if (hasConflict) score -= 100; else score += 30;
        const existing = reallocationCounts[f.id] || 0;
        score -= existing * 5;
        const periodsOnDay = (allSlots || []).filter(
          (s: any) => s.faculty_id === f.id && s.day_of_week === dayOfWeek
        ).length;
        if (periodsOnDay >= f.max_periods_per_day) score -= 100;
        return { faculty: f, score };
      });

      candidates.sort((a: any, b: any) => b.score - a.score);
      const best = candidates.find((c: any) => c.score > 0);

      if (best) {
        reallocations.push({
          leave_request_id,
          timetable_slot_id: slot.id,
          original_faculty_id: faculty_id,
          substitute_faculty_id: best.faculty.id,
          reallocation_date: date,
          score: best.score,
          status: "approved", // Auto-approve instead of "suggested"
          notes: `AI Auto-Assigned. Score: ${best.score}. Subject match: ${best.faculty.faculty_subjects?.some((fs: any) => fs.subject_id === slot.subject_id) ? "Yes" : "No"}`,
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify each substitute faculty
    const notifiedUsers = new Set<string>();
    for (const r of reallocations) {
      const { data: subFac } = await supabase.from("faculty").select("user_id, full_name").eq("id", r.substitute_faculty_id).single();
      const { data: origFac } = await supabase.from("faculty").select("full_name").eq("id", faculty_id).single();
      if (subFac?.user_id && !notifiedUsers.has(subFac.user_id)) {
        notifiedUsers.add(subFac.user_id);
        const count = reallocations.filter((x: any) => x.substitute_faculty_id === r.substitute_faculty_id).length;
        await supabase.from("notifications").insert({
          user_id: subFac.user_id,
          title: "📋 Substitution Assignment",
          message: `You have ${count} substitution class(es) covering for ${origFac?.full_name || "a colleague"} from ${start_date} to ${end_date}. You can reject if unavailable.`,
          type: "info",
        });
      }
    }
  }

  return new Response(
    JSON.stringify({
      count: reallocations.length,
      message: `Auto-assigned ${reallocations.length} substitutions (holidays skipped: ${dates.length - workingDates.length})`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
