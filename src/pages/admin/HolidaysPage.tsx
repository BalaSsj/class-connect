import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ holiday_date: "", name: "", type: "public", department_id: "all" });

  const fetchData = async () => {
    const [h, d] = await Promise.all([
      supabase.from("holidays").select("*, departments(name)").order("holiday_date"),
      supabase.from("departments").select("*").order("name"),
    ]);
    if (h.data) setHolidays(h.data);
    if (d.data) setDepartments(d.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("holidays").insert({
      holiday_date: form.holiday_date,
      name: form.name,
      type: form.type,
      department_id: form.department_id === "all" ? null : form.department_id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Holiday added!");
    setForm({ holiday_date: "", name: "", type: "public", department_id: "all" });
    setOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Holiday removed"); fetchData(); }
  };

  const typeColors: Record<string, string> = {
    public: "default",
    institutional: "secondary",
    exam: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Holidays & Calendar</h1>
          <p className="text-muted-foreground">Manage holidays — AI auto-assign & reallocation will skip these dates</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Holiday</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Holiday Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pongal, Republic Day" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public Holiday</SelectItem>
                    <SelectItem value="institutional">Institutional</SelectItem>
                    <SelectItem value="exam">Exam Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department (optional)</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Add Holiday</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> All Holidays ({holidays.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No holidays added yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => {
                    const date = new Date(h.holiday_date + "T00:00:00");
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{format(date, "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-muted-foreground">{format(date, "EEEE")}</TableCell>
                        <TableCell>{h.name}</TableCell>
                        <TableCell>
                          <Badge variant={(typeColors[h.type] || "secondary") as any} className="capitalize">{h.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{h.departments?.name || "All"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(h.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
