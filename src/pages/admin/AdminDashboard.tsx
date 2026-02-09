import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, BookOpen, Calendar, Shuffle, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  departments: number;
  faculty: number;
  subjects: number;
  sections: number;
  pendingLeaves: number;
  reallocationsToday: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ departments: 0, faculty: 0, subjects: 0, sections: 0, pendingLeaves: 0, reallocationsToday: 0 });

  useEffect(() => {
    const load = async () => {
      const [depts, fac, subs, secs, leaves, reallocs] = await Promise.all([
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("faculty").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("years_sections").select("id", { count: "exact", head: true }),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reallocations").select("id", { count: "exact", head: true }).eq("reallocation_date", new Date().toISOString().split("T")[0]),
      ]);
      setStats({
        departments: depts.count ?? 0,
        faculty: fac.count ?? 0,
        subjects: subs.count ?? 0,
        sections: secs.count ?? 0,
        pendingLeaves: leaves.count ?? 0,
        reallocationsToday: reallocs.count ?? 0,
      });
    };
    load();
  }, []);

  const cards = [
    { label: "Departments", value: stats.departments, icon: Building2, color: "text-primary" },
    { label: "Active Faculty", value: stats.faculty, icon: Users, color: "text-success" },
    { label: "Subjects", value: stats.subjects, icon: BookOpen, color: "text-warning" },
    { label: "Sections", value: stats.sections, icon: Calendar, color: "text-primary" },
    { label: "Pending Leaves", value: stats.pendingLeaves, icon: ClipboardList, color: "text-destructive" },
    { label: "Reallocations Today", value: stats.reallocationsToday, icon: Shuffle, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of the faculty reallocation system</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
