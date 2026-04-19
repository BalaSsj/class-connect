import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shuffle, BookOpen, Clock, ArrowRight, XCircle, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MyReallocationsPage() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any>(null);
  const [reallocations, setReallocations] = useState<any[]>([]);
  const [topicsToCover, setTopicsToCover] = useState<Record<string, any[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = async () => {
    if (!user) return;
    const { data: f } = await supabase.from("faculty").select("id").eq("user_id", user.id).single();
    if (!f) return;
    setFaculty(f);

    const { data: reallocs } = await supabase
      .from("reallocations")
      .select(`
        *,
        original:faculty!reallocations_original_faculty_id_fkey(full_name),
        timetable_slots(period_number, day_of_week, subject_id, subjects(name, code))
      `)
      .eq("substitute_faculty_id", f.id)
      .in("status", ["pending", "approved"])
      .order("reallocation_date", { ascending: true });

    if (reallocs) {
      setReallocations(reallocs);
      const subjectIds = [...new Set(reallocs.map((r) => r.timetable_slots?.subject_id).filter(Boolean))];
      const topicsMap: Record<string, any[]> = {};
      for (const subjectId of subjectIds) {
        const { data: topics } = await supabase
          .from("syllabus_topics")
          .select("*")
          .eq("subject_id", subjectId)
          .eq("is_covered", false)
          .order("unit_number")
          .order("topic_number")
          .limit(3);
        if (topics) topicsMap[subjectId] = topics;
      }
      setTopicsToCover(topicsMap);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const handleConfirm = async (reallocationId: string) => {
    setBusyId(reallocationId);
    try {
      const { data, error } = await supabase.functions.invoke("ai-reallocate", {
        body: { confirm_reallocation_id: reallocationId },
      });
      if (error) throw error;
      if (data?.success) toast.success("Confirmed — you're set!");
      else toast.warning(data?.message || "Could not confirm");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (r: any) => {
    setRejectTarget(r);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    setRejectDialogOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-reallocate", {
        body: { reject_reallocation_id: rejectTarget.id, reason: rejectReason },
      });
      if (error) throw error;
      if (data?.success) toast.success(data.message || "Reassigned to another faculty");
      else toast.warning(data?.message || "No substitute found");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setBusyId(null);
      setRejectTarget(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Substitutions</h1>
        <p className="text-muted-foreground">Respond to each request: I am Free or Not Free</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {reallocations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Shuffle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No active substitution assignments
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reallocations.map((r) => {
              const subjectId = r.timetable_slots?.subject_id;
              const nextTopics = subjectId ? topicsToCover[subjectId] || [] : [];
              const isBusy = busyId === r.id;
              const isPending = r.status === "pending";

              return (
                <Card key={r.id} className={isPending ? "border-warning/40" : "border-primary/20"}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shuffle className="h-4 w-4 text-primary" />
                        Substituting for {r.original?.full_name}
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isPending ? "secondary" : "default"}>{r.reallocation_date}</Badge>
                        <Badge variant={isPending ? "outline" : "default"} className="capitalize">{r.status}</Badge>
                        {isPending && (
                          <>
                            <Button size="sm" disabled={isBusy} onClick={() => handleConfirm(r.id)}>
                              {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                              I am Free
                            </Button>
                            <Button variant="destructive" size="sm" disabled={isBusy} onClick={() => openReject(r)}>
                              <XCircle className="h-3 w-3 mr-1" /> Not Free
                            </Button>
                          </>
                        )}
                        {!isPending && (
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={() => openReject(r)}>
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Can't Attend
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {DAYS[(r.timetable_slots?.day_of_week || 1) - 1]} Period {r.timetable_slots?.period_number}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {r.timetable_slots?.subjects?.code} — {r.timetable_slots?.subjects?.name}
                      </span>
                    </div>

                    {nextTopics.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <BookOpen className="h-3 w-3" /> Next Topics to Cover:
                        </div>
                        {nextTopics.map((topic) => (
                          <div key={topic.id} className="flex items-center gap-2 text-sm">
                            <Clock className="h-3 w-3 text-warning" />
                            <span>Unit {topic.unit_number}, Topic {topic.topic_number}: {topic.title}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {r.notes && (
                      <p className="text-xs text-muted-foreground italic">{r.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not Free — please share a reason</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. I have another commitment that period"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              The system will automatically try the next available suitable faculty.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}>Submit & Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
