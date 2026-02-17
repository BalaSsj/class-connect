import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Layers, Filter } from "lucide-react";

export default function YearsSectionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState("all");
  const [deptId, setDeptId] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    const [s, d] = await Promise.all([
      supabase.from("years_sections").select("*, departments(name)").order("year"),
      supabase.from("departments").select("*").order("name"),
    ]);
    if (s.data) setItems(s.data);
    if (d.data) setDepartments(d.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = filterDept === "all" ? items : items.filter((i) => i.department_id === filterDept);

  // Group by department
  const grouped = filtered.reduce((acc: Record<string, any[]>, item: any) => {
    const deptName = (item.departments as any)?.name || "Unknown";
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(item);
    return acc;
  }, {});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("years_sections").insert({
      department_id: deptId, year: parseInt(year), section: section.toUpperCase(),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Section added");
    setSection(""); setOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("years_sections").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchAll(); }
  };

  const ordinal = (y: number) => y === 1 ? "st" : y === 2 ? "nd" : y === 3 ? "rd" : "th";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Years & Sections</h1>
          <p className="text-muted-foreground">Manage year/section combinations per department</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Section</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Year & Section</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={deptId} onValueChange={setDeptId}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4].map((y) => <SelectItem key={y} value={String(y)}>{y}{ordinal(y)} Year</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="A" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !deptId || !year}>
                  {loading ? "Adding..." : "Add Section"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">No sections found.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).sort().map(([deptName, sections]) => (
          <Card key={deptName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" /> {deptName}
                <span className="text-xs text-muted-foreground font-normal ml-auto">{(sections as any[]).length} section(s)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sections as any[]).sort((a: any, b: any) => a.year - b.year || a.section.localeCompare(b.section)).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.year}{ordinal(s.year)} Year</TableCell>
                      <TableCell className="font-medium">{s.section}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
