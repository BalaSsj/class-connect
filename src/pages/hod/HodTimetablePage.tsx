import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, AlertTriangle } from "lucide-react";
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
];

export default function HodTimetablePage() {
  const { user } = useAuth();
  const [deptId, setDeptId] = useState<string | null>(null);
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
  const colorMap = new Map<string, string>();

  const getSubjectColor = (subjectId: string) => {
    if (!colorMap.has(subjectId)) colorMap.set(subjectId, SUBJECT_COLORS[colorMap.size % SUBJECT_COLORS.length]);
    return colorMap.get(subjectId)!;
  };

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) setDeptId(fac.department_id);
    };
    loadDept();
  }, [user]);

  useEffect(() => {
    if (!deptId) return;
    const load = async () => {
      const [ys, sub, fac, all] = await Promise.all([
        supabase.from("years_sections").select("*").eq("department_id", deptId).order("year"),
        supabase.from("subjects").select("*").eq("department_id", deptId).order("name"),
        supabase.from("faculty").select("*").eq("department_id", deptId).eq("is_active", true).order("full_name"),
        supabase.from("timetable_slots").select("*"),
      ]);
      if (ys.data) setYearSections(ys.data);
      if (sub.data) setSubjects(sub.data);
      if (fac.data) setFaculty(fac.data);
      if (all.data) setAllSlots(all.data);
    };
    load();
  }, [deptId]);

  useEffect(() => {
    if (!selectedSection) { setSlots([]); return; }
    supabase.from("timetable_slots").select("*, subjects(name, code, is_lab), faculty(full_name)").eq("year_section_id", selectedSection).then(({ data }) => { if (data) setSlots(data); });
  }, [selectedSection]);

  const handleCellClick = (day: number, period: number) => {
    setEditSlot({ day, period });
    const existing = slots.find((s) => s.day_of_week === day && s.period_number === period);
    setForm(existing ? { subject_id: existing.subject_id, faculty_id: existing.faculty_id, is_lab: existing.is_lab } : { subject_id: "", faculty_id: "", is_lab: false });
    setConflicts([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editSlot || !form.subject_id || !form.faculty_id) return;
    const c = allSlots.filter((s) => s.faculty_id === form.faculty_id && s.day_of_week === editSlot.day && s.period_number === editSlot.period && s.year_section_id !== selectedSection);
    if (c.length > 0) { setConflicts(["Faculty already assigned at this time!"]); return; }
    await supabase.from("timetable_slots").delete().eq("year_section_id", selectedSection).eq("day_of_week", editSlot.day).eq("period_number", editSlot.period);
    const { error } = await supabase.from("timetable_slots").insert({ year_section_id: selectedSection, day_of_week: editSlot.day, period_number: editSlot.period, subject_id: form.subject_id, faculty_id: form.faculty_id, is_lab: form.is_lab });
    if (error) { toast.error(error.message); return; }
    toast.success("Slot saved!");
    setDialogOpen(false);
    const { data } = await supabase.from("timetable_slots").select("*, subjects(name, code, is_lab), faculty(full_name)").eq("year_section_id", selectedSection);
    if (data) setSlots(data);
    const { data: all } = await supabase.from("timetable_slots").select("*");
    if (all) setAllSlots(all);
  };

  const handleDeleteSlot = async () => {
    if (!editSlot) return;
    await supabase.from("timetable_slots").delete().eq("year_section_id", selectedSection).eq("day_of_week", editSlot.day).eq("period_number", editSlot.period);
    toast.success("Slot removed");
    setDialogOpen(false);
    const { data } = await supabase.from("timetable_slots").select("*, subjects(name, code, is_lab), faculty(full_name)").eq("year_section_id", selectedSection);
    if (data) setSlots(data);
  };

  const getSlot = (day: number, period: number) => slots.find((s) => s.day_of_week === day && s.period_number === period);

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Department Timetable</h1><p className="text-muted-foreground">Manage timetable for your department sections</p></div>
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select Section" /></SelectTrigger>
          <SelectContent>{yearSections.map((ys) => <SelectItem key={ys.id} value={ys.id}>Year {ys.year} Sec {ys.section}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!selectedSection ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a section to view and edit its timetable</CardContent></Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" />Weekly Timetable</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="border border-border p-2 bg-muted text-xs font-medium text-muted-foreground w-24">Day / Period</th>
                    {PERIODS.map((p, i) => <th key={p} className="border border-border p-2 bg-muted text-xs font-medium text-muted-foreground"><div>P{p}</div><div className="text-[10px] font-normal">{PERIOD_TIMES[i]}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, dayIdx) => (
                    <tr key={day}>
                      <td className="border border-border p-2 font-medium text-sm bg-muted/50">{day}</td>
                      {PERIODS.map((period) => {
                        const slot = getSlot(dayIdx + 1, period);
                        return (
                          <td key={period} className="border border-border p-1 cursor-pointer hover:bg-accent/50 transition-colors h-16" onClick={() => handleCellClick(dayIdx + 1, period)}>
                            {slot ? (
                              <div className={`rounded p-1.5 text-xs border ${getSubjectColor(slot.subject_id)}`}>
                                <div className="font-semibold truncate">{slot.subjects?.code}</div>
                                <div className="truncate text-[10px] opacity-75">{slot.faculty?.full_name}</div>
                                {slot.is_lab && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">LAB</Badge>}
                              </div>
                            ) : <div className="flex items-center justify-center h-full opacity-30"><Plus className="h-3 w-3" /></div>}
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
          <DialogHeader><DialogTitle>{editSlot ? `${DAYS[editSlot.day - 1]} — Period ${editSlot.period}` : "Edit Slot"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {conflicts.length > 0 && <div className="bg-destructive/10 border border-destructive/20 rounded p-3 flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-destructive mt-0.5" /><div className="text-sm text-destructive">{conflicts[0]}</div></div>}
            <div className="space-y-2"><Label>Subject</Label><Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Faculty</Label><Select value={form.faculty_id} onValueChange={(v) => { setForm({ ...form, faculty_id: v }); setConflicts([]); }}><SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger><SelectContent>{faculty.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_lab} onCheckedChange={(v) => setForm({ ...form, is_lab: v })} /><Label>Lab Session</Label></div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.subject_id || !form.faculty_id} className="flex-1">Save Slot</Button>
              {getSlot(editSlot?.day || 0, editSlot?.period || 0) && <Button variant="destructive" onClick={handleDeleteSlot}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
