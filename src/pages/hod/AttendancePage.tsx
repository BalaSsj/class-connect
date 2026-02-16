import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Briefcase, ClipboardCheck } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AttendancePage() {
  const { user } = useAuth();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) setDeptId(fac.department_id);
    };
    loadDept();
  }, [user]);

  useEffect(() => {
    if (!deptId) return;
    const load = async () => {
      const [f, s] = await Promise.all([
        supabase.from("faculty").select("*").eq("department_id", deptId).eq("is_active", true).order("full_name"),
        supabase.from("timetable_slots").select("*, subjects(name, code), faculty(full_name)").order("period_number"),
      ]);
      if (f.data) setFaculty(f.data);
      if (s.data) setSlots(s.data);
    };
    load();
  }, [deptId]);

  useEffect(() => {
    if (!deptId) return;
    const loadAttendance = async () => {
      const { data } = await supabase.from("attendance").select("*").eq("attendance_date", selectedDate);
      if (data) setAttendance(data);
    };
    loadAttendance();
  }, [selectedDate, deptId]);

  const dayOfWeek = new Date(selectedDate).getDay();
  const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Mon...6=Sat, 7=Sun
  const todaySlots = slots.filter((s) => s.day_of_week === dayNum && faculty.some((f) => f.id === s.faculty_id));

  const getAttendanceStatus = (facultyId: string, slotId: string) => {
    const rec = attendance.find((a) => a.faculty_id === facultyId && a.timetable_slot_id === slotId);
    return rec?.status || null;
  };

  const markAttendance = async (facultyId: string, slotId: string, status: string) => {
    setSaving(true);
    const existing = attendance.find((a) => a.faculty_id === facultyId && a.timetable_slot_id === slotId && a.attendance_date === selectedDate);
    if (existing) {
      await supabase.from("attendance").update({ status }).eq("id", existing.id);
    } else {
      await supabase.from("attendance").insert({ faculty_id: facultyId, timetable_slot_id: slotId, attendance_date: selectedDate, status, marked_by: user?.id });
    }
    const { data } = await supabase.from("attendance").select("*").eq("attendance_date", selectedDate);
    if (data) setAttendance(data);
    setSaving(false);
    toast.success("Attendance updated");
  };

  const statusIcons: Record<string, any> = {
    present: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    absent: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    late: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    on_duty: { icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
  };

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Attendance Tracker</h1><p className="text-muted-foreground">Mark and track faculty attendance per period</p></div>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-48" />
      </div>

      {dayNum === 7 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sunday — No classes scheduled</CardContent></Card>
      ) : todaySlots.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No slots found for {DAYS[dayNum - 1]}</CardContent></Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {faculty.filter((f) => todaySlots.some((s) => s.faculty_id === f.id)).map((fac) => {
            const facSlots = todaySlots.filter((s) => s.faculty_id === fac.id).sort((a, b) => a.period_number - b.period_number);
            return (
              <Card key={fac.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    {fac.full_name} <Badge variant="outline" className="text-xs">{fac.designation}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {facSlots.map((slot) => {
                      const status = getAttendanceStatus(fac.id, slot.id);
                      const si = status ? statusIcons[status] : null;
                      return (
                        <div key={slot.id} className={`rounded-lg border p-3 space-y-2 ${si ? si.bg : "bg-muted/30"}`}>
                          <div className="text-xs font-medium">P{slot.period_number} — {slot.subjects?.code}</div>
                          {si && <div className="flex items-center gap-1"><si.icon className={`h-4 w-4 ${si.color}`} /><span className={`text-xs capitalize ${si.color}`}>{status}</span></div>}
                          <div className="flex flex-wrap gap-1">
                            {["present", "absent", "late", "on_duty"].map((s) => {
                              const Icon = statusIcons[s].icon;
                              return (
                                <Button key={s} variant={status === s ? "default" : "outline"} size="sm" className="h-6 px-1.5 text-[10px]"
                                  onClick={() => markAttendance(fac.id, slot.id, s)} disabled={saving}>
                                  <Icon className="h-3 w-3" />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
