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
import { Plus, Trash2, Users, UserPlus, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

export default function HodFacultyManagePage() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [open, setOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", employee_id: "",
    designation: "Assistant Professor", lab_qualified: false, max_periods_per_day: "6",
    create_account: false, password: "", role: "faculty",
  });
  const [regForm, setRegForm] = useState({ password: "", role: "faculty" });

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id, departments(name)").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) { setDeptId(fac.department_id); setDeptName((fac.departments as any)?.name || ""); }
    };
    loadDept();
  }, [user]);

  const fetchFaculty = async () => {
    if (!deptId) return;
    const { data } = await supabase.from("faculty").select("*").eq("department_id", deptId).order("full_name");
    if (data) setFaculty(data);
  };

  useEffect(() => { fetchFaculty(); }, [deptId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId) return;
    setLoading(true);
    const { data: newFac, error } = await supabase.from("faculty").insert({
      full_name: form.full_name, email: form.email, phone: form.phone || null,
      employee_id: form.employee_id, department_id: deptId, designation: form.designation,
      lab_qualified: form.lab_qualified, max_periods_per_day: parseInt(form.max_periods_per_day),
    }).select().single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (form.create_account && form.password && newFac) {
      const res = await supabase.functions.invoke("register-user", {
        body: { email: form.email, password: form.password, full_name: form.full_name, role: form.role, faculty_id: newFac.id },
      });
      if (res.error) toast.error("Faculty added but account creation failed");
      else toast.success(`Faculty added with ${form.role} login!`);
    } else {
      toast.success("Faculty added");
    }
    setLoading(false);
    setForm({ full_name: "", email: "", phone: "", employee_id: "", designation: "Assistant Professor", lab_qualified: false, max_periods_per_day: "6", create_account: false, password: "", role: "faculty" });
    setOpen(false);
    fetchFaculty();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setRegLoading(true);
    const res = await supabase.functions.invoke("register-user", {
      body: { email: selectedFaculty.email, password: regForm.password, full_name: selectedFaculty.full_name, role: regForm.role, faculty_id: selectedFaculty.id },
    });
    setRegLoading(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(`Login created for ${selectedFaculty.full_name}!`); setRegOpen(false); setRegForm({ password: "", role: "faculty" }); fetchFaculty(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("faculty").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchFaculty(); }
  };

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Department Faculty</h1><p className="text-muted-foreground">Manage faculty in {deptName}</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Faculty</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Faculty — {deptName}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Employee ID</Label><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Designation</Label>
                  <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Professor">Professor</SelectItem><SelectItem value="Associate Professor">Associate Professor</SelectItem><SelectItem value="Assistant Professor">Assistant Professor</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Max Periods/Day</Label><Input type="number" min="1" max="7" value={form.max_periods_per_day} onChange={(e) => setForm({ ...form, max_periods_per_day: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.lab_qualified} onCheckedChange={(v) => setForm({ ...form, lab_qualified: v })} /><Label>Lab Qualified</Label></div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-3"><Switch checked={form.create_account} onCheckedChange={(v) => setForm({ ...form, create_account: v })} /><Label className="flex items-center gap-1"><KeyRound className="h-3 w-3" />Create Login</Label></div>
                {form.create_account && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={form.create_account} minLength={6} /></div>
                    <div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="faculty">Faculty</SelectItem><SelectItem value="hod">HOD</SelectItem></SelectContent></Select></div>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Adding..." : "Add Faculty"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />{deptName} Faculty</CardTitle></CardHeader>
          <CardContent>
            {faculty.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No faculty yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Emp ID</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Login</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {faculty.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-sm">{f.employee_id}</TableCell>
                      <TableCell className="font-medium">{f.full_name}{f.is_hod && <Badge className="ml-2" variant="outline">HOD</Badge>}</TableCell>
                      <TableCell>{f.designation}</TableCell>
                      <TableCell>{f.user_id ? <Badge variant="default" className="text-xs">Active</Badge> : <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedFaculty(f); setRegOpen(true); }}><UserPlus className="h-3 w-3 mr-1" />Create</Button>}</TableCell>
                      <TableCell><Badge variant={f.is_active ? "default" : "destructive"}>{f.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Login for {selectedFaculty?.full_name}</DialogTitle></DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2"><Label>Email</Label><Input value={selectedFaculty?.email || ""} disabled /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} required minLength={6} /></div>
            <div className="space-y-2"><Label>Role</Label><Select value={regForm.role} onValueChange={(v) => setRegForm({ ...regForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="faculty">Faculty</SelectItem><SelectItem value="hod">HOD</SelectItem></SelectContent></Select></div>
            <Button type="submit" className="w-full" disabled={regLoading}>{regLoading ? "Creating..." : "Create Login"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
