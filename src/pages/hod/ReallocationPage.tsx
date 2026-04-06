import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { motion } from "framer-motion";

export default function ReallocationPage() {
  const { user } = useAuth();
  const [reallocations, setReallocations] = useState<any[]>([]);

  const fetchData = async () => {
    const { data } = await supabase
      .from("reallocations")
      .select(`
        *,
        original:faculty!reallocations_original_faculty_id_fkey(full_name),
        substitute:faculty!reallocations_substitute_faculty_id_fkey(full_name),
        timetable_slots(period_number, day_of_week, subjects(name, code))
      `)
      .order("created_at", { ascending: false });
    if (data) setReallocations(data);
  };

  useEffect(() => { fetchData(); }, []);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reallocations</h1>
        <p className="text-muted-foreground">AI auto-assigned substitutions — faculty can reject if busy (auto-reassigns)</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" /> AI Auto-Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reallocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No reallocations yet. Approve a leave request to trigger AI auto-assignment.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Substitute</TableHead>
                    <TableHead>AI Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reallocations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.reallocation_date}</TableCell>
                      <TableCell>{r.timetable_slots?.subjects?.code}</TableCell>
                      <TableCell>{DAYS[(r.timetable_slots?.day_of_week || 1) - 1]} P{r.timetable_slots?.period_number}</TableCell>
                      <TableCell>{r.original?.full_name}</TableCell>
                      <TableCell className="font-medium">{r.substitute?.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.score ? `${r.score}` : "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
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
