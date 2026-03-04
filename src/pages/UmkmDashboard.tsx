import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, ShieldCheck, FileCheck, Send, Award, AlertTriangle, Search, Bell, Check, Download, MessageCircle, History } from "lucide-react";
import { Link } from "react-router-dom";
import ProgressTimeline from "@/components/ProgressTimeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  belum_lengkap: { label: "Belum Lengkap", variant: "destructive", icon: Clock },
  siap_input: { label: "Siap Input", variant: "secondary", icon: CheckCircle2 },
  lengkap: { label: "Lengkap", variant: "secondary", icon: CheckCircle2 },
  ktp_terdaftar_nib: { label: "KTP Terdaftar NIB", variant: "destructive", icon: AlertTriangle },
  terverifikasi: { label: "Terverifikasi", variant: "default", icon: ShieldCheck },
  nib_selesai: { label: "NIB Selesai", variant: "secondary", icon: FileCheck },
  ktp_terdaftar_sertifikat: { label: "KTP Terdaftar Sertifikat", variant: "destructive", icon: AlertTriangle },
  pengajuan: { label: "Pengajuan", variant: "outline", icon: Send },
  sertifikat_selesai: { label: "Sertifikat Selesai", variant: "default", icon: Award },
};

interface UmkmEntry {
  id: string;
  nama: string | null;
  status: string;
  tracking_code: string | null;
  nib_url: string | null;
  sertifikat_url: string | null;
  created_at: string;
  pic_user_id: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
}

interface PicProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export default function UmkmDashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<UmkmEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [picProfiles, setPicProfiles] = useState<Record<string, PicProfile>>({});
  const [auditLogs, setAuditLogs] = useState<Record<string, AuditLog[]>>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [entriesRes, notifRes] = await Promise.all([
        supabase
          .from("data_entries")
          .select("id, nama, status, tracking_code, nib_url, sertifikat_url, created_at, pic_user_id")
          .eq("umkm_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const entriesData = (entriesRes.data ?? []) as UmkmEntry[];
      setEntries(entriesData);
      setNotifications((notifRes.data as unknown as Notification[]) ?? []);

      // Fetch PIC profiles
      const picIds = [...new Set(entriesData.map(e => e.pic_user_id).filter(Boolean))] as string[];
      if (picIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", picIds);
        const map: Record<string, PicProfile> = {};
        (profiles ?? []).forEach((p: any) => { map[p.id] = p; });
        setPicProfiles(map);
      }

      // Fetch audit logs for all entries
      const entryIds = entriesData.map(e => e.id);
      if (entryIds.length > 0) {
        const { data: logs } = await supabase
          .from("audit_logs")
          .select("id, entry_id, old_status, new_status, changed_at, changed_by")
          .in("entry_id", entryIds)
          .order("changed_at", { ascending: false });
        const logMap: Record<string, AuditLog[]> = {};
        (logs ?? []).forEach((l: any) => {
          if (!logMap[l.entry_id]) logMap[l.entry_id] = [];
          logMap[l.entry_id].push(l);
        });
        setAuditLogs(logMap);
      }

      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel("umkm-notif-dashboard")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        setNotifications((prev) => [payload.new as unknown as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true } as any).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const getStatusLabel = (status: string) => STATUS_CONFIG[status]?.label || status;

  const openWhatsApp = (phone: string, entryName: string | null) => {
    const cleaned = phone.replace(/\D/g, "").replace(/^0/, "62");
    const msg = encodeURIComponent(`Halo, saya ingin bertanya tentang status data UMKM "${entryName || "saya"}".`);
    window.open(`https://wa.me/${cleaned}?text=${msg}`, "_blank");
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || { label: status, variant: "outline" as const, icon: Clock };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Memuat data...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Status UMKM Saya</h1>
        <Button
          variant={showNotifications ? "default" : "outline"}
          size="sm"
          className="gap-2 relative"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-4 w-4" />
          Notifikasi
          {unreadCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {showNotifications && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notifikasi</CardTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs gap-1">
                  <Check className="h-3 w-3" /> Tandai semua dibaca
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada notifikasi</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-lg p-3 text-sm cursor-pointer transition-colors ${
                      n.is_read ? "bg-muted/30" : "bg-primary/5 border border-primary/20"
                    }`}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                  >
                    <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`${n.is_read ? "text-muted-foreground" : "font-medium"}`}>{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Belum ada data terdaftar untuk akun Anda.</p>
            <p className="text-sm text-muted-foreground">Hubungi petugas lapangan untuk mendaftarkan data UMKM Anda.</p>
            <div className="mt-6">
              <Link to="/tracking">
                <Button variant="outline" className="gap-2">
                  <Search className="h-4 w-4" />
                  Cek Status dengan Kode Tracking
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const cfg = getStatusConfig(entry.status);
            const StatusIcon = cfg.icon;
            const pic = entry.pic_user_id ? picProfiles[entry.pic_user_id] : null;
            const entryLogs = auditLogs[entry.id] ?? [];

            return (
              <Card key={entry.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{entry.nama || "Tanpa Nama"}</CardTitle>
                    <Badge variant={cfg.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                  {entry.tracking_code && (
                    <p className="text-xs text-muted-foreground font-mono">{entry.tracking_code}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <ProgressTimeline currentStatus={entry.status} />

                  {/* PIC & WhatsApp */}
                  {pic && (
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Petugas: </span>
                        <span className="font-medium">{pic.full_name || "Petugas"}</span>
                      </div>
                      {pic.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700"
                          onClick={() => openWhatsApp(pic.phone!, entry.nama)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">NIB:</span>{" "}
                      {entry.nib_url ? (
                        <div className="flex items-center gap-2 mt-1">
                          <a href={entry.nib_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Lihat NIB</a>
                          <a href={entry.nib_url} download className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <Download className="h-3 w-3" /> Unduh
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Belum ada</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sertifikat:</span>{" "}
                      {entry.sertifikat_url ? (
                        <div className="flex items-center gap-2 mt-1">
                          <a href={entry.sertifikat_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Lihat Sertifikat</a>
                          <a href={entry.sertifikat_url} download className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <Download className="h-3 w-3" /> Unduh
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Belum ada</span>
                      )}
                    </div>
                  </div>

                  {/* Status History */}
                  {entryLogs.length > 0 && (
                    <Collapsible
                      open={openHistory[entry.id] ?? false}
                      onOpenChange={(open) => setOpenHistory(prev => ({ ...prev, [entry.id]: open }))}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs w-full justify-start text-muted-foreground">
                          <History className="h-3.5 w-3.5" />
                          Riwayat Perubahan Status ({entryLogs.length})
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-1.5 border-l-2 border-muted ml-2 pl-4">
                          {entryLogs.map((log) => (
                            <div key={log.id} className="text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {getStatusLabel(log.new_status)}
                                </Badge>
                                {log.old_status && (
                                  <span className="text-muted-foreground">
                                    dari {getStatusLabel(log.old_status)}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground mt-0.5">
                                {new Date(log.changed_at).toLocaleDateString("id-ID", {
                                  day: "numeric", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Terdaftar: {new Date(entry.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
