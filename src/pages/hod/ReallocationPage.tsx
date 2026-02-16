import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shuffle, CheckCircle, XCircle, Brain } from "lucide-react";
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

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("reallocations").update({
      status,
      approved_by: user?.id,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }

    // Notify substitute faculty
    const realloc = reallocations.find((r) => r.id === id);
    if (realloc && status === "approved") {
      // Get next uncovered topics for the subject
      const subjectId = realloc.timetable_slots?.subject_id;
      let nextTopicsMsg = "";
      if (subjectId) {
        const { data: nextTopics } = await supabase
          .from("syllabus_topics")
          .select("title, unit_number, topic_number")
          .eq("subject_id", subjectId)
          .eq("is_covered", false)
          .order("unit_number")
          .order("topic_number")
          .limit(3);
        if (nextTopics && nextTopics.length > 0) {
          nextTopicsMsg = `\n\nNext topics to cover:\n${nextTopics.map((t: any) => `• U${t.unit_number} T${t.topic_number}: ${t.title}`).join("\n")}`;
        }
      }

      const { data: subFac } = await supabase.from("faculty").select("user_id").eq("id", realloc.substitute_faculty_id).single();
      if (subFac?.user_id) {
        await supabase.from("notifications").insert({
          user_id: subFac.user_id,
          title: "Reallocation Assignment",
          message: `You have been assigned to substitute for ${realloc.original?.full_name} on ${realloc.reallocation_date} (${realloc.timetable_slots?.subjects?.name})${nextTopicsMsg}`,
          type: "info",
        });
      }
    }

    toast.success(`Reallocation ${status}`);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reallocations</h1>
        <p className="text-muted-foreground">AI-generated faculty substitution suggestions</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" /> AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reallocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No reallocations yet. Approve a leave request and click "Reallocate" to trigger AI suggestions.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Substitute</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
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
                        <Badge variant="secondary">{r.score ? `${r.score}%` : "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === "suggested" && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAction(r.id, "approved")}>
                              <CheckCircle className="h-4 w-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAction(r.id, "rejected")}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
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
