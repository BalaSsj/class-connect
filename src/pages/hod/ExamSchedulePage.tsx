import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function ExamSchedulePage() {
  const { user } = useAuth();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [yearSections, setYearSections] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject_id: "", year_section_id: "", exam_type: "internal", exam_date: "", start_time: "09:00", end_time: "12:00", room: "", invigilator_id: "", notes: "" });

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) setDeptId(fac.department_id);
    };
    loadDept();
  }, [user]);

  const fetchAll = async () => {
    if (!deptId) return;
    const [e, s, ys, f] = await Promise.all([
      supabase.from("exam_schedules").select("*, subjects(name, code), years_sections(year, section), faculty!exam_schedules_invigilator_id_fkey(full_name)").order("exam_date", { ascending: true }),
      supabase.from("subjects").select("*").eq("department_id", deptId).order("name"),
      supabase.from("years_sections").select("*").eq("department_id", deptId).order("year"),
      supabase.from("faculty").select("*").eq("department_id", deptId).eq("is_active", true).order("full_name"),
    ]);
    if (e.data) setExams(e.data.filter((ex: any) => subjects.length === 0 || true));
    if (s.data) setSubjects(s.data);
    if (ys.data) setYearSections(ys.data);
    if (f.data) setFaculty(f.data);
  };

  useEffect(() => { fetchAll(); }, [deptId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("exam_schedules").insert({
      subject_id: form.subject_id, year_section_id: form.year_section_id, exam_type: form.exam_type,
      exam_date: form.exam_date, start_time: form.start_time, end_time: form.end_time,
      room: form.room || null, invigilator_id: form.invigilator_id || null,
      notes: form.notes || null, created_by: user?.id,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Exam scheduled");
    setForm({ subject_id: "", year_section_id: "", exam_type: "internal", exam_date: "", start_time: "09:00", end_time: "12:00", room: "", invigilator_id: "", notes: "" });
    setOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("exam_schedules").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchAll(); }
  };

  const typeColors: Record<string, string> = { internal: "default", model: "secondary", semester: "destructive", retest: "outline" };

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Exam Schedule</h1><p className="text-muted-foreground">Plan and manage examinations</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Schedule Exam</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Exam</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Subject</Label><Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Section</Label><Select value={form.year_section_id} onValueChange={(v) => setForm({ ...form, year_section_id: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{yearSections.map((ys) => <SelectItem key={ys.id} value={ys.id}>Year {ys.year} Sec {ys.section}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Type</Label><Select value={form.exam_type} onValueChange={(v) => setForm({ ...form, exam_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="model">Model</SelectItem><SelectItem value="semester">Semester</SelectItem><SelectItem value="retest">Retest</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required /></div>
                <div className="space-y-2"><Label>End Time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Room</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room 301" /></div>
                <div className="space-y-2"><Label>Invigilator</Label><Select value={form.invigilator_id} onValueChange={(v) => setForm({ ...form, invigilator_id: v })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{faculty.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !form.subject_id || !form.year_section_id || !form.exam_date}>{loading ? "Scheduling..." : "Schedule Exam"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Scheduled Exams</CardTitle></CardHeader>
          <CardContent>
            {exams.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No exams scheduled.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Subject</TableHead><TableHead>Section</TableHead><TableHead>Type</TableHead><TableHead>Time</TableHead><TableHead>Room</TableHead><TableHead>Invigilator</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {exams.map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell className="font-medium">{ex.exam_date}</TableCell>
                      <TableCell>{(ex.subjects as any)?.code} — {(ex.subjects as any)?.name}</TableCell>
                      <TableCell>{(ex.years_sections as any) ? `Y${(ex.years_sections as any).year} S${(ex.years_sections as any).section}` : ""}</TableCell>
                      <TableCell><Badge variant={(typeColors[ex.exam_type] || "default") as any} className="capitalize">{ex.exam_type}</Badge></TableCell>
                      <TableCell className="text-sm">{ex.start_time?.slice(0,5)} - {ex.end_time?.slice(0,5)}</TableCell>
                      <TableCell>{ex.room || "—"}</TableCell>
                      <TableCell>{(ex.faculty as any)?.full_name || "—"}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(ex.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
