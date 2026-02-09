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
import { Plus, Trash2, Users } from "lucide-react";

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", employee_id: "", department_id: "",
    designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6",
  });

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
    const { error } = await supabase.from("faculty").insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      employee_id: form.employee_id,
      department_id: form.department_id,
      designation: form.designation,
      lab_qualified: form.lab_qualified,
      is_hod: form.is_hod,
      max_periods_per_day: parseInt(form.max_periods_per_day),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Faculty added");
    setForm({ full_name: "", email: "", phone: "", employee_id: "", department_id: "", designation: "Assistant Professor", lab_qualified: false, is_hod: false, max_periods_per_day: "6" });
    setOpen(false);
    fetchAll();
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
          <p className="text-muted-foreground">Manage faculty profiles and assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Faculty</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                  <Switch checked={form.is_hod} onCheckedChange={(v) => setForm({ ...form, is_hod: v })} />
                  <Label>Is HOD</Label>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !form.department_id}>
                {loading ? "Adding..." : "Add Faculty"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
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
    </div>
  );
}
