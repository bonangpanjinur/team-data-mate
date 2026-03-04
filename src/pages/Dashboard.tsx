import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FolderOpen, FileText, Link2, TrendingUp, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFieldAccess } from "@/hooks/useFieldAccess";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell,
  ResponsiveContainer, LabelList, CartesianGrid,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type DataEntry = Tables<"data_entries">;

const STATUS_LABELS: Record<string, string> = {
  belum_lengkap: "Belum Lengkap",
  siap_input: "Siap Input",
  lengkap: "Lengkap",
  ktp_terdaftar_nib: "KTP Terdaftar NIB",
  terverifikasi: "Terverifikasi",
  nib_selesai: "NIB Selesai",
  ktp_terdaftar_sertifikat: "KTP Terdaftar Sertifikat",
  pengajuan: "Pengajuan",
  sertifikat_selesai: "Sertifikat Selesai",
};

const STATUS_COLORS: Record<string, string> = {
  belum_lengkap: "hsl(0 84% 60%)",
  siap_input: "hsl(45 93% 47%)",
  lengkap: "hsl(120 60% 50%)",
  ktp_terdaftar_nib: "hsl(30 90% 50%)",
  terverifikasi: "hsl(142 71% 45%)",
  nib_selesai: "hsl(200 80% 50%)",
  ktp_terdaftar_sertifikat: "hsl(15 85% 50%)",
  pengajuan: "hsl(270 60% 55%)",
  sertifikat_selesai: "hsl(160 84% 39%)",
};

const STATUS_BG: Record<string, string> = {
  belum_lengkap: "bg-red-100 dark:bg-red-950",
  siap_input: "bg-yellow-100 dark:bg-yellow-950",
  lengkap: "bg-lime-100 dark:bg-lime-950",
  ktp_terdaftar_nib: "bg-orange-100 dark:bg-orange-950",
  terverifikasi: "bg-green-100 dark:bg-green-950",
  nib_selesai: "bg-blue-100 dark:bg-blue-950",
  ktp_terdaftar_sertifikat: "bg-orange-100 dark:bg-orange-950",
  pengajuan: "bg-purple-100 dark:bg-purple-950",
  sertifikat_selesai: "bg-emerald-100 dark:bg-emerald-950",
};

const STATUS_TEXT: Record<string, string> = {
  belum_lengkap: "text-red-700 dark:text-red-400",
  siap_input: "text-yellow-700 dark:text-yellow-400",
  lengkap: "text-lime-700 dark:text-lime-400",
  terverifikasi: "text-green-700 dark:text-green-400",
  nib_selesai: "text-blue-700 dark:text-blue-400",
  pengajuan: "text-purple-700 dark:text-purple-400",
  sertifikat_selesai: "text-emerald-700 dark:text-emerald-400",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  belum_lengkap: "destructive",
  siap_input: "secondary",
  lengkap: "secondary",
  terverifikasi: "default",
  nib_selesai: "secondary",
  pengajuan: "outline",
  sertifikat_selesai: "default",
};

const pieChartConfig: ChartConfig = {
  belum_lengkap: { label: "Belum Lengkap", color: STATUS_COLORS.belum_lengkap },
  siap_input: { label: "Siap Input", color: STATUS_COLORS.siap_input },
  lengkap: { label: "Lengkap", color: STATUS_COLORS.lengkap },
  terverifikasi: { label: "Terverifikasi", color: STATUS_COLORS.terverifikasi },
  nib_selesai: { label: "NIB Selesai", color: STATUS_COLORS.nib_selesai },
  pengajuan: { label: "Pengajuan", color: STATUS_COLORS.pengajuan },
  sertifikat_selesai: { label: "Sertifikat Selesai", color: STATUS_COLORS.sertifikat_selesai },
};

const statusBarConfig: ChartConfig = pieChartConfig;

const barChartConfig: ChartConfig = {
  count: { label: "Jumlah Entri", color: "hsl(var(--primary))" },
};

