import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rule-based scoring for a candidate faculty against a slot
function scoreCandidate(f: any, slot: any, dayOfWeek: number, allSlots: any[], reallocCounts: Record<string, number>) {
  let score = 0;
  const hasSubject = f.faculty_subjects?.some((fs: any) => fs.subject_id === slot?.subject_id);
  if (hasSubject) score += 40;
  if (f.department_id === slot?.subjects?.department_id) score += 15;
  if (slot?.is_lab || slot?.subjects?.is_lab) {
    if (f.lab_qualified) score += 20; else score -= 50;
  }
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
  const existing = reallocCounts[f.id] || 0;
  score -= existing * 5;
  return score;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();
  const { leave_request_id, faculty_id, start_date, end_date, reject_reallocation_id, confirm_reallocation_id, reason } = body;

  // ===== Faculty confirms "I am Free" =====
  if (confirm_reallocation_id) {
    const { error } = await supabase
      .from("reallocations")
      .update({ status: "approved", notes: "Confirmed by substitute (I am Free)" })
      .eq("id", confirm_reallocation_id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, message: "Assignment confirmed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===== Faculty selects "Not Free" — reject with reason and reassign =====
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

    await supabase.from("reallocations").update({
      status: "rejected",
      notes: reason ? `Not Free: ${reason}` : "Not Free",
    }).eq("id", reject_reallocation_id);

    // Exclude original + anyone already tried (any status) for this slot+date
    const { data: existingForSlot } = await supabase
      .from("reallocations")
      .select("substitute_faculty_id")
      .eq("timetable_slot_id", rejected.timetable_slot_id)
      .eq("reallocation_date", rejected.reallocation_date);

    const excludeIds = new Set((existingForSlot || []).map((r: any) => r.substitute_faculty_id));
    excludeIds.add(rejected.original_faculty_id);

    const slot = rejected.timetable_slots;
    const dayOfWeek = new Date(rejected.reallocation_date).getDay();

    const { data: allFaculty } = await supabase
      .from("faculty")
      .select("*, faculty_subjects(subject_id)")
      .eq("is_active", true);

    const { data: allSlots } = await supabase.from("timetable_slots").select("*");

    const candidates = (allFaculty || [])
      .filter((f: any) => !excludeIds.has(f.id))
      .map((f: any) => ({ faculty: f, score: scoreCandidate(f, slot, dayOfWeek, allSlots || [], {}) }))
      .sort((a: any, b: any) => b.score - a.score);

    const best = candidates.find((c: any) => c.score > 0);
    if (best) {
      const { data: inserted, error } = await supabase.from("reallocations").insert({
        leave_request_id: rejected.leave_request_id,
        timetable_slot_id: rejected.timetable_slot_id,
        original_faculty_id: rejected.original_faculty_id,
        substitute_faculty_id: best.faculty.id,
        reallocation_date: rejected.reallocation_date,
        score: best.score,
        status: "pending", // Awaiting faculty confirmation
        notes: `Auto-reassigned after previous Not Free. Score: ${best.score}`,
      }).select().single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subFac } = await supabase.from("faculty").select("user_id").eq("id", best.faculty.id).single();
      if (subFac?.user_id) {
        await supabase.from("notifications").insert({
          user_id: subFac.user_id,
          title: "🔄 New Substitution Request",
          message: `Please cover ${slot?.subjects?.name} (${slot?.subjects?.code}) on ${rejected.reallocation_date}, Period ${slot?.period_number}. Open My Substitutions to respond: I am Free / Not Free.`,
          type: "info",
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Reassigned to ${best.faculty.full_name} (awaiting confirmation)`,
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

  // ===== Standard auto-reallocate flow on leave approval =====
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

  // Working dates (Mon-Sat, skip holidays)
  const dates: string[] = [];
  const startD = new Date(start_date);
  const endD = new Date(end_date);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }
  const { data: holidays } = await supabase
    .from("holidays")
    .select("holiday_date")
    .gte("holiday_date", start_date)
    .lte("holiday_date", end_date);
  const holidaySet = new Set((holidays || []).map((h: any) => h.holiday_date));
  const workingDates = dates.filter(d => !holidaySet.has(d));

  // De-dup: fetch existing reallocations for this leave / slot+date
  const { data: existingReallocs } = await supabase
    .from("reallocations")
    .select("timetable_slot_id, reallocation_date, substitute_faculty_id, status")
    .gte("reallocation_date", start_date)
    .lte("reallocation_date", end_date);

  const existingKeys = new Set(
    (existingReallocs || [])
      .filter((r: any) => r.status !== "rejected")
      .map((r: any) => `${r.timetable_slot_id}|${r.reallocation_date}`)
  );
  const reallocationCounts: Record<string, number> = {};
  (existingReallocs || []).forEach((r: any) => {
    if (r.status !== "rejected") {
      reallocationCounts[r.substitute_faculty_id] = (reallocationCounts[r.substitute_faculty_id] || 0) + 1;
    }
  });

  const reallocations: any[] = [];
  let skippedDuplicates = 0;

  for (const date of workingDates) {
    const dayOfWeek = new Date(date).getDay();
    const daySlots = slots.filter((s: any) => s.day_of_week === dayOfWeek);

    for (const slot of daySlots) {
      const key = `${slot.id}|${date}`;
      if (existingKeys.has(key)) {
        skippedDuplicates++;
        continue; // Skip duplicate
      }

      const candidates = (allFaculty || [])
        .map((f: any) => ({ faculty: f, score: scoreCandidate(f, slot, dayOfWeek, allSlots || [], reallocationCounts) }))
        .sort((a: any, b: any) => b.score - a.score);

      const best = candidates.find((c: any) => c.score > 0);
      if (best) {
        reallocations.push({
          leave_request_id,
          timetable_slot_id: slot.id,
          original_faculty_id: faculty_id,
          substitute_faculty_id: best.faculty.id,
          reallocation_date: date,
          score: best.score,
          status: "pending", // Awaiting faculty "I am Free" confirmation
          notes: `Rule-based assignment. Score: ${best.score}`,
        });
        existingKeys.add(key);
        reallocationCounts[best.faculty.id] = (reallocationCounts[best.faculty.id] || 0) + 1;
      }
    }
  }

  if (reallocations.length > 0) {
    const { error } = await supabase.from("reallocations").insert(reallocations);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifiedUsers = new Set<string>();
    for (const r of reallocations) {
      const { data: subFac } = await supabase.from("faculty").select("user_id").eq("id", r.substitute_faculty_id).single();
      const { data: origFac } = await supabase.from("faculty").select("full_name").eq("id", faculty_id).single();
      if (subFac?.user_id && !notifiedUsers.has(subFac.user_id)) {
        notifiedUsers.add(subFac.user_id);
        const count = reallocations.filter((x: any) => x.substitute_faculty_id === r.substitute_faculty_id).length;
        await supabase.from("notifications").insert({
          user_id: subFac.user_id,
          title: "📋 Substitution Request — Action Needed",
          message: `You have ${count} class(es) to cover for ${origFac?.full_name || "a colleague"} (${start_date} to ${end_date}). Open 'My Substitutions' and respond: I am Free / Not Free.`,
          type: "info",
        });
      }
    }
  }

  return new Response(
    JSON.stringify({
      count: reallocations.length,
      skipped_duplicates: skippedDuplicates,
      message: `Assigned ${reallocations.length} substitution(s)${skippedDuplicates ? `, skipped ${skippedDuplicates} duplicate(s)` : ""}. Awaiting faculty confirmation.`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
