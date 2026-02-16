import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, CheckCircle, Clock, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function SyllabusPage() {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topics, setTopics] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: "", unit_number: "1", topic_number: "1", description: "" });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("id").eq("user_id", user.id).single();
      if (!f) return;
      setFaculty(f);

      // Get subjects this faculty teaches
      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("subject_id, subjects(id, name, code)")
        .eq("faculty_id", f.id);

      if (slots) {
        const uniqueSubjects = new Map();
        slots.forEach((s) => {
          if (s.subjects && !uniqueSubjects.has(s.subject_id)) {
            uniqueSubjects.set(s.subject_id, s.subjects);
          }
        });
        setSubjects(Array.from(uniqueSubjects.values()));
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!selectedSubject) { setTopics([]); return; }
    const fetchTopics = async () => {
      const { data } = await supabase
        .from("syllabus_topics")
        .select("*, covered_faculty:faculty!syllabus_topics_covered_by_fkey(full_name)")
        .eq("subject_id", selectedSubject)
        .order("unit_number")
        .order("topic_number");
      if (data) setTopics(data);
    };
    fetchTopics();
  }, [selectedSubject]);

  const toggleCovered = async (topicId: string, currentlyCovered: boolean) => {
    if (!faculty) return;
    const { error } = await supabase.from("syllabus_topics").update({
      is_covered: !currentlyCovered,
      covered_by: !currentlyCovered ? faculty.id : null,
      covered_date: !currentlyCovered ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", topicId);

    if (error) { toast.error(error.message); return; }
    // Refresh
    const { data } = await supabase
      .from("syllabus_topics")
      .select("*, covered_faculty:faculty!syllabus_topics_covered_by_fkey(full_name)")
      .eq("subject_id", selectedSubject)
      .order("unit_number")
      .order("topic_number");
    if (data) setTopics(data);
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("syllabus_topics").insert({
      subject_id: selectedSubject,
      title: newTopic.title,
      unit_number: parseInt(newTopic.unit_number),
      topic_number: parseInt(newTopic.topic_number),
      description: newTopic.description || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Topic added!");
    setAddOpen(false);
    setNewTopic({ title: "", unit_number: "1", topic_number: "1", description: "" });
    // Refresh
    const { data } = await supabase
      .from("syllabus_topics")
      .select("*, covered_faculty:faculty!syllabus_topics_covered_by_fkey(full_name)")
      .eq("subject_id", selectedSubject)
      .order("unit_number")
      .order("topic_number");
    if (data) setTopics(data);
  };

  const coveredCount = topics.filter((t) => t.is_covered).length;
  const progress = topics.length > 0 ? Math.round((coveredCount / topics.length) * 100) : 0;

  // Group by unit
  const units = topics.reduce((acc, t) => {
    if (!acc[t.unit_number]) acc[t.unit_number] = [];
    acc[t.unit_number].push(t);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Syllabus Tracker</h1>
          <p className="text-muted-foreground">Track covered topics for your subjects</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select Subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSubject && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Syllabus Topic</DialogTitle></DialogHeader>
                <form onSubmit={handleAddTopic} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input type="number" min="1" max="5" value={newTopic.unit_number} onChange={(e) => setNewTopic({ ...newTopic, unit_number: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Topic #</Label>
                      <Input type="number" min="1" value={newTopic.topic_number} onChange={(e) => setNewTopic({ ...newTopic, topic_number: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newTopic.title} onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} placeholder="e.g. Introduction to Data Structures" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input value={newTopic.description} onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })} placeholder="Brief description" />
                  </div>
                  <Button type="submit" className="w-full">Add Topic</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!selectedSubject ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Select a subject to view and track syllabus progress
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Progress card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Syllabus Progress</span>
                <span className="text-sm text-muted-foreground">{coveredCount}/{topics.length} topics</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-success" />Covered: {coveredCount}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-warning" />Pending: {topics.length - coveredCount}</span>
                </div>
                <Badge variant={progress === 100 ? "default" : "secondary"}>{progress}%</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Topics by unit */}
          {Object.entries(units).map(([unit, unitTopics]) => (
            <Card key={unit}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unit {unit}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(unitTopics as any[]).map((topic) => (
                    <div key={topic.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${topic.is_covered ? "bg-success/5 border-success/20" : "bg-card"}`}>
                      <Checkbox
                        checked={topic.is_covered}
                        onCheckedChange={() => toggleCovered(topic.id, topic.is_covered)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${topic.is_covered ? "line-through text-muted-foreground" : ""}`}>
                            {topic.topic_number}. {topic.title}
                          </span>
                        </div>
                        {topic.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                        )}
                        {topic.is_covered && topic.covered_faculty && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Covered by {topic.covered_faculty?.full_name} on {topic.covered_date}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {topics.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No topics added for this subject yet. Click + to add syllabus topics.
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
