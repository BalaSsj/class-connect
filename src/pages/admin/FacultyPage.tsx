import { useEffect, useState } from "react";
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

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", employee_id: "", department_id: "",
    designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6",
    create_account: false, password: "", role: "faculty" as string,
  });
  const [regForm, setRegForm] = useState({ password: "", role: "faculty" });

  const fetchAll = async () => {
    const [f, d] = await Promise.all([
      supabase.from("faculty").select("*, departments(name)").order("full_name"),
      supabase.from("departments").select("*").order("name"),
    ]);
    if (f.data) setFaculty(f.data);
    if (d.data) setDepartments(d.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Create faculty record
    const { data: newFaculty, error } = await supabase.from("faculty").insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      employee_id: form.employee_id,
      department_id: form.department_id,
      designation: form.designation,
      lab_qualified: form.lab_qualified,
      is_hod: form.is_hod,
      max_periods_per_day: parseInt(form.max_periods_per_day),
    }).select().single();

    if (error) { toast.error(error.message); setLoading(false); return; }

    // Create login account if requested
    if (form.create_account && form.password && newFaculty) {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("register-user", {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          faculty_id: newFaculty.id,
        },
      });

      if (res.error) {
        toast.error("Faculty added but account creation failed: " + res.error.message);
      } else {
        toast.success(`Faculty added with ${form.role} login account!`);
      }
    } else {
      toast.success("Faculty added (no login account)");
    }

    setLoading(false);
    setForm({ full_name: "", email: "", phone: "", employee_id: "", department_id: "", designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6", create_account: false, password: "", role: "faculty" });
    setOpen(false);
    fetchAll();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setRegLoading(true);

    const res = await supabase.functions.invoke("register-user", {
      body: {
        email: selectedFaculty.email,
        password: regForm.password,
        full_name: selectedFaculty.full_name,
        role: regForm.role,
        faculty_id: selectedFaculty.id,
      },
    });

    setRegLoading(false);
    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success(`Login account created for ${selectedFaculty.full_name}!`);
      setRegOpen(false);
      setRegForm({ password: "", role: "faculty" });
      fetchAll();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("faculty").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchAll(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Management</h1>
          <p className="text-muted-foreground">Manage faculty profiles, login accounts, and assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Faculty</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Faculty Member</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Full Name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. John Doe" required />
                </div>
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="EMP001" required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@adhiyamaan.ac.in" required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Professor">Professor</SelectItem>
                      <SelectItem value="Associate Professor">Associate Professor</SelectItem>
                      <SelectItem value="Assistant Professor">Assistant Professor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Periods/Day</Label>
                  <Input type="number" min="1" max="7" value={form.max_periods_per_day} onChange={(e) => setForm({ ...form, max_periods_per_day: e.target.value })} required />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.lab_qualified} onCheckedChange={(v) => setForm({ ...form, lab_qualified: v })} />
                  <Label>Lab Qualified</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_hod} onCheckedChange={(v) => setForm({ ...form, is_hod: v, role: v ? "hod" : "faculty" })} />
                  <Label>Is HOD</Label>
                </div>
              </div>

              {/* Login Account Section */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Switch checked={form.create_account} onCheckedChange={(v) => setForm({ ...form, create_account: v })} />
                  <Label className="flex items-center gap-1"><KeyRound className="h-3 w-3" />Create Login Account</Label>
                </div>
                {form.create_account && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required={form.create_account} minLength={6} />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faculty">Faculty</SelectItem>
                          <SelectItem value="hod">HOD</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading || !form.department_id}>
                {loading ? "Adding..." : "Add Faculty"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> All Faculty</CardTitle>
          </CardHeader>
          <CardContent>
            {faculty.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No faculty members yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faculty.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-sm">{f.employee_id}</TableCell>
                      <TableCell className="font-medium">
                        {f.full_name}
                        {f.is_hod && <Badge className="ml-2" variant="outline">HOD</Badge>}
                      </TableCell>
                      <TableCell>{(f.departments as any)?.name}</TableCell>
                      <TableCell>{f.designation}</TableCell>
                      <TableCell>
                        {f.user_id ? (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        ) : (
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedFaculty(f); setRegOpen(true); }}>
                            <UserPlus className="h-3 w-3 mr-1" />Create
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.is_active ? "default" : "destructive"}>
                          {f.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Register User Dialog */}
      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Login for {selectedFaculty?.full_name}</DialogTitle></DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={selectedFaculty?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} placeholder="Min 6 characters" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={regForm.role} onValueChange={(v) => setRegForm({ ...regForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="hod">HOD</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={regLoading}>
              {regLoading ? "Creating..." : "Create Login Account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
