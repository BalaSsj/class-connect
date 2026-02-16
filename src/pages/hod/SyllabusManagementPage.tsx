import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, BookOpen, CheckCircle, Calendar, Brain, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function SyllabusManagementPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [topics, setTopics] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDate, setAssignDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [s, f] = await Promise.all([
        supabase.from("subjects").select("*, departments(name)").order("name"),
        supabase.from("faculty").select("*").eq("is_active", true).order("full_name"),
      ]);
      if (s.data) setSubjects(s.data);
      if (f.data) setFaculty(f.data);
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedSubject) loadTopics();
  }, [selectedSubject]);

  const loadTopics = async () => {
    const { data } = await supabase
      .from("syllabus_topics")
      .select("*, covered_faculty:faculty!syllabus_topics_covered_by_fkey(full_name)")
      .eq("subject_id", selectedSubject)
      .order("unit_number")
      .order("topic_number");
    if (data) setTopics(data);
  };

  const handleUploadAndAnalyze = async (file: File) => {
    if (!selectedSubject) { toast.error("Select a subject first"); return; }
    const subject = subjects.find(s => s.id === selectedSubject);
    
    setUploading(true);
    // Upload PDF to storage
    const fileName = `${selectedSubject}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("syllabus-pdfs")
      .upload(fileName, file);
    
    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("syllabus-pdfs").getPublicUrl(fileName);
    
    // Update subject with PDF URL
    await supabase.from("subjects").update({ syllabus_pdf_url: urlData.publicUrl }).eq("id", selectedSubject);
    
    setUploading(false);
    setAnalyzing(true);
    toast.info("Analyzing syllabus with AI...");

    // Read PDF text (using basic text extraction from the file)
    const text = await file.text();
    
    const { data, error } = await supabase.functions.invoke("analyze-syllabus", {
      body: { syllabus_text: text, subject_id: selectedSubject, subject_name: subject?.name },
    });

    setAnalyzing(false);
    if (error) {
      toast.error("Analysis failed: " + error.message);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }

    toast.success(`Extracted ${data.topics_count} topics from syllabus!`);
    loadTopics();
  };

  const handleMarkCompleted = async (topicId: string, covered: boolean) => {
    const { error } = await supabase
      .from("syllabus_topics")
      .update({
        is_covered: covered,
        covered_date: covered ? new Date().toISOString().split("T")[0] : null,
      })
      .eq("id", topicId);
    if (error) toast.error(error.message);
    else loadTopics();
  };

  const handleAssignTopics = async () => {
    if (!assignDate || selectedTopics.length === 0) {
      toast.error("Select date and topics");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const updates = selectedTopics.map(id =>
      supabase.from("syllabus_topics").update({
        scheduled_date: assignDate,
        assigned_by: user?.id,
        covered_by: selectedFaculty || null,
      }).eq("id", id)
    );

    await Promise.all(updates);
    toast.success(`Assigned ${selectedTopics.length} topics for ${assignDate}`);
    setAssignOpen(false);
    setSelectedTopics([]);
    loadTopics();
  };

  const coveredCount = topics.filter(t => t.is_covered).length;
  const totalCount = topics.length;
  const progressPct = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0;

  const unitGroups = topics.reduce((acc, t) => {
    const u = t.unit_number || 1;
    if (!acc[u]) acc[u] = [];
    acc[u].push(t);
    return acc;
  }, {} as Record<number, any[]>);

  const todayTopics = topics.filter(t => t.scheduled_date === new Date().toISOString().split("T")[0]);
  const nextUncoveredTopics = topics.filter(t => !t.is_covered).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Syllabus Management</h1>
          <p className="text-muted-foreground">Upload syllabus, track daily topic completion</p>
        </div>
      </div>

      {/* Subject Selection & Upload */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Select Subject & Upload Syllabus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Upload Syllabus PDF</Label>
                <Input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  disabled={!selectedSubject || uploading || analyzing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadAndAnalyze(file);
                  }}
                />
              </div>
            </div>
            {(uploading || analyzing) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-4 w-4 animate-spin" />
                {uploading ? "Uploading PDF..." : "AI is extracting topics from syllabus..."}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedSubject && totalCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">{progressPct}%</div>
              <Progress value={progressPct} className="h-3" />
              <div className="text-sm text-muted-foreground">{coveredCount} / {totalCount} topics covered</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Today's Topics */}
      {todayTopics.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-primary" />Today's Scheduled Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayTopics.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={t.is_covered}
                        onCheckedChange={(v) => handleMarkCompleted(t.id, !!v)}
                      />
                      <div>
                        <span className="text-sm font-medium">{t.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">Unit {t.unit_number}</span>
                      </div>
                    </div>
                    <Badge variant={t.is_covered ? "default" : "secondary"}>
                      {t.is_covered ? "Completed" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Next topics for substitute info */}
      {nextUncoveredTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Next Topics to Cover (for substitutes)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nextUncoveredTopics.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded border">
                  <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Assignment */}
      {selectedSubject && totalCount > 0 && (
        <div className="flex gap-2">
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button><Calendar className="mr-2 h-4 w-4" />Assign Daily Topics</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Assign Topics to Date</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Faculty (optional)</Label>
                    <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                      <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                      <SelectContent>
                        {faculty.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Topics</Label>
                  {topics.filter(t => !t.is_covered).map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded border">
                      <Checkbox
                        checked={selectedTopics.includes(t.id)}
                        onCheckedChange={(v) => {
                          setSelectedTopics(prev =>
                            v ? [...prev, t.id] : prev.filter(id => id !== t.id)
                          );
                        }}
                      />
                      <span className="text-sm">U{t.unit_number} T{t.topic_number}: {t.title}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAssignTopics} className="w-full" disabled={!assignDate || selectedTopics.length === 0}>
                  Assign {selectedTopics.length} Topics
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Unit-wise Topic Table */}
      {selectedSubject && Object.keys(unitGroups).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {Object.entries(unitGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([unit, unitTopics]) => {
            const unitCovered = (unitTopics as any[]).filter((t: any) => t.is_covered).length;
            return (
              <Card key={unit} className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Unit {unit}</span>
                    <Badge variant="outline">{unitCovered}/{(unitTopics as any[]).length} covered</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Done</TableHead>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Covered By</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(unitTopics as any[]).map((t: any) => (
                        <TableRow key={t.id} className={t.is_covered ? "bg-success/5" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={t.is_covered}
                              onCheckedChange={(v) => handleMarkCompleted(t.id, !!v)}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.topic_number}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{t.title}</div>
                            {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                          </TableCell>
                          <TableCell className="text-xs">{t.scheduled_date || "—"}</TableCell>
                          <TableCell className="text-xs">{t.covered_faculty?.full_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={t.is_covered ? "default" : "secondary"} className="text-xs">
                              {t.is_covered ? "Done" : "Pending"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
