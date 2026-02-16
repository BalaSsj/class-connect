import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone, Pin } from "lucide-react";
import { motion } from "framer-motion";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", priority: "normal", is_pinned: false });

  useEffect(() => {
    const loadDept = async () => {
      if (!user) return;
      const { data: fac } = await supabase.from("faculty").select("department_id, departments(name)").eq("user_id", user.id).eq("is_hod", true).maybeSingle();
      if (fac) { setDeptId(fac.department_id); setDeptName((fac.departments as any)?.name || ""); }
    };
    loadDept();
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!deptId) return;
    const { data } = await supabase.from("announcements").select("*").or(`department_id.eq.${deptId},department_id.is.null`).order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  useEffect(() => { fetchAnnouncements(); }, [deptId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("announcements").insert({
      title: form.title, content: form.content, priority: form.priority,
      is_pinned: form.is_pinned, department_id: deptId, created_by: user.id,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement posted");
    setForm({ title: "", content: "", priority: "normal", is_pinned: false });
    setOpen(false);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchAnnouncements(); }
  };

  const priorityColors: Record<string, string> = { low: "secondary", normal: "default", high: "destructive", urgent: "destructive" };

  if (!deptId) return <div className="flex items-center justify-center h-64 text-muted-foreground">You are not assigned as HOD.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Announcements</h1><p className="text-muted-foreground">Circulars and notices for {deptName}</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Announcement</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Important notice..." required /></div>
              <div className="space-y-2"><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Details of the announcement..." rows={4} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={form.is_pinned} onCheckedChange={(v) => setForm({ ...form, is_pinned: v })} /><Label>Pin to top</Label></div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Posting..." : "Post Announcement"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {announcements.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements yet.</CardContent></Card>
        ) : announcements.map((a) => (
          <Card key={a.id} className={a.is_pinned ? "border-primary/40 bg-primary/5" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {a.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                  <Megaphone className="h-4 w-4" />
                  {a.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={(priorityColors[a.priority] || "default") as any} className="capitalize text-xs">{a.priority}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
              <p className="text-xs text-muted-foreground/60 mt-3">{new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </div>
  );
}
