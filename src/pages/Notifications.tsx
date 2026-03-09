import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  entry_id: string | null;
}

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (filter === "unread") {
      query = query.eq("is_read", false);
    }

    const { data } = await query;
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, filter]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast({ title: "Semua notifikasi ditandai sudah dibaca" });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Semua
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Belum Dibaca
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Memuat...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-30" />
            <p>{filter === "unread" ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={notif.is_read ? "opacity-70" : "border-primary/30 bg-primary/5"}
            >
              <CardContent className="flex items-start gap-4 py-4">
                <div className="mt-1">
                  <Bell className={`h-5 w-5 ${notif.is_read ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{notif.title}</span>
                    {!notif.is_read && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">Baru</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(notif.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                  </p>
                </div>
                {!notif.is_read && (
                  <Button variant="ghost" size="icon" onClick={() => markAsRead(notif.id)} title="Tandai dibaca">
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
