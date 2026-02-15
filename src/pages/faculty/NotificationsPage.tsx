import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifs = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };

  useEffect(() => { fetchNotifs(); }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetchNotifs();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    toast.success("All marked as read");
    fetchNotifs();
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">{unread} unread notification{unread !== 1 ? "s" : ""}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
          </Button>
        )}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No notifications yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <Card key={n.id} className={`transition-all ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`}>
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{n.title}</span>
                      {!n.is_read && <Badge variant="default" className="text-[10px] px-1.5 py-0">NEW</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markRead(n.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
