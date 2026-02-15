import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ClipboardList, Bell, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIOD_TIMES = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:30-2:20", "2:20-3:10", "3:10-4:00"];

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any>(null);
  const [todaySlots, setTodaySlots] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("*").eq("user_id", user.id).single();
      if (!f) return;
      setFaculty(f);
      const today = new Date().getDay(); // 0=Sun, 1=Mon...
      const dayOfWeek = today === 0 ? 7 : today; // Map to 1-6, 7=Sun
      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("*, subjects(name, code, is_lab), years_sections(year, section, departments(name))")
        .eq("faculty_id", f.id)
        .eq("day_of_week", dayOfWeek)
        .order("period_number");
      if (slots) setTodaySlots(slots);

      const { count: lc } = await supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("faculty_id", f.id).eq("status", "pending");
      setPendingLeaves(lc || 0);

      const { count: nc } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnreadNotifs(nc || 0);
    };
    load();
  }, [user]);

  const todayName = DAYS[new Date().getDay() - 1] || "Sunday";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Welcome{faculty ? `, ${faculty.full_name}` : ""}</h1>
        <p className="text-muted-foreground">Your schedule and updates for {todayName}</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Classes Today", value: todaySlots.length, icon: Calendar, color: "text-primary" },
          { label: "Pending Leaves", value: pendingLeaves, icon: ClipboardList, color: "text-warning" },
          { label: "Unread Notifications", value: unreadNotifs, icon: Bell, color: "text-destructive" },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{c.value}</div></CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" /> Today's Schedule — {todayName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No classes scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todaySlots.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-muted-foreground">Period {slot.period_number}</div>
                      <div className="text-xs font-mono">{PERIOD_TIMES[slot.period_number - 1]}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{slot.subjects?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {slot.subjects?.code} • Year {slot.years_sections?.year} Sec {slot.years_sections?.section}
                      </div>
                    </div>
                    {slot.is_lab && <Badge variant="secondary">LAB</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
