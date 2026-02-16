import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Users, Search, Filter } from "lucide-react";
import { motion } from "framer-motion";

export default function FacultyFilterPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [workloads, setWorkloads] = useState<Record<string, number>>({});
  const [facultySubjects, setFacultySubjects] = useState<Record<string, string[]>>({});

  // Filters
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [labFilter, setLabFilter] = useState<boolean | null>(null);
  const [hodFilter, setHodFilter] = useState<boolean | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [workloadFilter, setWorkloadFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [f, d, s, slots, fs] = await Promise.all([
        supabase.from("faculty").select("*, departments(name)").order("full_name"),
        supabase.from("departments").select("*").order("name"),
        supabase.from("subjects").select("*").order("name"),
        supabase.from("timetable_slots").select("faculty_id"),
        supabase.from("faculty_subjects").select("faculty_id, subjects(name)"),
      ]);
      if (f.data) setFaculty(f.data);
      if (d.data) setDepartments(d.data);
      if (s.data) setSubjects(s.data);

      if (slots.data) {
        const counts: Record<string, number> = {};
        slots.data.forEach((s: any) => { counts[s.faculty_id] = (counts[s.faculty_id] || 0) + 1; });
        setWorkloads(counts);
      }

      if (fs.data) {
        const map: Record<string, string[]> = {};
        fs.data.forEach((r: any) => {
          if (!map[r.faculty_id]) map[r.faculty_id] = [];
          map[r.faculty_id].push((r.subjects as any)?.name || "");
        });
        setFacultySubjects(map);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return faculty.filter(f => {
      if (search && !f.full_name.toLowerCase().includes(search.toLowerCase()) && !f.employee_id.toLowerCase().includes(search.toLowerCase())) return false;
      if (deptFilter !== "all" && f.department_id !== deptFilter) return false;
      if (designationFilter !== "all" && f.designation !== designationFilter) return false;
      if (labFilter !== null && f.lab_qualified !== labFilter) return false;
      if (hodFilter !== null && f.is_hod !== hodFilter) return false;
      if (subjectFilter !== "all") {
        const subs = facultySubjects[f.id] || [];
        if (!subs.some(s => s.toLowerCase().includes(subjectFilter.toLowerCase()))) return false;
      }
      if (workloadFilter !== "all") {
        const periods = workloads[f.id] || 0;
        const max = f.max_periods_per_day * 6;
        const pct = max > 0 ? (periods / max) * 100 : 0;
        if (workloadFilter === "light" && pct > 50) return false;
        if (workloadFilter === "moderate" && (pct <= 50 || pct > 80)) return false;
        if (workloadFilter === "heavy" && pct <= 80) return false;
      }
      return true;
    });
  }, [faculty, search, deptFilter, designationFilter, labFilter, hodFilter, subjectFilter, workloadFilter, workloads, facultySubjects]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faculty Directory</h1>
        <p className="text-muted-foreground">Search and filter all faculty members</p>
      </div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4" />Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Search className="h-3 w-3" />Search</Label>
                <Input placeholder="Name or Employee ID" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select value={designationFilter} onValueChange={setDesignationFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Professor">Professor</SelectItem>
                    <SelectItem value="Associate Professor">Associate Professor</SelectItem>
                    <SelectItem value="Assistant Professor">Assistant Professor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Workload</Label>
                <Select value={workloadFilter} onValueChange={setWorkloadFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="light">Light (&lt;50%)</SelectItem>
                    <SelectItem value="moderate">Moderate (50-80%)</SelectItem>
                    <SelectItem value="heavy">Heavy (&gt;80%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={labFilter === true} onCheckedChange={v => setLabFilter(v ? true : null)} />
                <Label>Lab Qualified</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={hodFilter === true} onCheckedChange={v => setHodFilter(v ? true : null)} />
                <Label>HOD Only</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Users className="h-4 w-4" />Results</span>
              <Badge variant="outline">{filtered.length} / {faculty.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No faculty match the filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Workload</TableHead>
                    <TableHead>Lab</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(f => {
                    const periods = workloads[f.id] || 0;
                    const max = f.max_periods_per_day * 6;
                    const pct = max > 0 ? Math.round((periods / max) * 100) : 0;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-sm">{f.employee_id}</TableCell>
                        <TableCell className="font-medium">
                          {f.full_name}
                          {f.is_hod && <Badge className="ml-2" variant="outline">HOD</Badge>}
                        </TableCell>
                        <TableCell>{(f.departments as any)?.name}</TableCell>
                        <TableCell className="text-sm">{f.designation}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 w-16" />
                            <span className="text-xs text-muted-foreground">{periods}/{max}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {f.lab_qualified ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.is_active ? "default" : "destructive"} className="text-xs">
                            {f.is_active ? "Active" : "Inactive"}
                          </Badge>
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
