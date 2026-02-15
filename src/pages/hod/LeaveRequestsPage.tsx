import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ClipboardList, CheckCircle, XCircle, Shuffle } from "lucide-react";
import { motion } from "framer-motion";

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("leave_requests")
      .select("*, faculty(full_name, employee_id, departments(name))")
      .order("created_at", { ascending: false });
    if (data) setRequests(data);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selected || !user) return;
    const { error } = await supabase.from("leave_requests").update({
      status,
      approved_by: user.id,
    }).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }

    // Create notification for faculty
    const { data: fac } = await supabase.from("faculty").select("user_id").eq("id", selected.faculty_id).single();
    if (fac?.user_id) {
      await supabase.from("notifications").insert({
        user_id: fac.user_id,
        title: `Leave ${status}`,
        message: `Your ${selected.leave_type} leave from ${selected.start_date} to ${selected.end_date} has been ${status}.${remarks ? ` Remarks: ${remarks}` : ""}`,
        type: status === "approved" ? "success" : "warning",
      });
    }

    toast.success(`Leave ${status}`);
    setDialogOpen(false);
    setRemarks("");
    fetchRequests();
  };

  const triggerReallocation = async (leaveId: string) => {
    // Find affected timetable slots
    const leave = requests.find((r) => r.id === leaveId);
    if (!leave) return;

    const { data: slots } = await supabase
      .from("timetable_slots")
      .select("*")
      .eq("faculty_id", leave.faculty_id);

    if (!slots || slots.length === 0) {
      toast.info("No timetable slots to reallocate");
      return;
    }

    // Call AI reallocation edge function
    const res = await supabase.functions.invoke("ai-reallocate", {
      body: { leave_request_id: leaveId, faculty_id: leave.faculty_id, start_date: leave.start_date, end_date: leave.end_date },
    });

    if (res.error) {
      toast.error("Reallocation failed: " + res.error.message);
    } else {
      toast.success(`AI generated ${res.data?.count || 0} reallocation suggestions!`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
        <p className="text-muted-foreground">Review and manage faculty leave applications</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />All Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No leave requests</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.faculty?.full_name}</TableCell>
                      <TableCell className="capitalize">{r.leave_type}</TableCell>
                      <TableCell>{r.start_date}</TableCell>
                      <TableCell>{r.end_date}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{r.reason}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === "pending" && (
                            <Button variant="ghost" size="sm" onClick={() => { setSelected(r); setDialogOpen(true); }}>
                              Review
                            </Button>
                          )}
                          {r.status === "approved" && (
                            <Button variant="outline" size="sm" onClick={() => triggerReallocation(r.id)}>
                              <Shuffle className="h-3 w-3 mr-1" /> Reallocate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Faculty:</span> {selected.faculty?.full_name}</div>
                <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{selected.leave_type}</span></div>
                <div><span className="text-muted-foreground">From:</span> {selected.start_date}</div>
                <div><span className="text-muted-foreground">To:</span> {selected.end_date}</div>
              </div>
              <div className="text-sm"><span className="text-muted-foreground">Reason:</span> {selected.reason}</div>
              <div className="space-y-2">
                <Label>Remarks (optional)</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks..." rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleAction("approved")} className="flex-1">
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => handleAction("rejected")} className="flex-1">
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
