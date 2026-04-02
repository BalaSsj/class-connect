import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { year_section_id, department_id } = await req.json();

    // Get year_section info
    const { data: ysData } = await supabase
      .from("years_sections")
      .select("*, departments(name)")
      .eq("id", year_section_id)
      .single();

    if (!ysData) {
      return new Response(JSON.stringify({ error: "Section not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deptId = department_id || ysData.department_id;
    const semester = ysData.year; // year acts as semester indicator

    // Get subjects for this department, prefer matching year, fallback to all
    let { data: subjects } = await supabase
      .from("subjects")
      .select("*")
      .eq("department_id", deptId)
      .eq("year", ysData.year)
      .order("name");
    
    // Fallback: if no subjects match the year, use all dept subjects
    if (!subjects || subjects.length === 0) {
      const fallback = await supabase
        .from("subjects")
        .select("*")
        .eq("department_id", deptId)
        .order("name");
      subjects = fallback.data;
    }

    if (!subjects || subjects.length === 0) {
      return new Response(JSON.stringify({ error: "No subjects found for this department" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active faculty for this department with their skills
    const { data: faculty } = await supabase
      .from("faculty")
      .select("*, faculty_subjects(subject_id)")
      .eq("department_id", deptId)
      .eq("is_active", true);

    if (!faculty || faculty.length === 0) {
      return new Response(JSON.stringify({ error: "No active faculty in this department" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ALL existing timetable slots (for conflict detection across sections)
    const { data: allExistingSlots } = await supabase
      .from("timetable_slots")
      .select("*");

    // Clear existing slots for this section
    await supabase.from("timetable_slots").delete().eq("year_section_id", year_section_id);

    const DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat
    const PERIODS = [1, 2, 3, 4, 5, 6, 7];
    const totalSlots = DAYS.length * PERIODS.length; // 42

    // Separate lab and theory subjects
    const labSubjects = subjects.filter((s: any) => s.is_lab);
    const theorySubjects = subjects.filter((s: any) => !s.is_lab);

    // Calculate periods per subject (distribute evenly)
    // Labs get 2 consecutive periods, theory gets remaining
    const labSlotsNeeded = labSubjects.length * 2; // 2 periods per lab per week
    const theorySlotsAvailable = totalSlots - labSlotsNeeded;
    const periodsPerTheory = theorySubjects.length > 0 
      ? Math.max(1, Math.floor(theorySlotsAvailable / theorySubjects.length)) 
      : 0;

    // Build faculty skill map: subject_id -> [faculty_ids]
    const subjectFacultyMap: Record<string, string[]> = {};
    for (const sub of subjects) {
      const skilled = faculty.filter((f: any) =>
        f.faculty_subjects?.some((fs: any) => fs.subject_id === sub.id)
      );
      // If no skilled faculty, all dept faculty are candidates
      subjectFacultyMap[sub.id] = skilled.length > 0 
        ? skilled.map((f: any) => f.id) 
        : faculty.map((f: any) => f.id);
    }

    // Track faculty workload per day: { facultyId: { day: count } }
    const facultyDayLoad: Record<string, Record<number, number>> = {};
    const facultyTotalLoad: Record<string, number> = {};
    // Also track other-section conflicts
    const otherSectionSlots = (allExistingSlots || []).filter(
      (s: any) => s.year_section_id !== year_section_id
    );

    for (const f of faculty) {
      facultyDayLoad[f.id] = {};
      facultyTotalLoad[f.id] = 0;
      for (const d of DAYS) {
        facultyDayLoad[f.id][d] = otherSectionSlots.filter(
          (s: any) => s.faculty_id === f.id && s.day_of_week === d
        ).length;
      }
      facultyTotalLoad[f.id] = otherSectionSlots.filter(
        (s: any) => s.faculty_id === f.id
      ).length;
    }

    // Occupied grid for THIS section
    const grid: Record<string, any> = {}; // "day-period" -> slot
    const newSlots: any[] = [];

    const isOccupied = (day: number, period: number) => !!grid[`${day}-${period}`];
    const isFacultyBusy = (fId: string, day: number, period: number) => {
      // Check other sections
      if (otherSectionSlots.some((s: any) => s.faculty_id === fId && s.day_of_week === day && s.period_number === period)) return true;
      // Check this section's new slots
      if (newSlots.some(s => s.faculty_id === fId && s.day_of_week === day && s.period_number === period)) return true;
      return false;
    };

    const getBestFaculty = (subjectId: string, day: number, period: number, consecutivePeriod?: number) => {
      const candidates = subjectFacultyMap[subjectId] || [];
      let best: { id: string; score: number } | null = null;

      for (const fId of candidates) {
        if (isFacultyBusy(fId, day, period)) continue;
        if (consecutivePeriod && isFacultyBusy(fId, day, consecutivePeriod)) continue;

        const f = faculty.find((ff: any) => ff.id === fId);
        const maxPerDay = f?.max_periods_per_day || 6;
        const dayLoad = (facultyDayLoad[fId]?.[day] || 0);
        if (dayLoad >= maxPerDay) continue;

        let score = 100;
        // Prefer skilled faculty
        const hasSkill = faculty.find((ff: any) => ff.id === fId)?.faculty_subjects?.some(
          (fs: any) => fs.subject_id === subjectId
        );
        if (hasSkill) score += 40;
        // Prefer lower workload
        score -= (facultyTotalLoad[fId] || 0) * 2;
        score -= dayLoad * 5;

        if (!best || score > best.score) {
          best = { id: fId, score };
        }
      }
      return best?.id || null;
    };

    const assignSlot = (day: number, period: number, subjectId: string, facultyId: string, isLab: boolean) => {
      const slot = {
        year_section_id,
        day_of_week: day,
        period_number: period,
        subject_id: subjectId,
        faculty_id: facultyId,
        is_lab: isLab,
      };
      grid[`${day}-${period}`] = slot;
      newSlots.push(slot);
      facultyDayLoad[facultyId][day] = (facultyDayLoad[facultyId][day] || 0) + 1;
      facultyTotalLoad[facultyId] = (facultyTotalLoad[facultyId] || 0) + 1;
    };

    // Step 1: Place lab subjects (need 2 consecutive periods)
    let labDayIdx = 0;
    for (const lab of labSubjects) {
      let placed = false;
      for (let attempt = 0; attempt < DAYS.length * PERIODS.length && !placed; attempt++) {
        const day = DAYS[(labDayIdx + attempt) % DAYS.length];
        // Find 2 consecutive free periods
        for (let p = 1; p <= 6 && !placed; p++) {
          if (isOccupied(day, p) || isOccupied(day, p + 1)) continue;
          const fId = getBestFaculty(lab.id, day, p, p + 1);
          if (fId) {
            assignSlot(day, p, lab.id, fId, true);
            assignSlot(day, p + 1, lab.id, fId, true);
            placed = true;
            labDayIdx++;
          }
        }
      }
    }

    // Step 2: Place theory subjects
    // Create a queue of subject slots to place
    const theoryQueue: { subjectId: string; remaining: number }[] = theorySubjects.map(s => ({
      subjectId: s.id,
      remaining: Math.min(periodsPerTheory, 6), // cap at 6 per week
    }));

    // Fill remaining slots
    let queueIdx = 0;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (isOccupied(day, period)) continue;
        if (theoryQueue.every(q => q.remaining <= 0)) {
          // All subjects placed, restart for fill
          theoryQueue.forEach(q => q.remaining = 1);
        }

        // Round-robin through subjects
        let attempts = 0;
        while (attempts < theoryQueue.length) {
          const entry = theoryQueue[queueIdx % theoryQueue.length];
          queueIdx++;
          if (entry.remaining <= 0) { attempts++; continue; }

          // Don't place same subject twice on same day unless necessary
          const sameDayCount = newSlots.filter(
            s => s.day_of_week === day && s.subject_id === entry.subjectId
          ).length;
          if (sameDayCount >= 2) { attempts++; continue; }

          const fId = getBestFaculty(entry.subjectId, day, period);
          if (fId) {
            assignSlot(day, period, entry.subjectId, fId, false);
            entry.remaining--;
            break;
          }
          attempts++;
        }
      }
    }

    // Insert all generated slots
    if (newSlots.length > 0) {
      const { error } = await supabase.from("timetable_slots").insert(newSlots);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-create faculty_subjects mappings
      const mappings: { faculty_id: string; subject_id: string }[] = [];
      const seen = new Set<string>();
      for (const slot of newSlots) {
        const key = `${slot.faculty_id}-${slot.subject_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          mappings.push({ faculty_id: slot.faculty_id, subject_id: slot.subject_id });
        }
      }
      // Upsert skill mappings
      for (const m of mappings) {
        const { data: ex } = await supabase.from("faculty_subjects")
          .select("id").eq("faculty_id", m.faculty_id).eq("subject_id", m.subject_id).maybeSingle();
        if (!ex) {
          await supabase.from("faculty_subjects").insert(m);
        }
      }
    }

    // Build summary
    const subjectSummary = subjects.map((s: any) => {
      const count = newSlots.filter(sl => sl.subject_id === s.id).length;
      const assignedFaculty = [...new Set(newSlots.filter(sl => sl.subject_id === s.id).map(sl => sl.faculty_id))];
      const fNames = assignedFaculty.map(fId => faculty.find((f: any) => f.id === fId)?.full_name || "Unknown");
      return { subject: s.name, code: s.code, periods: count, faculty: fNames.join(", "), is_lab: s.is_lab };
    }).filter(s => s.periods > 0);

    return new Response(JSON.stringify({
      success: true,
      total_slots: newSlots.length,
      section: `Year ${ysData.year} Sec ${ysData.section}`,
      department: (ysData.departments as any)?.name,
      summary: subjectSummary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
