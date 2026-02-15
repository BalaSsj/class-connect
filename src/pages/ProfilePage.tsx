import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Mail, Phone, Building2, Briefcase, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { user, primaryRole } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [faculty, setFaculty] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

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
      if (f) setFaculty(f);
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Manage your account details</p>
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
                <Badge variant="secondary" className="mt-1 capitalize">{primaryRole || "No role"}</Badge>
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
                    <Label>Max Periods/Day</Label>
                    <Input value={faculty.max_periods_per_day} disabled />
                  </div>
                </>
              )}
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
