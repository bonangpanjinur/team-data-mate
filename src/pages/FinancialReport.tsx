import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, TrendingUp, TrendingDown, CalendarIcon, Loader2, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function generateYearOptions(): string[] {
  const now = new Date().getFullYear();
  return [now.toString(), (now - 1).toString()];
}

export default function FinancialReport() {
  const { user, role } = useAuth();
  const isOwner = role === "owner";
  const isSuperAdmin = role === "super_admin";
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const yearOptions = useMemo(() => generateYearOptions(), []);

  // Data
  const [invoiceData, setInvoiceData] = useState<any[]>([]);
  const [commissionData, setCommissionData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // Fetch invoices for the year
      let invQuery = supabase
        .from("owner_invoices")
        .select("amount, status, period, owner_id")
        .like("period", `${selectedYear}-%`);
      if (isOwner) invQuery = invQuery.eq("owner_id", user.id);

      const { data: invs } = await invQuery;
      setInvoiceData(invs || []);

      // Fetch commissions for the year (owner sees their group commissions)
      if (isOwner) {
        const { data: comms } = await supabase
          .from("commissions")
          .select("amount, status, period, group_id")
          .like("period", `${selectedYear}-%`);
        setCommissionData(comms || []);
      } else if (isSuperAdmin) {
        // Super admin sees all commissions
        const { data: comms } = await supabase
          .from("commissions")
          .select("amount, status, period")
          .like("period", `${selectedYear}-%`);
        setCommissionData(comms || []);
      }

      setLoading(false);
    };
    load();
  }, [user, selectedYear]);

  // Aggregate by month
  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const period = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
      const monthInvoices = invoiceData.filter((d: any) => d.period === period);
      const monthComms = commissionData.filter((d: any) => d.period === period);

      const tagihan = monthInvoices.reduce((s: number, d: any) => s + d.amount, 0);
      const komisi = monthComms.reduce((s: number, d: any) => s + d.amount, 0);

      return {
        month: MONTHS[i],
        tagihan,
        komisi,
        profit: isOwner ? -(tagihan + komisi) : tagihan, // For super_admin, revenue = invoices
      };
    });
  }, [invoiceData, commissionData, selectedYear, isOwner]);

  const totalInvoices = invoiceData.reduce((s: number, d: any) => s + d.amount, 0);
  const totalPaidInvoices = invoiceData.filter((d: any) => d.status === "paid").reduce((s: number, d: any) => s + d.amount, 0);
  const totalCommissions = commissionData.reduce((s: number, d: any) => s + d.amount, 0);

  const exportCSV = () => {
    const header = ["Bulan", "Tagihan Platform", "Komisi Tim", isOwner ? "Pengeluaran Total" : "Pendapatan"];
    const rows = chartData.map(d => [d.month, d.tagihan.toString(), d.komisi.toString(), (isOwner ? d.tagihan + d.komisi : d.tagihan).toString()]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export berhasil" });
  };

  if (!isOwner && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Laporan Keuangan</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin ? "Total Pendapatan Platform" : "Total Tagihan Platform"}
                  </p>
                  <p className="text-lg font-bold">{formatRp(totalInvoices)}</p>
                  {isSuperAdmin && (
                    <p className="text-[10px] text-muted-foreground">Lunas: {formatRp(totalPaidInvoices)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-destructive/10 p-2"><TrendingDown className="h-5 w-5 text-destructive" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin ? "Total Komisi Semua Tim" : "Total Komisi Tim Saya"}
                  </p>
                  <p className="text-lg font-bold">{formatRp(totalCommissions)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-500/10 p-2"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin ? "Net Pendapatan" : "Total Pengeluaran"}
                  </p>
                  <p className="text-lg font-bold">
                    {formatRp(isSuperAdmin ? totalInvoices - totalCommissions : totalInvoices + totalCommissions)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grafik Keuangan Bulanan {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis tickFormatter={(v) => `${(v / 1000)}k`} className="text-xs" />
                    <Tooltip formatter={(value: number) => formatRp(value)} />
                    <Legend />
                    <Bar dataKey="tagihan" name="Tagihan Platform" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="komisi" name="Komisi Tim" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
