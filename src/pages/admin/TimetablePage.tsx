import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, AlertTriangle, Wand2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const PERIOD_TIMES = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:30-2:20", "2:20-3:10", "3:10-4:00"];

const SUBJECT_COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
  "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800",
  "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800",
  "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800",
];

export default function TimetablePage() {
  const [yearSections, setYearSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<{ day: number; period: number } | null>(null);
  const [form, setForm] = useState({ subject_id: "", faculty_id: "", is_lab: false });
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [autoResult, setAutoResult] = useState<any>(null);
  const colorMap = new Map<string, string>();

  const getSubjectColor = (subjectId: string) => {
    if (!colorMap.has(subjectId)) {
      colorMap.set(subjectId, SUBJECT_COLORS[colorMap.size % SUBJECT_COLORS.length]);
    }
    return colorMap.get(subjectId)!;
  };

  const fetchData = useCallback(async () => {
    const [ys, sub, fac] = await Promise.all([
      supabase.from("years_sections").select("*, departments(name)").order("year"),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("faculty").select("*").eq("is_active", true).order("full_name"),
    ]);
    if (ys.data) setYearSections(ys.data);
    if (sub.data) setSubjects(sub.data);
    if (fac.data) setFaculty(fac.data);
    const { data: all } = await supabase.from("timetable_slots").select("*");
    if (all) setAllSlots(all);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refreshSlots = useCallback(async () => {
    if (!selectedSection) { setSlots([]); return; }
    const { data } = await supabase
      .from("timetable_slots")
      .select("*, subjects(name, code, is_lab), faculty(full_name)")
      .eq("year_section_id", selectedSection);
    if (data) setSlots(data);
    const { data: all } = await supabase.from("timetable_slots").select("*");
    if (all) setAllSlots(all);
  }, [selectedSection]);

  useEffect(() => { refreshSlots(); }, [refreshSlots]);

  const checkConflicts = (facultyId: string, day: number, period: number) => {
    return allSlots.filter(
      (s) => s.faculty_id === facultyId && s.day_of_week === day && s.period_number === period && s.year_section_id !== selectedSection
    );
  };

  const handleCellClick = (day: number, period: number) => {
    setEditSlot({ day, period });
    const existing = slots.find((s) => s.day_of_week === day && s.period_number === period);
    if (existing) {
      setForm({ subject_id: existing.subject_id, faculty_id: existing.faculty_id, is_lab: existing.is_lab });
    } else {
      setForm({ subject_id: "", faculty_id: "", is_lab: false });
    }
    setConflicts([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editSlot || !form.subject_id || !form.faculty_id) return;
    const c = checkConflicts(form.faculty_id, editSlot.day, editSlot.period);
    if (c.length > 0) {
      setConflicts(c.map(() => "Faculty already assigned to another section at this time!"));
      return;
    }
    await supabase.from("timetable_slots").delete()
      .eq("year_section_id", selectedSection)
      .eq("day_of_week", editSlot.day)
      .eq("period_number", editSlot.period);
    const { error } = await supabase.from("timetable_slots").insert({
      year_section_id: selectedSection,
      day_of_week: editSlot.day,
      period_number: editSlot.period,
      subject_id: form.subject_id,
      faculty_id: form.faculty_id,
      is_lab: form.is_lab,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Slot saved!");
    setDialogOpen(false);
    refreshSlots();
  };

  const handleDeleteSlot = async () => {
    if (!editSlot) return;
    await supabase.from("timetable_slots").delete()
      .eq("year_section_id", selectedSection)
      .eq("day_of_week", editSlot.day)
      .eq("period_number", editSlot.period);
    toast.success("Slot removed");
    setDialogOpen(false);
    refreshSlots();
  };

  const handleAutoAssign = async () => {
    if (!selectedSection) return;
    const section = yearSections.find(ys => ys.id === selectedSection);
    if (!section) return;

    const confirmed = window.confirm(
      `This will auto-generate the entire timetable for ${(section.departments as any)?.name} — Year ${section.year} Sec ${section.section}.\n\nExisting slots for this section will be replaced.\n\nContinue?`
    );
    if (!confirmed) return;

    setAutoAssigning(true);
    setAutoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("auto-timetable", {
        body: { year_section_id: selectedSection, department_id: section.department_id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAutoResult(data);
      toast.success(`Auto-assigned ${data.total_slots} slots!`);
      refreshSlots();
    } catch (err: any) {
      toast.error(err.message || "Auto-assign failed");
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleAutoAssignAll = async () => {
    const confirmed = window.confirm(
      `This will auto-generate timetables for ALL ${yearSections.length} sections.\n\nAll existing timetable slots will be replaced.\n\nContinue?`
    );
    if (!confirmed) return;

    setAutoAssigning(true);
    setAutoResult(null);
    let totalSlots = 0;
    const results: any[] = [];

    for (const ys of yearSections) {
      try {
        const { data, error } = await supabase.functions.invoke("auto-timetable", {
          body: { year_section_id: ys.id, department_id: ys.department_id },
        });
        if (error) throw error;
        if (data?.total_slots) totalSlots += data.total_slots;
        results.push({ section: `${(ys.departments as any)?.name} Y${ys.year} S${ys.section}`, slots: data?.total_slots || 0 });
      } catch (err: any) {
        results.push({ section: `Y${ys.year} S${ys.section}`, error: err.message });
      }
    }

    setAutoResult({ total_slots: totalSlots, all_sections: results });
    toast.success(`Auto-assigned ${totalSlots} total slots across ${yearSections.length} sections!`);
    refreshSlots();
    setAutoAssigning(false);
  };

  const getSlot = (day: number, period: number) => slots.find((s) => s.day_of_week === day && s.period_number === period);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timetable Builder</h1>
          <p className="text-muted-foreground">Assign 7 periods per day — manual or AI auto-assign</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAutoAssignAll} variant="outline" disabled={autoAssigning || yearSections.length === 0}>
            {autoAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Auto-Assign All
          </Button>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select Section" /></SelectTrigger>
            <SelectContent>
              {yearSections.map((ys) => (
                <SelectItem key={ys.id} value={ys.id}>
                  {(ys.departments as any)?.name} — Year {ys.year} Sec {ys.section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Auto-assign result summary */}
      {autoResult && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" /> Auto-Assignment Result
                </h3>
                <Badge variant="secondary">{autoResult.total_slots} slots</Badge>
              </div>
              {autoResult.summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {autoResult.summary.map((s: any, i: number) => (
                    <div key={i} className="text-xs p-2 rounded bg-background border">
                      <div className="font-medium">{s.code} — {s.subject}</div>
                      <div className="text-muted-foreground">{s.periods} periods • {s.faculty}</div>
                      {s.is_lab && <Badge variant="outline" className="text-[9px] mt-1">LAB</Badge>}
                    </div>
                  ))}
                </div>
              )}
              {autoResult.all_sections && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {autoResult.all_sections.map((r: any, i: number) => (
                    <div key={i} className={`text-xs p-2 rounded border ${r.error ? 'bg-destructive/10 border-destructive/20' : 'bg-background'}`}>
                      <div className="font-medium">{r.section}</div>
                      <div className="text-muted-foreground">{r.error || `${r.slots} slots assigned`}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!selectedSection ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a section to view/edit, or use "Auto-Assign All" to generate timetables for every section
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" /> Weekly Timetable</CardTitle>
                <Button size="sm" onClick={handleAutoAssign} disabled={autoAssigning}>
                  {autoAssigning ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />}
                  Auto-Assign This Section
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="border border-border p-2 bg-muted text-xs font-medium text-muted-foreground w-24">Day / Period</th>
                    {PERIODS.map((p, i) => (
                      <th key={p} className="border border-border p-2 bg-muted text-xs font-medium text-muted-foreground">
                        <div>P{p}</div>
                        <div className="text-[10px] font-normal">{PERIOD_TIMES[i]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, dayIdx) => (
                    <tr key={day}>
                      <td className="border border-border p-2 font-medium text-sm bg-muted/50">{day}</td>
                      {PERIODS.map((period) => {
                        const slot = getSlot(dayIdx + 1, period);
                        return (
                          <td
                            key={period}
                            className="border border-border p-1 cursor-pointer hover:bg-accent/50 transition-colors h-16"
                            onClick={() => handleCellClick(dayIdx + 1, period)}
                          >
                            {slot ? (
                              <div className={`rounded p-1.5 text-xs border ${getSubjectColor(slot.subject_id)}`}>
                                <div className="font-semibold truncate">{slot.subjects?.code}</div>
                                <div className="truncate text-[10px] opacity-75">{slot.faculty?.full_name}</div>
                                {slot.is_lab && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">LAB</Badge>}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full opacity-30">
                                <Plus className="h-3 w-3" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editSlot ? `${DAYS[editSlot.day - 1]} — Period ${editSlot.period}` : "Edit Slot"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {conflicts.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm text-destructive">{conflicts[0]}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Faculty</Label>
              <Select value={form.faculty_id} onValueChange={(v) => { setForm({ ...form, faculty_id: v }); setConflicts([]); }}>
                <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>
                  {faculty.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_lab} onCheckedChange={(v) => setForm({ ...form, is_lab: v })} />
              <Label>Lab Session</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.subject_id || !form.faculty_id} className="flex-1">
                Save Slot
              </Button>
              {getSlot(editSlot?.day || 0, editSlot?.period || 0) && (
                <Button variant="destructive" onClick={handleDeleteSlot}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
