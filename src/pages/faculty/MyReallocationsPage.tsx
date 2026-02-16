import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shuffle, BookOpen, CheckCircle, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MyReallocationsPage() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any>(null);
  const [reallocations, setReallocations] = useState<any[]>([]);
  const [topicsToCover, setTopicsToCover] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("id").eq("user_id", user.id).single();
      if (!f) return;
      setFaculty(f);

      // Get reallocations where I'm the substitute
      const { data: reallocs } = await supabase
        .from("reallocations")
        .select(`
          *,
          original:faculty!reallocations_original_faculty_id_fkey(full_name),
          timetable_slots(period_number, day_of_week, subject_id, subjects(name, code))
        `)
        .eq("substitute_faculty_id", f.id)
        .eq("status", "approved")
        .order("reallocation_date", { ascending: true });

      if (reallocs) {
        setReallocations(reallocs);

        // For each subject, get next uncovered topics
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
    load();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Substitutions</h1>
        <p className="text-muted-foreground">Classes you're covering and what to teach next</p>
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

              return (
                <Card key={r.id} className="border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shuffle className="h-4 w-4 text-primary" />
                        Substituting for {r.original?.full_name}
                      </CardTitle>
                      <Badge variant="default">{r.reallocation_date}</Badge>
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

                    {/* What to cover next */}
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

                    {nextTopics.length === 0 && subjectId && (
                      <p className="text-xs text-muted-foreground italic">No syllabus topics added for this subject yet.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
