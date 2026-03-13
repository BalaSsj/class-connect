import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ClipboardList, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_COLORS: Record<string, string> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default function LeaveApplicationPage() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", start_date: "", end_date: "", reason: "" });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("id").eq("user_id", user.id).single();
      if (f) {
        setFaculty(f);
        const { data: l } = await supabase.from("leave_requests").select("*").eq("faculty_id", f.id).order("created_at", { ascending: false });
        if (l) setLeaves(l);
      }
    };
    load();
  }, [user]);

  const hasPendingLeave = leaves.some(l => l.status === "pending");

  const hasOverlap = (startDate: string, endDate: string) => {
    return leaves.some(l => {
      if (l.status === "rejected") return false;
      return l.start_date <= endDate && l.end_date >= startDate;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faculty) { toast.error("Faculty profile not found"); return; }
    
    // Check for pending requests
    if (hasPendingLeave) {
      toast.error("You already have a pending leave request. Please wait for it to be processed.");
      return;
    }

    // Check for overlapping dates
    if (hasOverlap(form.start_date, form.end_date)) {
      toast.error("You already have a leave request for overlapping dates.");
      return;
    }

    if (form.start_date > form.end_date) {
      toast.error("End date must be after start date");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("leave_requests").insert({
      faculty_id: faculty.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Leave request submitted!");
    setOpen(false);
    setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
    const { data: l } = await supabase.from("leave_requests").select("*").eq("faculty_id", faculty.id).order("created_at", { ascending: false });
    if (l) setLeaves(l);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave & OD Requests</h1>
          <p className="text-muted-foreground">Apply for leave or on-duty</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={hasPendingLeave}>
              <Plus className="mr-2 h-4 w-4" />Apply Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
            {hasPendingLeave && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <span className="text-sm text-amber-700 dark:text-amber-300">You already have a pending leave request.</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="medical">Medical Leave</SelectItem>
                    <SelectItem value="earned">Earned Leave</SelectItem>
                    <SelectItem value="od">On Duty (OD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Provide reason..." required rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || hasPendingLeave}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />My Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No leave requests yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="capitalize font-medium">{l.leave_type}</TableCell>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{l.end_date}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{l.reason}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[l.status] as any} className="capitalize">{l.status}</Badge>
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
