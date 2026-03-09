import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Wallet, TrendingUp, Clock, CheckCircle, Download, CalendarIcon } from "lucide-react";

interface Commission {
  id: string;
  user_id: string;
  entry_id: string;
  group_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  period: string | null;
  entry_name?: string;
  user_name?: string;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

// Generate month options from current month back 12 months
function generatePeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

export default function Komisi() {
  const { user, role } = useAuth();
  const isAdmin = role === "super_admin" || role === "admin";
  const isOwner = role === "owner";
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("mine");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  const fetchCommissions = async () => {
    if (!user) return;
    setLoading(true);

    const targetUserId = (isAdmin || isOwner) && selectedUser !== "mine" ? selectedUser : user.id;

    let query = supabase
      .from("commissions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (selectedPeriod !== "all") {
      query = query.eq("period", selectedPeriod);
    }

    const { data } = await query;

    if (data) {
      const entryIds = [...new Set(data.map((c: any) => c.entry_id).filter(Boolean))];
      let entryMap = new Map<string, string>();
      if (entryIds.length > 0) {
        const { data: entries } = await supabase
          .from("data_entries")
          .select("id, nama")
          .in("id", entryIds);
        entryMap = new Map(entries?.map((e: any) => [e.id, e.nama || "-"]) || []);
      }

      setCommissions(
        data.map((c: any) => ({ ...c, entry_name: entryMap.get(c.entry_id) || "-" }))
      );
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    if (!isAdmin && !isOwner) return;
    const { data } = await supabase.from("profiles").select("id, full_name, email");
    setUsers(data ?? []);
  };

  useEffect(() => {
    fetchCommissions();
    if (isAdmin || isOwner) fetchUsers();
  }, [user, selectedUser, selectedPeriod]);

  const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
  const totalPending = commissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amount, 0);
  const lastPaidAt = commissions
    .filter((c) => c.status === "paid" && c.paid_at)
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())[0]?.paid_at;
  const currentPeriodEarned = commissions
    .filter((c) => c.period === currentPeriod)
    .reduce((sum, c) => sum + c.amount, 0);

  const handleMarkPaid = async (ids: string[]) => {
    const { error } = await supabase
      .from("commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() } as any)
      .in("id", ids);
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Komisi ditandai sudah dibayar" });
      fetchCommissions();
    }
  };

  const pendingIds = commissions.filter((c) => c.status === "pending").map((c) => c.id);

  const formatRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  const exportCSV = () => {
    if (commissions.length === 0) {
      toast({ title: "Tidak ada data untuk diexport", variant: "destructive" });
      return;
    }
    const header = ["Data", "Jumlah", "Periode", "Status", "Tanggal", "Tanggal Cair"];
    const rows = commissions.map((c) => [
      c.entry_name || "-",
      c.amount.toString(),
      c.period || "-",
      c.status === "paid" ? "Sudah Ditransfer" : "Pending",
      new Date(c.created_at).toLocaleDateString("id-ID"),
      c.status === "paid" && c.paid_at ? new Date(c.paid_at).toLocaleDateString("id-ID") : "-",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const userName = selectedUser === "mine" ? "saya" : users.find((u) => u.id === selectedUser)?.full_name || "user";
    const periodLabel = selectedPeriod === "all" ? "semua" : selectedPeriod;
    a.download = `laporan-komisi-${userName}-${periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Laporan berhasil didownload" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Komisi & Saldo</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period filter */}
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-44">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>
              {periodOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(isAdmin || isOwner) && (
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Lihat komisi user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Komisi Saya</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email || u.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(isAdmin || isOwner) && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Komisi</p>
              <p className="text-lg font-bold">{formatRp(totalEarned)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-yellow-500/10 p-2">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Belum Cair</p>
              <p className="text-lg font-bold">{formatRp(totalPending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sudah Ditransfer</p>
              <p className="text-lg font-bold">{formatRp(totalPaid)}</p>
              {lastPaidAt && (
                <p className="text-[10px] text-muted-foreground">
                  Transfer terakhir: {new Date(lastPaidAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Periode Ini</p>
              <p className="text-lg font-bold">{formatRp(currentPeriodEarned)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action bar for admin */}
      {(isAdmin || isOwner) && pendingIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            {pendingIds.length} komisi pending
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm">Cairkan Semua Pending</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cairkan Semua Komisi Pending?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingIds.length} komisi senilai {formatRp(totalPending)} akan ditandai sebagai sudah dibayar. Tindakan ini tidak bisa dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMarkPaid(pendingIds)}>Ya, Cairkan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Commission List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Komisi</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tanggal Cair</TableHead>
                   {(isAdmin || isOwner) && <TableHead className="w-20">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                     <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell>
                  </TableRow>
                ) : commissions.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                       Belum ada komisi{selectedPeriod !== "all" ? ` untuk periode ${selectedPeriod}` : ""}
                     </TableCell>
                  </TableRow>
                ) : (
                  commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.entry_name}</TableCell>
                      <TableCell className="font-mono">{formatRp(c.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.period || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "paid" ? "default" : "secondary"}>
                          {c.status === "paid" ? "Cair" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                         {new Date(c.created_at).toLocaleDateString("id-ID")}
                       </TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {c.status === "paid" && c.paid_at
                           ? new Date(c.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                           : "-"}
                       </TableCell>
                       {isAdmin && (
                        <TableCell>
                          {c.status === "pending" && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkPaid([c.id])}>Cairkan</Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Memuat...</p>
            ) : commissions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Belum ada komisi{selectedPeriod !== "all" ? ` untuk periode ${selectedPeriod}` : ""}
              </p>
            ) : commissions.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{c.entry_name}</span>
                  <Badge variant={c.status === "paid" ? "default" : "secondary"}>
                    {c.status === "paid" ? "Cair" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{formatRp(c.amount)}</span>
                  <span className="text-xs text-muted-foreground">{c.period || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(c.created_at).toLocaleDateString("id-ID")}</span>
                  {c.status === "paid" && c.paid_at && (
                    <span>Cair: {new Date(c.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                  )}
                </div>
                {isAdmin && c.status === "pending" && (
                  <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => handleMarkPaid([c.id])}>Cairkan</Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}