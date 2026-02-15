import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Calendar, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";

const COLORS = ["hsl(221, 83%, 53%)", "hsl(142, 76%, 36%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(270, 70%, 55%)"];

export default function AnalyticsPage() {
  const [leaveStats, setLeaveStats] = useState<any[]>([]);
  const [deptFaculty, setDeptFaculty] = useState<any[]>([]);
  const [workloadData, setWorkloadData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ faculty: 0, leaves: 0, reallocations: 0, slots: 0 });

  useEffect(() => {
    const load = async () => {
      // Leave stats by type
      const { data: leaves } = await supabase.from("leave_requests").select("leave_type, status");
      if (leaves) {
        const types: Record<string, { total: number; approved: number; rejected: number; pending: number }> = {};
        leaves.forEach((l) => {
          if (!types[l.leave_type]) types[l.leave_type] = { total: 0, approved: 0, rejected: 0, pending: 0 };
          types[l.leave_type].total++;
          types[l.leave_type][l.status as keyof typeof types[string]]++;
        });
        setLeaveStats(Object.entries(types).map(([type, data]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), ...data })));
      }

      // Faculty per department
      const { data: facs } = await supabase.from("faculty").select("departments(name)").eq("is_active", true);
      if (facs) {
        const depts: Record<string, number> = {};
        facs.forEach((f) => { const name = (f.departments as any)?.name || "Unknown"; depts[name] = (depts[name] || 0) + 1; });
        setDeptFaculty(Object.entries(depts).map(([name, value]) => ({ name, value })));
      }

      // Workload distribution
      const { data: slots } = await supabase.from("timetable_slots").select("faculty_id, faculty(full_name)");
      if (slots) {
        const counts: Record<string, { name: string; periods: number }> = {};
        slots.forEach((s) => {
          if (!counts[s.faculty_id]) counts[s.faculty_id] = { name: (s.faculty as any)?.full_name || "", periods: 0 };
          counts[s.faculty_id].periods++;
        });
        setWorkloadData(Object.values(counts).sort((a, b) => b.periods - a.periods).slice(0, 10));
      }

      // Totals
      const [fc, lc, rc, sc] = await Promise.all([
        supabase.from("faculty").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }),
        supabase.from("reallocations").select("id", { count: "exact", head: true }),
        supabase.from("timetable_slots").select("id", { count: "exact", head: true }),
      ]);
      setTotals({ faculty: fc.count || 0, leaves: lc.count || 0, reallocations: rc.count || 0, slots: sc.count || 0 });
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">System-wide statistics and insights</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Active Faculty", value: totals.faculty, icon: Users },
          { label: "Total Leaves", value: totals.leaves, icon: ClipboardList },
          { label: "Reallocations", value: totals.reallocations, icon: TrendingUp },
          { label: "Timetable Slots", value: totals.slots, icon: Calendar },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent><div className="text-3xl font-bold">{c.value}</div></CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader><CardTitle className="text-base">Leave Requests by Type</CardTitle></CardHeader>
            <CardContent>
              {leaveStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={leaveStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="type" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="approved" fill="hsl(142, 76%, 36%)" name="Approved" />
                    <Bar dataKey="pending" fill="hsl(38, 92%, 50%)" name="Pending" />
                    <Bar dataKey="rejected" fill="hsl(0, 84%, 60%)" name="Rejected" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground py-12 text-sm">No data yet</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader><CardTitle className="text-base">Faculty by Department</CardTitle></CardHeader>
            <CardContent>
              {deptFaculty.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={deptFaculty} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {deptFaculty.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground py-12 text-sm">No data yet</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader><CardTitle className="text-base">Top Faculty by Weekly Periods</CardTitle></CardHeader>
          <CardContent>
            {workloadData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workloadData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="periods" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12 text-sm">No timetable data yet</p>}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
