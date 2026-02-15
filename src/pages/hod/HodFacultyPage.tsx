import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

export default function HodFacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [workloads, setWorkloads] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("*, departments(name)").eq("is_active", true).order("full_name");
      if (f) {
        setFaculty(f);
        // Calculate workloads
        const { data: slots } = await supabase.from("timetable_slots").select("faculty_id");
        if (slots) {
          const counts: Record<string, number> = {};
          slots.forEach((s) => { counts[s.faculty_id] = (counts[s.faculty_id] || 0) + 1; });
          setWorkloads(counts);
        }
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faculty Overview</h1>
        <p className="text-muted-foreground">Department faculty and workload analysis</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Faculty Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Periods/Week</TableHead>
                  <TableHead>Workload</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faculty.map((f) => {
                  const periods = workloads[f.id] || 0;
                  const maxWeekly = f.max_periods_per_day * 6;
                  const pct = maxWeekly > 0 ? Math.round((periods / maxWeekly) * 100) : 0;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        {f.full_name}
                        {f.is_hod && <Badge className="ml-2" variant="outline">HOD</Badge>}
                      </TableCell>
                      <TableCell>{f.designation}</TableCell>
                      <TableCell>{periods} / {maxWeekly}</TableCell>
                      <TableCell className="w-32">
                        <Progress value={pct} className="h-2" />
                      </TableCell>
                      <TableCell>
                        <Badge variant={pct > 80 ? "destructive" : pct > 50 ? "secondary" : "default"}>
                          {pct > 80 ? "Heavy" : pct > 50 ? "Moderate" : "Light"}
                        </Badge>
                      </TableCell>
                    </TableRow>
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