type GroupStat = { name: string; count: number };
type StatusStat = { status: string; label: string; count: number; fill: string };

const FIELD_LABELS: Record<string, string> = {
  nama: "Nama",
  alamat: "Alamat",
  nomor_hp: "No. HP",
  ktp: "KTP",
  nib: "NIB",
  foto_produk: "Foto Produk",
  foto_verifikasi: "Foto Verifikasi",
  sertifikat: "Sertifikat",
};

const FIELD_TO_COLUMN: Record<string, string> = {
  nama: "nama",
  alamat: "alamat",
  nomor_hp: "nomor_hp",
  ktp: "ktp_url",
  nib: "nib_url",
  foto_produk: "foto_produk_url",
  foto_verifikasi: "foto_verifikasi_url",
  sertifikat: "sertifikat_url",
};

export default function Dashboard() {
  const { role, user } = useAuth();
  const { fields, canView } = useFieldAccess();
  const [stats, setStats] = useState({ groups: 0, entries: 0, users: 0, links: 0 });
  const [statusData, setStatusData] = useState<StatusStat[]>([]);
  const [groupData, setGroupData] = useState<GroupStat[]>([]);
  const [recentEntries, setRecentEntries] = useState<DataEntry[]>([]);

  const visibleFields = fields.filter((f) => f.can_view);

  useEffect(() => {
    const fetchStats = async () => {
      const isSuperAdmin = role === "super_admin";
      let entriesQuery = supabase.from("data_entries").select("id", { count: "exact", head: true });
      if (!isSuperAdmin && user) entriesQuery = entriesQuery.eq("created_by", user.id);

      const [groupsRes, entriesRes] = await Promise.all([
        supabase.from("groups").select("id", { count: "exact", head: true }),
        entriesQuery,
      ]);

      let usersCount = 0;
      let linksCount = 0;

      if (role === "super_admin") {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        usersCount = count ?? 0;
      }

      const { count: linkCount } = await supabase
        .from("shared_links")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user?.id ?? "");
      linksCount = linkCount ?? 0;

      setStats({
        groups: groupsRes.count ?? 0,
        entries: entriesRes.count ?? 0,
        users: usersCount,
        links: linksCount,
      });
    };

    const fetchChartData = async () => {
      const isSuperAdmin = role === "super_admin";
      let statusQuery = supabase.from("data_entries").select("status");
      if (!isSuperAdmin && user) statusQuery = statusQuery.eq("created_by", user.id);
      const { data: entries } = await statusQuery;
      if (entries) {
        const counts: Record<string, number> = {};
        entries.forEach((e) => { counts[e.status] = (counts[e.status] || 0) + 1; });
        setStatusData(
          Object.entries(counts).map(([status, count]) => ({
            status,
            label: STATUS_LABELS[status] || status,
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
          }))
        );
      }

      let groupQuery = supabase.from("data_entries").select("group_id, groups(name)");
      if (!isSuperAdmin && user) groupQuery = groupQuery.eq("created_by", user.id);
      const { data: entryGroups } = await groupQuery;
      if (entryGroups) {
        const groupCounts: Record<string, { name: string; count: number }> = {};
        entryGroups.forEach((e: any) => {
          const gid = e.group_id;
          if (!groupCounts[gid]) groupCounts[gid] = { name: e.groups?.name || "Unknown", count: 0 };
          groupCounts[gid].count++;
        });
        setGroupData(Object.values(groupCounts).sort((a, b) => b.count - a.count).slice(0, 10));
      }
    };

    const fetchRecentEntries = async () => {
      const isSuperAdmin = role === "super_admin";
      let recentQuery = supabase
        .from("data_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!isSuperAdmin && user) recentQuery = recentQuery.eq("created_by", user.id);
      const { data } = await recentQuery;
      setRecentEntries(data ?? []);
    };

    fetchStats();
    fetchChartData();
    fetchRecentEntries();
  }, [role, user]);

  const cards = [
    { label: "Group Halal", value: stats.groups, icon: FolderOpen, show: true },
    { label: "Data Entri", value: stats.entries, icon: FileText, show: true },
    { label: "Total User", value: stats.users, icon: Users, show: role === "super_admin" },
    { label: "Link Aktif", value: stats.links, icon: Link2, show: true },
  ];

  const totalEntries = statusData.reduce((s, d) => s + d.count, 0);

  const statusBarData = statusData.map((s) => ({
    label: s.label,
    count: s.count,
    status: s.status,
    persen: totalEntries > 0 ? Math.round((s.count / totalEntries) * 100) : 0,
  }));

  const getCellValue = (entry: DataEntry, fieldName: string) => {
    const col = FIELD_TO_COLUMN[fieldName];
    if (!col) return "-";
    const val = (entry as any)[col];
    if (!val) return "-";
    // For URL fields, show indicator
    if (col.endsWith("_url")) {
      return val ? "✓" : "-";
    }
    return val;
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        Dashboard {role && <span className="text-base font-normal text-muted-foreground capitalize">({role.replace("_", " ")})</span>}
      </h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.filter(c => c.show).map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Stats Cards */}
      {totalEntries > 0 && (
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {statusData.map((s) => (
            <Card key={s.status} className={`border-0 ${STATUS_BG[s.status]}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-medium mb-1 ${STATUS_TEXT[s.status]}`}>{s.label}</p>
                    <p className={`text-3xl font-bold ${STATUS_TEXT[s.status]}`}>{s.count}</p>
                    <p className={`text-xs mt-1 ${STATUS_TEXT[s.status]} opacity-70`}>
                      {totalEntries > 0 ? Math.round((s.count / totalEntries) * 100) : 0}% dari total
                    </p>
                  </div>
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center opacity-30"
                    style={{ backgroundColor: s.fill }}
                  />
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${totalEntries > 0 ? (s.count / totalEntries) * 100 : 0}%`,
                      backgroundColor: s.fill,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Row */}
      {totalEntries > 0 && (
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Jumlah Entri per Status
              </CardTitle>
              <CardDescription>Total {totalEntries} entri terdaftar</CardDescription>
            </CardHeader>
            <CardContent>
              {totalEntries === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>
              ) : (
                <ChartContainer config={statusBarConfig} className="max-h-[260px]">
                  <BarChart data={statusBarData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} className="stroke-muted" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value) => [`${value} entri`, ""]} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusBarData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribusi Status Entri</CardTitle>
              <CardDescription>Proporsi setiap status dalam persentase</CardDescription>
            </CardHeader>
            <CardContent>
              {totalEntries === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>
              ) : (
                <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[250px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                    <Pie data={statusData} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={95} strokeWidth={2}>
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
              {totalEntries > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {statusData.map((s) => (
                    <div key={s.status} className="flex items-center gap-1.5 text-sm">
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.fill }} />
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-semibold">{Math.round((s.count / totalEntries) * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group Bar Chart */}
      {groupData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Jumlah Entri per Group</CardTitle>
            <CardDescription>Top {groupData.length} group berdasarkan jumlah data</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barChartConfig} className="max-h-[320px]">
              <BarChart data={groupData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid horizontal={false} className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Data Entri Terbaru
          </CardTitle>
          <CardDescription>10 data entri terakhir yang bisa Anda akses</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data entri</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleFields.map((f) => (
                      <TableHead key={f.field_name}>{FIELD_LABELS[f.field_name] || f.field_name}</TableHead>
                    ))}
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      {visibleFields.map((f) => (
                        <TableCell key={f.field_name} className="text-sm">
                          {getCellValue(entry, f.field_name)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[entry.status] || "outline"}>
                          {STATUS_LABELS[entry.status] || entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleDateString("id-ID")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
