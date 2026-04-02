import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function HodFacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [workloads, setWorkloads] = useState<Record<string, number>>({});
  const [facultySubjects, setFacultySubjects] = useState<Record<string, any[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("*, departments(name)").eq("is_active", true).order("full_name");
      if (f) {
        setFaculty(f);
        const { data: slots } = await supabase.from("timetable_slots").select("faculty_id");
        if (slots) {
          const counts: Record<string, number> = {};
          slots.forEach((s) => { counts[s.faculty_id] = (counts[s.faculty_id] || 0) + 1; });
          setWorkloads(counts);
        }
        // Load faculty subjects
        const { data: fs } = await supabase
          .from("faculty_subjects")
          .select("faculty_id, subjects(name, code, is_lab, semester, year)");
        if (fs) {
          const map: Record<string, any[]> = {};
          fs.forEach((x: any) => {
            if (!map[x.faculty_id]) map[x.faculty_id] = [];
            if (x.subjects) map[x.faculty_id].push(x.subjects);
          });
          setFacultySubjects(map);
        }
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faculty Overview</h1>
        <p className="text-muted-foreground">Department faculty, workload, and subject expertise</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Faculty Workload & Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Periods/Week</TableHead>
                  <TableHead>Workload</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faculty.map((f) => {
                  const periods = workloads[f.id] || 0;
                  const maxWeekly = f.max_periods_per_day * 6;
                  const pct = maxWeekly > 0 ? Math.round((periods / maxWeekly) * 100) : 0;
                  const subs = facultySubjects[f.id] || [];
                  const isExpanded = expandedId === f.id;
                  return (
                    <>
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {f.full_name}
                          {f.is_hod && <Badge className="ml-2" variant="outline">HOD</Badge>}
                        </TableCell>
                        <TableCell>{f.designation}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {subs.slice(0, 3).map((s: any, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {s.code}{s.is_lab ? " 🧪" : ""}
                              </Badge>
                            ))}
                            {subs.length > 3 && <Badge variant="outline" className="text-[10px]">+{subs.length - 3}</Badge>}
                            {subs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>{periods} / {maxWeekly}</TableCell>
                        <TableCell className="w-32">
                          <Progress value={pct} className="h-2" />
                        </TableCell>
                        <TableCell>
                          <Badge variant={pct > 80 ? "destructive" : pct > 50 ? "secondary" : "default"}>
                            {pct > 80 ? "Heavy" : pct > 50 ? "Moderate" : "Light"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subs.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${f.id}-details`}>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="p-2 space-y-2">
                              <div className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                <BookOpen className="h-3 w-3" /> Subjects Handling
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {subs.map((s: any, i: number) => (
                                  <div key={i} className="text-xs p-2 rounded border bg-background">
                                    <div className="font-medium">{s.name}</div>
                                    <div className="text-muted-foreground">{s.code} • Sem {s.semester} • Year {s.year}</div>
                                    {s.is_lab && <Badge variant="outline" className="text-[9px] mt-1">Lab</Badge>}
                                  </div>
                                ))}
                              </div>
                              {f.expertise && f.expertise.length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Expertise</div>
                                  <div className="flex flex-wrap gap-1">
                                    {f.expertise.map((e: string, i: number) => (
                                      <Badge key={i} variant="outline" className="text-[10px]">{e}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
