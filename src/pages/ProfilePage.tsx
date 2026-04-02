import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { User, Mail, Phone, Building2, Briefcase, Save, BookOpen, GraduationCap, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { user, primaryRole } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [faculty, setFaculty] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [handlingSubjects, setHandlingSubjects] = useState<any[]>([]);
  const [workload, setWorkload] = useState({ total: 0, maxWeekly: 0 });
  const [sectionsTaught, setSectionsTaught] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (p) {
        setProfile(p);
        setFullName(p.full_name);
        setPhone(p.phone || "");
      }
      const { data: f } = await supabase.from("faculty").select("*, departments(name)").eq("user_id", user.id).single();
      if (f) {
        setFaculty(f);

        // Get subjects this faculty handles via faculty_subjects
        const { data: fs } = await supabase
          .from("faculty_subjects")
          .select("subject_id, subjects(name, code, is_lab, semester, year, credits)")
          .eq("faculty_id", f.id);
        if (fs) setHandlingSubjects(fs.map((x: any) => x.subjects).filter(Boolean));

        // Get timetable slots for workload
        const { data: slots } = await supabase
          .from("timetable_slots")
          .select("*, subjects(name, code), years_sections(year, section)")
          .eq("faculty_id", f.id);
        if (slots) {
          setWorkload({ total: slots.length, maxWeekly: f.max_periods_per_day * 6 });
          // Unique sections
          const secMap = new Map<string, any>();
          slots.forEach((s: any) => {
            const key = s.year_section_id;
            if (!secMap.has(key)) {
              secMap.set(key, {
                year: s.years_sections?.year,
                section: s.years_sections?.section,
                subjects: new Set<string>(),
                periods: 0,
              });
            }
            const entry = secMap.get(key)!;
            entry.subjects.add(s.subjects?.code || "");
            entry.periods++;
          });
          setSectionsTaught(Array.from(secMap.values()).map(v => ({
            ...v,
            subjects: Array.from(v.subjects).join(", "),
          })));
        }
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated!");
  };

  const initials = fullName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const workloadPct = workload.maxWeekly > 0 ? Math.round((workload.total / workload.maxWeekly) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Your account details, subjects, and workload</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{fullName || "User"}</CardTitle>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="secondary" className="capitalize">{primaryRole || "No role"}</Badge>
                  {faculty?.is_hod && <Badge variant="outline">HOD</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><User className="h-3 w-3" />Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label>
                <Input value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Phone className="h-3 w-3" />Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
              </div>
              {faculty && (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" />Department</Label>
                    <Input value={faculty.departments?.name || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Briefcase className="h-3 w-3" />Designation</Label>
                    <Input value={faculty.designation} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input value={faculty.employee_id} disabled />
                  </div>
                </>
              )}
            </div>
            {faculty?.expertise && faculty.expertise.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />Expertise</Label>
                <div className="flex flex-wrap gap-1">
                  {faculty.expertise.map((e: string, i: number) => (
                    <Badge key={i} variant="outline">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Workload Summary */}
      {faculty && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Workload Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{workload.total} periods/week</span>
                    <span className="text-muted-foreground">Max {workload.maxWeekly}</span>
                  </div>
                  <Progress value={workloadPct} className="h-2" />
                </div>
                <Badge variant={workloadPct > 80 ? "destructive" : workloadPct > 50 ? "secondary" : "default"}>
                  {workloadPct > 80 ? "Heavy" : workloadPct > 50 ? "Moderate" : "Light"}
                </Badge>
              </div>

              {sectionsTaught.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Sections Taught</Label>
                  <div className="grid gap-2">
                    {sectionsTaught.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded border text-sm">
                        <span className="font-medium">Year {s.year} Sec {s.section}</span>
                        <span className="text-muted-foreground text-xs">{s.subjects} • {s.periods} periods</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Subjects Handling */}
      {handlingSubjects.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Subjects Handling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {handlingSubjects.map((sub: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <div className="font-medium text-sm">{sub.name}</div>
                      <div className="text-xs text-muted-foreground">{sub.code} • Sem {sub.semester} • {sub.credits} credits</div>
                    </div>
                    <div className="flex gap-1">
                      {sub.is_lab && <Badge variant="secondary" className="text-xs">Lab</Badge>}
                      <Badge variant="outline" className="text-xs">Year {sub.year}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
