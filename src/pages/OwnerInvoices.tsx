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
import { FileText, Clock, CheckCircle, Download, CalendarIcon, Loader2 } from "lucide-react";

interface Invoice {
  id: string;
  owner_id: string;
  entry_id: string | null;
  group_id: string | null;
  amount: number;
  status: string;
  period: string | null;
  created_at: string;
  paid_at: string | null;
  entry_name?: string;
  group_name?: string;
  owner_name?: string;
}

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

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function OwnerInvoices() {
  const { user, role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("owner_invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isSuperAdmin) {
      query = query.eq("owner_id", user.id);
    }
    if (selectedPeriod !== "all") {
      query = query.eq("period", selectedPeriod);
    }

    const { data } = await query;
    if (data) {
      // Enrich with entry names and group names
      const entryIds = [...new Set(data.map((i: any) => i.entry_id).filter(Boolean))];
      const groupIds = [...new Set(data.map((i: any) => i.group_id).filter(Boolean))];
      const ownerIds = isSuperAdmin ? [...new Set(data.map((i: any) => i.owner_id))] : [];

      let entryMap = new Map<string, string>();
      let groupMap = new Map<string, string>();
      let ownerMap = new Map<string, string>();

      if (entryIds.length > 0) {
        const { data: entries } = await supabase.from("data_entries").select("id, nama").in("id", entryIds);
        entryMap = new Map(entries?.map((e: any) => [e.id, e.nama || "-"]) || []);
      }
      if (groupIds.length > 0) {
        const { data: groups } = await supabase.from("groups").select("id, name").in("id", groupIds);
        groupMap = new Map(groups?.map((g: any) => [g.id, g.name]) || []);
      }
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
        ownerMap = new Map(profiles?.map((p: any) => [p.id, p.full_name || p.email || p.id.slice(0, 8)]) || []);
      }

      setInvoices(data.map((i: any) => ({
        ...i,
        entry_name: entryMap.get(i.entry_id) || "-",
        group_name: groupMap.get(i.group_id) || "-",
        owner_name: ownerMap.get(i.owner_id) || "-",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [user, selectedPeriod]);

  const totalAll = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  const handleMarkPaid = async (ids: string[]) => {
    const { error } = await supabase
      .from("owner_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() } as any)
      .in("id", ids);
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tagihan ditandai sudah dibayar" });
      fetchInvoices();
    }
  };

  const pendingIds = invoices.filter(i => i.status === "pending").map(i => i.id);

  const exportCSV = () => {
    if (invoices.length === 0) return toast({ title: "Tidak ada data", variant: "destructive" });
    const header = isSuperAdmin
      ? ["Owner", "Data", "Group", "Jumlah", "Periode", "Status", "Tanggal", "Tgl Bayar"]
      : ["Data", "Group", "Jumlah", "Periode", "Status", "Tanggal", "Tgl Bayar"];
    const rows = invoices.map(i => {
      const base = [
        i.entry_name || "-",
        i.group_name || "-",
        i.amount.toString(),
        i.period || "-",
        i.status === "paid" ? "Lunas" : "Belum Bayar",
        new Date(i.created_at).toLocaleDateString("id-ID"),
        i.paid_at ? new Date(i.paid_at).toLocaleDateString("id-ID") : "-",
      ];
      return isSuperAdmin ? [i.owner_name || "-", ...base] : base;
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tagihan-${selectedPeriod === "all" ? "semua" : selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export berhasil" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {isSuperAdmin ? "Tagihan Owner" : "Tagihan Saya"}
        </h1>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-44">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>
              {periodOptions.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Tagihan</p>
              <p className="text-lg font-bold">{formatRp(totalAll)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-yellow-500/10 p-2"><Clock className="h-5 w-5 text-yellow-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Belum Bayar</p>
              <p className="text-lg font-bold">{formatRp(totalPending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2"><CheckCircle className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Sudah Lunas</p>
              <p className="text-lg font-bold">{formatRp(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk pay for super_admin */}
      {isSuperAdmin && pendingIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">{pendingIds.length} tagihan belum lunas</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm">Lunaskan Semua</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lunaskan Semua Tagihan?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingIds.length} tagihan senilai {formatRp(totalPending)} akan ditandai lunas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleMarkPaid(pendingIds)}>Ya, Lunaskan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Tagihan</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {isSuperAdmin && <TableHead>Owner</TableHead>}
                  <TableHead>Data</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  {isSuperAdmin && <TableHead className="w-20">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isSuperAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={isSuperAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground">Belum ada tagihan</TableCell></TableRow>
                ) : invoices.map(inv => (
                  <TableRow key={inv.id}>
                    {isSuperAdmin && <TableCell className="text-sm">{inv.owner_name}</TableCell>}
                    <TableCell className="font-medium">{inv.entry_name}</TableCell>
                    <TableCell className="text-sm">{inv.group_name}</TableCell>
                    <TableCell className="font-mono">{formatRp(inv.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.period || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                        {inv.status === "paid" ? "Lunas" : "Belum Bayar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("id-ID")}</TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        {inv.status === "pending" && (
                          <Button variant="ghost" size="sm" onClick={() => handleMarkPaid([inv.id])}>Lunaskan</Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : invoices.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Belum ada tagihan</p>
            ) : invoices.map(inv => (
              <div key={inv.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{inv.entry_name}</span>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                    {inv.status === "paid" ? "Lunas" : "Belum Bayar"}
                  </Badge>
                </div>
                {isSuperAdmin && <p className="text-xs text-muted-foreground">Owner: {inv.owner_name}</p>}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{formatRp(inv.amount)}</span>
                  <span className="text-xs text-muted-foreground">{inv.period || "-"}</span>
                </div>
                {isSuperAdmin && inv.status === "pending" && (
                  <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => handleMarkPaid([inv.id])}>Lunaskan</Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
