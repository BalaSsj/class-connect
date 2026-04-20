import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ClipboardList, Bell, BookOpen, Brain, Loader2, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BirthdayBanner } from "@/components/BirthdayBanner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIOD_TIMES = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:30-2:20", "2:20-3:10", "3:10-4:00"];

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any>(null);
  const [todaySlots, setTodaySlots] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [subjectsHandling, setSubjectsHandling] = useState<any[]>([]);
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("*, departments(name)").eq("user_id", user.id).single();
      if (!f) return;
      setFaculty(f);
      const today = new Date().getDay();
      const dayOfWeek = today === 0 ? 7 : today;
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

      // Get subjects handling
      const { data: fs } = await supabase
        .from("faculty_subjects")
        .select("subjects(name, code, is_lab)")
        .eq("faculty_id", f.id);
      if (fs) setSubjectsHandling(fs.map((x: any) => x.subjects).filter(Boolean));
    };
    load();
  }, [user]);

  const getAiTips = async () => {
    if (!faculty) return;
    setAiLoading(true);
    try {
      const todaySubjects = [...new Set(todaySlots.map(s => s.subjects?.name).filter(Boolean))];
      // Get syllabus progress for today's subjects
      const subjectIds = [...new Set(todaySlots.map(s => s.subject_id))];
      let syllabusProgress = "";
      if (subjectIds.length > 0) {
        const { data: topics } = await supabase
          .from("syllabus_topics")
          .select("title, is_covered, unit_number, subject_id, subjects(name)")
          .in("subject_id", subjectIds)
          .order("topic_number");
        if (topics && topics.length > 0) {
          const covered = topics.filter(t => t.is_covered).length;
          syllabusProgress = `Syllabus: ${covered}/${topics.length} topics covered. Next uncovered: ${topics.filter(t => !t.is_covered).slice(0, 3).map(t => `${(t as any).subjects?.name}: ${t.title}`).join("; ")}`;
        }
      }

      const { data, error } = await supabase.functions.invoke("ai-syllabus-predict", {
        body: {
          action: "daily-tips",
          faculty_name: faculty.full_name,
          today_subjects: todaySubjects,
          syllabus_info: syllabusProgress,
          periods_count: todaySlots.length,
        },
      });
      if (error) throw error;
      setAiTips(data?.tips || data?.predictions?.[0]?.teaching_strategy || "Focus on interactive teaching methods today.");
    } catch (err: any) {
      toast.error("Could not get AI tips");
      setAiTips("Focus on interactive teaching and ensure student engagement for each period.");
    } finally {
      setAiLoading(false);
    }
  };

  const todayName = DAYS[new Date().getDay() - 1] || "Sunday";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Welcome{faculty ? `, ${faculty.full_name}` : ""}</h1>
        <p className="text-muted-foreground">Your schedule and updates for {todayName}</p>
      </motion.div>

      <BirthdayBanner name={faculty?.full_name} dob={faculty?.date_of_birth} />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Classes Today", value: todaySlots.length, icon: Calendar, color: "text-primary" },
          { label: "Subjects Handling", value: subjectsHandling.length, icon: BookOpen, color: "text-emerald-500" },
          { label: "Pending Leaves", value: pendingLeaves, icon: ClipboardList, color: "text-yellow-500" },
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

      {/* Subjects Handling */}
      {subjectsHandling.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />My Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {subjectsHandling.map((s: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs py-1 px-2">
                    {s.code} — {s.name} {s.is_lab ? "🧪" : ""}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Daily Tips */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> AI Teaching Assistant
              </CardTitle>
              <Button size="sm" variant="outline" onClick={getAiTips} disabled={aiLoading || todaySlots.length === 0}>
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Lightbulb className="h-3 w-3 mr-1" />}
                Get Tips
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiTips ? (
              <p className="text-sm whitespace-pre-line">{aiTips}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {todaySlots.length === 0
                  ? "No classes today — enjoy your free day!"
                  : "Click 'Get Tips' for AI-powered teaching recommendations based on your schedule and syllabus progress."}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" /> Today's Schedule — {todayName}
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
