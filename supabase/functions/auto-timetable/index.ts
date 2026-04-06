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

    // Get subjects matching year, fallback to all dept subjects
    let { data: subjects } = await supabase
      .from("subjects").select("*").eq("department_id", deptId).eq("year", ysData.year).order("name");
    if (!subjects || subjects.length === 0) {
      const fallback = await supabase.from("subjects").select("*").eq("department_id", deptId).order("name");
      subjects = fallback.data;
    }
    if (!subjects || subjects.length === 0) {
      return new Response(JSON.stringify({ error: "No subjects found for this department" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active faculty with skills & expertise
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

    // Get ALL existing timetable slots for conflict detection
    const { data: allExistingSlots } = await supabase.from("timetable_slots").select("*");

    // Clear existing slots for this section
    await supabase.from("timetable_slots").delete().eq("year_section_id", year_section_id);

    const DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat
    const PERIODS = [1, 2, 3, 4, 5, 6, 7];
    const totalSlots = DAYS.length * PERIODS.length; // 42

    const labSubjects = subjects.filter((s: any) => s.is_lab);
    const theorySubjects = subjects.filter((s: any) => !s.is_lab);

    const labSlotsNeeded = labSubjects.length * 2;
    const theorySlotsAvailable = totalSlots - labSlotsNeeded;
    const periodsPerTheory = theorySubjects.length > 0
      ? Math.max(1, Math.floor(theorySlotsAvailable / theorySubjects.length))
      : 0;

    // KEY FIX: Lock one faculty per subject for this section
    // Score faculty for each subject and pick the best one
    const subjectFacultyLock: Record<string, string> = {};
    const subjectCandidates: Record<string, string[]> = {};

    const otherSectionSlots = (allExistingSlots || []).filter(
      (s: any) => s.year_section_id !== year_section_id
    );

    // Track faculty workload
    const facultyDayLoad: Record<string, Record<number, number>> = {};
    const facultyTotalLoad: Record<string, number> = {};

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

    // Assign ONE faculty per subject based on expertise scoring
    for (const sub of subjects) {
      const scored = faculty.map((f: any) => {
        let score = 100;
        // Expertise match from faculty_subjects
        const hasSkill = f.faculty_subjects?.some((fs: any) => fs.subject_id === sub.id);
        if (hasSkill) score += 50;
        // Expertise keyword match
        if (f.expertise && Array.isArray(f.expertise)) {
          const subName = sub.name.toLowerCase();
          const subCode = sub.code.toLowerCase();
          for (const exp of f.expertise) {
            if (subName.includes(exp.toLowerCase()) || subCode.includes(exp.toLowerCase())) {
              score += 30;
              break;
            }
          }
        }
        // Lab qualification
        if (sub.is_lab && !f.lab_qualified) score -= 80;
        if (sub.is_lab && f.lab_qualified) score += 20;
        // Lower workload preferred
        score -= (facultyTotalLoad[f.id] || 0) * 3;
        return { id: f.id, score };
      }).sort((a: any, b: any) => b.score - a.score);

      subjectFacultyLock[sub.id] = scored[0].id;
      subjectCandidates[sub.id] = scored.map((s: any) => s.id);
    }

    // Grid and slot tracking
    const grid: Record<string, any> = {};
    const newSlots: any[] = [];

    const isOccupied = (day: number, period: number) => !!grid[`${day}-${period}`];
    const isFacultyBusy = (fId: string, day: number, period: number) => {
      if (otherSectionSlots.some((s: any) => s.faculty_id === fId && s.day_of_week === day && s.period_number === period)) return true;
      if (newSlots.some(s => s.faculty_id === fId && s.day_of_week === day && s.period_number === period)) return true;
      return false;
    };

    const assignSlot = (day: number, period: number, subjectId: string, facultyId: string, isLab: boolean) => {
      const slot = { year_section_id, day_of_week: day, period_number: period, subject_id: subjectId, faculty_id: facultyId, is_lab: isLab };
      grid[`${day}-${period}`] = slot;
      newSlots.push(slot);
      facultyDayLoad[facultyId][day] = (facultyDayLoad[facultyId][day] || 0) + 1;
      facultyTotalLoad[facultyId] = (facultyTotalLoad[facultyId] || 0) + 1;
    };

    const getAvailableFaculty = (subjectId: string, day: number, period: number, consecutivePeriod?: number): string | null => {
      // First try the locked faculty
      const locked = subjectFacultyLock[subjectId];
      if (locked && !isFacultyBusy(locked, day, period)) {
        if (!consecutivePeriod || !isFacultyBusy(locked, day, consecutivePeriod)) {
          const f = faculty.find((ff: any) => ff.id === locked);
          const maxPerDay = f?.max_periods_per_day || 6;
          if ((facultyDayLoad[locked]?.[day] || 0) < maxPerDay) {
            return locked;
          }
        }
      }
      // Fallback to other candidates
      for (const fId of (subjectCandidates[subjectId] || [])) {
        if (fId === locked) continue;
        if (isFacultyBusy(fId, day, period)) continue;
        if (consecutivePeriod && isFacultyBusy(fId, day, consecutivePeriod)) continue;
        const f = faculty.find((ff: any) => ff.id === fId);
        const maxPerDay = f?.max_periods_per_day || 6;
        if ((facultyDayLoad[fId]?.[day] || 0) >= maxPerDay) continue;
        return fId;
      }
      return null;
    };

    // Skip Monday P1-P2 for Internal Assessment
    const iaSlots = [{ day: 1, period: 1 }, { day: 1, period: 2 }];
    for (const ia of iaSlots) {
      grid[`${ia.day}-${ia.period}`] = { ia: true };
    }

    // Step 1: Place lab subjects (2 consecutive periods)
    let labDayIdx = 1; // start from Tuesday (day 2) to avoid Monday IA
    for (const lab of labSubjects) {
      let placed = false;
      for (let attempt = 0; attempt < DAYS.length * PERIODS.length && !placed; attempt++) {
        const day = DAYS[(labDayIdx + attempt) % DAYS.length];
        for (let p = 1; p <= 6 && !placed; p++) {
          if (isOccupied(day, p) || isOccupied(day, p + 1)) continue;
          const fId = getAvailableFaculty(lab.id, day, p, p + 1);
          if (fId) {
            assignSlot(day, p, lab.id, fId, true);
            assignSlot(day, p + 1, lab.id, fId, true);
            placed = true;
            labDayIdx++;
          }
        }
      }
    }

    // Step 2: Place theory subjects round-robin
    const theoryQueue = theorySubjects.map((s: any) => ({
      subjectId: s.id,
      remaining: Math.min(periodsPerTheory, 6),
    }));

    let queueIdx = 0;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (isOccupied(day, period)) continue;
        if (theoryQueue.every((q: any) => q.remaining <= 0)) {
          theoryQueue.forEach((q: any) => q.remaining = 1);
        }

        let attempts = 0;
        while (attempts < theoryQueue.length) {
          const entry = theoryQueue[queueIdx % theoryQueue.length];
          queueIdx++;
          if (entry.remaining <= 0) { attempts++; continue; }

          // Avoid >2 same subject on same day
          const sameDayCount = newSlots.filter(
            s => s.day_of_week === day && s.subject_id === entry.subjectId
          ).length;
          if (sameDayCount >= 2) { attempts++; continue; }

          const fId = getAvailableFaculty(entry.subjectId, day, period);
          if (fId) {
            assignSlot(day, period, entry.subjectId, fId, false);
            entry.remaining--;
            break;
          }
          attempts++;
        }
      }
    }

    // Filter out IA placeholder slots
    const realSlots = newSlots.filter(s => !s.ia);

    if (realSlots.length > 0) {
      const { error } = await supabase.from("timetable_slots").insert(realSlots);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-create faculty_subjects mappings
      const seen = new Set<string>();
      for (const slot of realSlots) {
        const key = `${slot.faculty_id}-${slot.subject_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          const { data: ex } = await supabase.from("faculty_subjects")
            .select("id").eq("faculty_id", slot.faculty_id).eq("subject_id", slot.subject_id).maybeSingle();
          if (!ex) {
            await supabase.from("faculty_subjects").insert({ faculty_id: slot.faculty_id, subject_id: slot.subject_id });
          }
        }
      }
    }

    // Build summary
    const subjectSummary = subjects.map((s: any) => {
      const count = realSlots.filter((sl: any) => sl.subject_id === s.id).length;
      const assignedFaculty = [...new Set(realSlots.filter((sl: any) => sl.subject_id === s.id).map((sl: any) => sl.faculty_id))];
      const fNames = assignedFaculty.map((fId: string) => faculty.find((f: any) => f.id === fId)?.full_name || "Unknown");
      return { subject: s.name, code: s.code, periods: count, faculty: fNames.join(", "), is_lab: s.is_lab };
    }).filter((s: any) => s.periods > 0);

    return new Response(JSON.stringify({
      success: true,
      total_slots: realSlots.length,
      section: `Year ${ysData.year} Sec ${ysData.section}`,
      department: (ysData.departments as any)?.name,
      summary: subjectSummary,
      note: "Monday P1-P2 reserved for Internal Assessment",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
