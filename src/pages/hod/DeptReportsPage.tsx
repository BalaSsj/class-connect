import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, BookOpen, ClipboardList, TrendingUp, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(221,83%,53%)", "hsl(142,76%,36%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)", "hsl(262,83%,58%)"];

export default function DeptReportsPage() {
  const { user } = useAuth();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [workloadData, setWorkloadData] = useState<any[]>([]);
  const [syllabusData, setSyllabusData] = useState<any[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<any[]>([]);
  const [stats, setStats] = useState({ faculty: 0, subjects: 0, syllabusComplete: 0, pendingLeaves: 0 });

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id, departments(name)").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) { setDeptId(fac.department_id); setDeptName((fac.departments as any)?.name || ""); }
    };
    loadDept();
  }, [user]);

  useEffect(() => {
    if (!deptId) return;
    const load = async () => {
      const [fac, sub, slots, topics, leaves] = await Promise.all([
        supabase.from("faculty").select("id, full_name, max_periods_per_day").eq("department_id", deptId).eq("is_active", true),
        supabase.from("subjects").select("id, name, code").eq("department_id", deptId),
        supabase.from("timetable_slots").select("faculty_id"),
        supabase.from("syllabus_topics").select("subject_id, is_covered, subjects!inner(department_id)").eq("subjects.department_id", deptId),
        supabase.from("leave_requests").select("status, faculty!inner(department_id)").eq("faculty.department_id", deptId),
      ]);

      // Workload chart
      const facList = fac.data || [];
      const slotCounts: Record<string, number> = {};
      (slots.data || []).forEach((s) => { slotCounts[s.faculty_id] = (slotCounts[s.faculty_id] || 0) + 1; });
      setWorkloadData(facList.map((f) => ({
        name: f.full_name.split(" ").slice(0, 2).join(" "),
        periods: slotCounts[f.id] || 0,
        max: f.max_periods_per_day * 6,
      })));

      // Syllabus by subject
      const subjectMap: Record<string, { total: number; covered: number; name: string }> = {};
      (sub.data || []).forEach((s) => { subjectMap[s.id] = { total: 0, covered: 0, name: s.code }; });
      (topics.data || []).forEach((t: any) => {
        if (subjectMap[t.subject_id]) {
          subjectMap[t.subject_id].total++;
          if (t.is_covered) subjectMap[t.subject_id].covered++;
        }
      });
      setSyllabusData(Object.values(subjectMap).filter((s) => s.total > 0));

      // Leave summary
      const leaveList = leaves.data || [];
      const statusCounts: Record<string, number> = {};
      leaveList.forEach((l: any) => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
      setLeaveSummary(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

      const totalTopics = (topics.data || []).length;
      const coveredTopics = (topics.data || []).filter((t: any) => t.is_covered).length;
      setStats({
        faculty: facList.length,
        subjects: (sub.data || []).length,
        syllabusComplete: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
        pendingLeaves: leaveList.filter((l: any) => l.status === "pending").length,
      });
    };
    load();
  }, [deptId]);

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD.</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Department Reports</h1><p className="text-muted-foreground">Analytics and reports for {deptName}</p></div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Faculty", value: stats.faculty, icon: Users, color: "text-primary" },
          { label: "Subjects", value: stats.subjects, icon: BookOpen, color: "text-success" },
          { label: "Syllabus Done", value: `${stats.syllabusComplete}%`, icon: CheckCircle2, color: "text-primary" },
          { label: "Pending Leaves", value: stats.pendingLeaves, icon: ClipboardList, color: "text-warning" },
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

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" />Faculty Workload (Periods/Week)</CardTitle></CardHeader>
            <CardContent>
              {workloadData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workloadData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="periods" fill="hsl(221,83%,53%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="max" fill="hsl(210,40%,90%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Syllabus Progress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {syllabusData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No syllabus data</p> : syllabusData.map((s) => {
                const pct = s.total > 0 ? Math.round((s.covered / s.total) * 100) : 0;
                return (
                  <div key={s.name} className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="font-medium">{s.name}</span><span className="text-muted-foreground">{s.covered}/{s.total} ({pct}%)</span></div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />Leave Summary</CardTitle></CardHeader>
            <CardContent>
              {leaveSummary.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No leave data</p> : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={leaveSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`}>
                      {leaveSummary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
