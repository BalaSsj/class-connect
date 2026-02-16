import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function HodSubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", year: "", semester: "", credits: "3", is_lab: false });

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id, departments(name)").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) {
        setDeptId(fac.department_id);
        setDeptName((fac.departments as any)?.name || "");
      }
    };
    loadDept();
  }, [user]);

  const fetchSubjects = async () => {
    if (!deptId) return;
    const { data } = await supabase.from("subjects").select("*").eq("department_id", deptId).order("year").order("name");
    if (data) setSubjects(data);
  };

  useEffect(() => { fetchSubjects(); }, [deptId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId) return;
    setLoading(true);
    const { error } = await supabase.from("subjects").insert({
      name: form.name, code: form.code.toUpperCase(), department_id: deptId,
      year: parseInt(form.year), semester: parseInt(form.semester),
      credits: parseInt(form.credits), is_lab: form.is_lab,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subject created");
    setForm({ name: "", code: "", year: "", semester: "", credits: "3", is_lab: false });
    setOpen(false);
    fetchSubjects();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchSubjects(); }
  };

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD to any department.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Department Subjects</h1>
          <p className="text-muted-foreground">Manage subjects for {deptName}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Subject</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Subject — {deptName}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Subject Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Data Structures" required />
                </div>
                <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS201" required /></div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{[1,2,3,4].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}><SelectTrigger><SelectValue placeholder="Sem" /></SelectTrigger><SelectContent>{[1,2,3,4,5,6,7,8].map((s) => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Credits</Label><Input type="number" min="1" max="6" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} required /></div>
                <div className="flex items-center gap-2 col-span-2"><Switch checked={form.is_lab} onCheckedChange={(v) => setForm({ ...form, is_lab: v })} /><Label>Lab course</Label></div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !form.year || !form.semester}>{loading ? "Creating..." : "Create Subject"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />{deptName} Subjects</CardTitle></CardHeader>
          <CardContent>
            {subjects.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No subjects yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Year</TableHead><TableHead>Sem</TableHead><TableHead>Credits</TableHead><TableHead>Type</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {subjects.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.code}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.year}</TableCell><TableCell>{s.semester}</TableCell><TableCell>{s.credits}</TableCell>
                      <TableCell><Badge variant={s.is_lab ? "destructive" : "secondary"}>{s.is_lab ? "Lab" : "Theory"}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
