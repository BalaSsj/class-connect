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
import { Plus, Trash2, Users, UserPlus, KeyRound, Pencil, Filter, X, Eye, EyeOff, Copy, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState("all");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", employee_id: "", department_id: "",
    designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6",
    create_account: false, password: "", role: "faculty" as string, expertise: [] as string[],
  });
  const [editForm, setEditForm] = useState({
    full_name: "", email: "", phone: "", department_id: "",
    designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6",
    expertise: [] as string[],
  });
  const [regForm, setRegForm] = useState({ password: "", role: "faculty" });
  const [skillInput, setSkillInput] = useState("");
  const [editSkillInput, setEditSkillInput] = useState("");
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ password: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(true);
  const [lastIssuedPwd, setLastIssuedPwd] = useState<string | null>(null);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  };

  const openPwdReset = (f: any) => {
    setSelectedFaculty(f);
    setPwdForm({ password: generatePassword() });
    setLastIssuedPwd(null);
    setShowPwd(true);
    setPwdOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setPwdLoading(true);
    const res = await supabase.functions.invoke("register-user", {
      body: {
        email: selectedFaculty.email,
        password: pwdForm.password,
        full_name: selectedFaculty.full_name,
        role: selectedFaculty.is_hod ? "hod" : "faculty",
        faculty_id: selectedFaculty.id,
      },
    });
    setPwdLoading(false);
    if (res.error) {
      toast.error(res.error.message);
    } else {
      setLastIssuedPwd(pwdForm.password);
      toast.success(`Password reset for ${selectedFaculty.full_name}. Save it now — it cannot be retrieved later.`);
      fetchAll();
    }
  };

  const fetchAll = async () => {
    const [f, d] = await Promise.all([
      supabase.from("faculty").select("*, departments(name)").order("full_name"),
      supabase.from("departments").select("*").order("name"),
    ]);
    if (f.data) setFaculty(f.data);
    if (d.data) setDepartments(d.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = filterDept === "all" ? faculty : faculty.filter((f) => f.department_id === filterDept);

  const addSkill = (skill: string, target: "create" | "edit") => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    if (target === "create") {
      if (!form.expertise.includes(trimmed)) {
        setForm({ ...form, expertise: [...form.expertise, trimmed] });
      }
      setSkillInput("");
    } else {
      if (!editForm.expertise.includes(trimmed)) {
        setEditForm({ ...editForm, expertise: [...editForm.expertise, trimmed] });
      }
      setEditSkillInput("");
    }
  };

  const removeSkill = (skill: string, target: "create" | "edit") => {
    if (target === "create") {
      setForm({ ...form, expertise: form.expertise.filter(s => s !== skill) });
    } else {
      setEditForm({ ...editForm, expertise: editForm.expertise.filter(s => s !== skill) });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: newFaculty, error } = await supabase.from("faculty").insert({
      full_name: form.full_name, email: form.email, phone: form.phone || null,
      employee_id: form.employee_id, department_id: form.department_id,
      designation: form.designation, lab_qualified: form.lab_qualified,
      is_hod: form.is_hod, max_periods_per_day: parseInt(form.max_periods_per_day),
      expertise: form.expertise.length > 0 ? form.expertise : null,
    }).select().single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (form.create_account && form.password && newFaculty) {
      const res = await supabase.functions.invoke("register-user", {
        body: { email: form.email, password: form.password, full_name: form.full_name, role: form.role, faculty_id: newFaculty.id },
      });
      if (res.error) toast.error("Faculty added but account creation failed: " + res.error.message);
      else toast.success(`Faculty added with ${form.role} login account!`);
    } else {
      toast.success("Faculty added (no login account)");
    }
    setLoading(false);
    setForm({ full_name: "", email: "", phone: "", employee_id: "", department_id: "", designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6", create_account: false, password: "", role: "faculty", expertise: [] });
    setOpen(false); fetchAll();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setLoading(true);
    const { error } = await supabase.from("faculty").update({
      full_name: editForm.full_name, email: editForm.email, phone: editForm.phone || null,
      department_id: editForm.department_id, designation: editForm.designation,
      lab_qualified: editForm.lab_qualified, is_hod: editForm.is_hod,
      max_periods_per_day: parseInt(String(editForm.max_periods_per_day)),
      expertise: editForm.expertise.length > 0 ? editForm.expertise : null,
    }).eq("id", selectedFaculty.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Faculty updated!");
    setEditOpen(false); fetchAll();
  };

  const openEdit = (f: any) => {
    setSelectedFaculty(f);
    setEditForm({
      full_name: f.full_name, email: f.email, phone: f.phone || "",
      department_id: f.department_id, designation: f.designation,
      lab_qualified: f.lab_qualified, is_hod: f.is_hod,
      max_periods_per_day: String(f.max_periods_per_day),
      expertise: f.expertise || [],
    });
    setEditSkillInput("");
    setEditOpen(true);
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
    else { toast.success(`Login account created for ${selectedFaculty.full_name}!`); setRegOpen(false); setRegForm({ password: "", role: "faculty" }); fetchAll(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("faculty").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchAll(); }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from("faculty").update({ is_active: !currentStatus }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(currentStatus ? "Faculty deactivated" : "Faculty activated"); fetchAll(); }
  };

  const SkillTagInput = ({ skills, input, setInput, target }: { skills: string[]; input: string; setInput: (v: string) => void; target: "create" | "edit" }) => (
    <div className="space-y-2">
      <Label>Skills / Expertise</Label>
      <div className="flex flex-wrap gap-1 mb-2">
        {skills.map((s, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-1">
            {s}
            <button type="button" onClick={() => removeSkill(s, target)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Python, Java, DBMS, ML..."
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill(input, target);
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => addSkill(input, target)}>Add</Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Press Enter or comma to add. Used for AI timetable matching.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Management</h1>
          <p className="text-muted-foreground">Manage faculty profiles, skills, and login accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Faculty</Button></DialogTrigger>
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
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
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
                <SkillTagInput skills={form.expertise} input={skillInput} setInput={setSkillInput} target="create" />
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
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Faculty ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No faculty members found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-sm">{f.employee_id}</TableCell>
                        <TableCell className="font-medium">
                          {f.full_name}
                          {f.is_hod && <Badge className="ml-2" variant="outline">HOD</Badge>}
                          <div className="text-[10px] text-muted-foreground">{f.designation}</div>
                        </TableCell>
                        <TableCell>{(f.departments as any)?.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(f.expertise || []).slice(0, 4).map((s: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                            ))}
                            {(f.expertise || []).length > 4 && <Badge variant="outline" className="text-[10px]">+{f.expertise.length - 4}</Badge>}
                            {(!f.expertise || f.expertise.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {f.user_id ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedFaculty(f); setRegForm({ password: "", role: f.is_hod ? "hod" : "faculty" }); setRegOpen(true); }}>
                              <UserPlus className="h-3 w-3 mr-1" />Create
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={f.is_active ? "default" : "destructive"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(f.id, f.is_active)}
                          >
                            {f.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(f)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {f.user_id && (
                              <Button variant="ghost" size="icon" onClick={() => openPwdReset(f)} title="Reset password">
                                <KeyRound className="h-4 w-4 text-warning" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)} title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Faculty Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Faculty — {selectedFaculty?.full_name}</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Full Name</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select value={editForm.designation} onValueChange={(v) => setEditForm({ ...editForm, designation: v })}>
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
                <Input type="number" min="1" max="7" value={editForm.max_periods_per_day} onChange={(e) => setEditForm({ ...editForm, max_periods_per_day: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editForm.lab_qualified} onCheckedChange={(v) => setEditForm({ ...editForm, lab_qualified: v })} />
                <Label>Lab Qualified</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editForm.is_hod} onCheckedChange={(v) => setEditForm({ ...editForm, is_hod: v })} />
                <Label>Is HOD</Label>
              </div>
            </div>
            <SkillTagInput skills={editForm.expertise} input={editSkillInput} setInput={setEditSkillInput} target="edit" />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Reset Password Dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-warning" />
              Reset Password — {selectedFaculty?.full_name}
            </DialogTitle>
          </DialogHeader>
          {lastIssuedPwd ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-2">
                <p className="text-xs font-medium text-warning-foreground">
                  ⚠️ Password set successfully. Copy it now — for security, hashed passwords cannot be retrieved later.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-background font-mono text-sm break-all">{lastIssuedPwd}</code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(lastIssuedPwd);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Email: <span className="font-mono">{selectedFaculty?.email}</span>
                </p>
              </div>
              <Button className="w-full" onClick={() => setPwdOpen(false)}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-xs text-muted-foreground rounded-md bg-muted p-3">
                For security, stored passwords are hashed and cannot be displayed. Set a new password below — it will be shown to you once so you can share it with the faculty.
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedFaculty?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={pwdForm.password}
                      onChange={(e) => setPwdForm({ password: e.target.value })}
                      minLength={6}
                      required
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPwdForm({ password: generatePassword() })}
                    title="Generate"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pwdLoading}>
                {pwdLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
