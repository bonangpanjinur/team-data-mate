import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Wallet } from "lucide-react";

const TEAM_ROLES = [
  { key: "admin", label: "Admin" },
  { key: "lapangan", label: "Lapangan" },
  { key: "nib", label: "NIB" },
  { key: "admin_input", label: "Admin Input" },
];

export default function OwnerCommissionRates() {
  const { user, role } = useAuth();
  const [rates, setRates] = useState<Record<string, number>>({
    admin: 0,
    lapangan: 0,
    nib: 0,
    admin_input: 0,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("commission_rates")
        .select("role, amount_per_entry, owner_id")
        .eq("owner_id", user.id);
      if (data) {
        const r: Record<string, number> = { admin: 0, lapangan: 0, nib: 0, admin_input: 0 };
        data.forEach((row: any) => { r[row.role] = row.amount_per_entry; });
        setRates(r);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    for (const [r, amount] of Object.entries(rates)) {
      await supabase
        .from("commission_rates")
        .upsert(
          { role: r as any, amount_per_entry: amount, owner_id: user.id, updated_at: new Date().toISOString() } as any,
          { onConflict: "role,owner_id" } as any
        );
    }
    setSaving(false);
    toast({ title: "Tarif komisi tim berhasil disimpan" });
  };

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Halaman ini hanya untuk Owner.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Tarif Komisi Tim</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" /> Komisi per Data
          </CardTitle>
          <CardDescription>
            Atur jumlah komisi (Rupiah) yang dibayarkan ke tim Anda per data yang berhasil diproses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            TEAM_ROLES.map(r => (
              <div key={r.key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    value={rates[r.key] ?? 0}
                    onChange={e => setRates(prev => ({ ...prev, [r.key]: parseInt(e.target.value) || 0 }))}
                    className="w-32 text-right font-mono"
                    min={0}
                    step={1000}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || loading} className="w-full gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Simpan Tarif Komisi
      </Button>
    </div>
  );
}
