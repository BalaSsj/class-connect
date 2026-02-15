import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Shuffle, Users, Calendar, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function HodDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pendingLeaves: 0, activeReallocations: 0, activeFaculty: 0, totalSlots: 0 });
  const [recentLeaves, setRecentLeaves] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [pl, ar, af, ts, rl] = await Promise.all([
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reallocations").select("id", { count: "exact", head: true }).in("status", ["suggested", "approved"]),
        supabase.from("faculty").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("timetable_slots").select("id", { count: "exact", head: true }),
        supabase.from("leave_requests").select("*, faculty(full_name)").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        pendingLeaves: pl.count || 0,
        activeReallocations: ar.count || 0,
        activeFaculty: af.count || 0,
        totalSlots: ts.count || 0,
      });
      if (rl.data) setRecentLeaves(rl.data);
    };
    load();
  }, []);

  const cards = [
    { label: "Pending Leaves", value: stats.pendingLeaves, icon: ClipboardList, color: "text-warning" },
    { label: "Active Reallocations", value: stats.activeReallocations, icon: Shuffle, color: "text-primary" },
    { label: "Active Faculty", value: stats.activeFaculty, icon: Users, color: "text-success" },
    { label: "Timetable Slots", value: stats.totalSlots, icon: Calendar, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">HOD Dashboard</h1>
        <p className="text-muted-foreground">Department overview and management</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
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

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Recent Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent leave requests</p>
            ) : (
              <div className="space-y-3">
                {recentLeaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <div className="text-sm font-medium">{l.faculty?.full_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{l.leave_type} • {l.start_date} to {l.end_date}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${l.status === "pending" ? "bg-warning/10 text-warning" : l.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {l.status}
                    </span>
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
