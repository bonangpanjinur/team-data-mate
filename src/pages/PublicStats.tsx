import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Users, FileCheck, Send, Award, TrendingUp } from "lucide-react";

interface StatusCount {
  status: string;
  count: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Users; color: string; bg: string }> = {
  belum_lengkap: { label: "Data Terisi", icon: Users, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950" },
  lengkap: { label: "Data Lengkap", icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950" },
  ktp_terdaftar_nib: { label: "KTP Terdaftar NIB", icon: Users, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950" },
  terverifikasi: { label: "Terverifikasi", icon: FileCheck, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950" },
  nib_selesai: { label: "NIB Selesai", icon: FileCheck, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-950" },
  ktp_terdaftar_sertifikat: { label: "KTP Terdaftar Sertifikat", icon: Users, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950" },
  pengajuan: { label: "Dalam Pengajuan", icon: Send, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950" },
  sertifikat_selesai: { label: "Tersertifikasi", icon: Award, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950" },
};

export default function PublicStats() {
  const navigate = useNavigate();
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase
        .from("tracking_view" as any)
        .select("status");

      if (data) {
        const counts: Record<string, number> = {};
        (data as any[]).forEach((d) => {
          counts[d.status] = (counts[d.status] || 0) + 1;
        });
        const arr = Object.entries(counts).map(([status, count]) => ({ status, count }));
        setStatusCounts(arr);
        setTotal(data.length);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const certified = statusCounts.find((s) => s.status === "sertifikat_selesai")?.count ?? 0;
  const inProgress = statusCounts.filter((s) => ["pengajuan", "nib_selesai"].includes(s.status)).reduce((a, b) => a + b.count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Statistik Sertifikasi Halal</h1>
          <p className="text-sm text-muted-foreground mt-1">Data publik jumlah UMKM dalam proses sertifikasi halal</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm">Memuat statistik...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="shadow-sm border-0 bg-primary text-primary-foreground">
                <CardContent className="pt-6 pb-5 text-center">
                  <p className="text-4xl font-bold">{total}</p>
                  <p className="text-sm mt-1 opacity-80">Total UMKM Terdaftar</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-0 bg-emerald-600 dark:bg-emerald-700 text-white">
                <CardContent className="pt-6 pb-5 text-center">
                  <p className="text-4xl font-bold">{certified}</p>
                  <p className="text-sm mt-1 opacity-80">Tersertifikasi Halal</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-0 bg-purple-600 dark:bg-purple-700 text-white">
                <CardContent className="pt-6 pb-5 text-center">
                  <p className="text-4xl font-bold">{inProgress}</p>
                  <p className="text-sm mt-1 opacity-80">Dalam Proses</p>
                </CardContent>
              </Card>
            </div>

            {/* Detail per Status */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Distribusi Status
                </CardTitle>
                <CardDescription>Rincian jumlah UMKM per tahap proses sertifikasi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = statusCounts.find((s) => s.status === key)?.count ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const Icon = cfg.icon;
                  return (
                    <div key={key} className={`flex items-center gap-3 rounded-lg p-3 ${cfg.bg}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/80 ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${cfg.color}`}>{count}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5">{pct}%</Badge>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-background/60">
                          <div
                            className="h-1.5 rounded-full bg-current transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="shadow-sm bg-muted/50 border-dashed">
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Data ini diperbarui secara realtime. Nama dan data pribadi UMKM tidak ditampilkan untuk menjaga privasi.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer Nav */}
        <div className="mt-8 flex justify-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/tracking")} className="text-muted-foreground">
            Cek Tracking
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-muted-foreground">
            <ArrowLeft className="mr-2 h-3 w-3" />
            Login
          </Button>
        </div>
      </div>
    </div>
  );
}
