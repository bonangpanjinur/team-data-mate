import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, FolderOpen, FileCheck, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface Stats {
  teamCount: number;
  groupCount: number;
  totalEntries: number;
  statusCounts: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  belum_lengkap: "Belum Lengkap",
  siap_input: "Siap Input",
  lengkap: "Lengkap",
  terverifikasi: "Terverifikasi",
  nib_selesai: "NIB Selesai",
  pengajuan: "Pengajuan",
  sertifikat_selesai: "Sertifikat Selesai",
  ktp_terdaftar_nib: "KTP Terdaftar NIB",
  ktp_terdaftar_sertifikat: "KTP Terdaftar Sertifikat",
};

const STATUS_COLORS: Record<string, string> = {
  belum_lengkap: "text-destructive",
  siap_input: "text-yellow-600",
  lengkap: "text-blue-600",
  terverifikasi: "text-emerald-600",
  nib_selesai: "text-indigo-600",
  pengajuan: "text-orange-600",
  sertifikat_selesai: "text-primary",
  ktp_terdaftar_nib: "text-teal-600",
  ktp_terdaftar_sertifikat: "text-cyan-600",
};

export default function OwnerSummary() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState<Stats>({ teamCount: 0, groupCount: 0, totalEntries: 0, statusCounts: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role !== "owner") return;

    const fetchStats = async () => {
      setLoading(true);

      // Parallel fetches
      const [teamRes, groupRes, entriesRes] = await Promise.all([
        supabase.from("owner_teams").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("groups").select("id").eq("owner_id", user.id),
        supabase.from("groups").select("id").eq("owner_id", user.id).then(async ({ data: groups }) => {
          if (!groups || groups.length === 0) return { data: [], count: 0 };
          const groupIds = groups.map((g) => g.id);
          const { data } = await supabase
            .from("data_entries")
            .select("status")
            .in("group_id", groupIds);
          return { data: data || [], count: data?.length || 0 };
        }),
      ]);

      const statusCounts: Record<string, number> = {};
      (entriesRes.data as any[])?.forEach((e: any) => {
        statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
      });

      setStats({
        teamCount: teamRes.count ?? 0,
        groupCount: groupRes.data?.length ?? 0,
        totalEntries: entriesRes.count ?? 0,
        statusCounts,
      });
      setLoading(false);
    };

    fetchStats();
  }, [user, role]);

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Owner yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedCount = stats.statusCounts["sertifikat_selesai"] || 0;
  const progressPercent = stats.totalEntries > 0 ? Math.round((completedCount / stats.totalEntries) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ringkasan</h1>
        <p className="text-muted-foreground text-sm mt-1">Statistik tim, grup, dan progress sertifikasi Anda</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anggota Tim</p>
              <p className="text-2xl font-bold">{stats.teamCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <FolderOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grup Aktif</p>
              <p className="text-2xl font-bold">{stats.groupCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Data</p>
              <p className="text-2xl font-bold">{stats.totalEntries}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sertifikat Selesai</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="h-5 w-5" /> Progress Sertifikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Selesai</span>
            <span className="font-semibold">{completedCount} / {stats.totalEntries} ({progressPercent}%)</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5" /> Rincian Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.statusCounts).length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Belum ada data.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const count = stats.statusCounts[key] || 0;
                if (count === 0) return null;
                const pct = stats.totalEntries > 0 ? Math.round((count / stats.totalEntries) * 100) : 0;
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <span className={`text-sm font-medium ${STATUS_COLORS[key] || "text-foreground"}`}>{label}</span>
                    <span className="text-sm text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
