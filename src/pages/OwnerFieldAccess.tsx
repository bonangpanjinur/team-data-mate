import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { useOwnerFieldAccess, FieldAccess } from "@/hooks/useFieldAccess";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const TEAM_ROLES: { key: AppRole; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "admin_input", label: "Admin Input" },
  { key: "lapangan", label: "Lapangan" },
  { key: "nib", label: "NIB" },
];

const FIELDS = [
  { key: "nama", label: "Nama" },
  { key: "alamat", label: "Alamat" },
  { key: "nomor_hp", label: "Nomor HP" },
  { key: "ktp", label: "Foto KTP" },
  { key: "nib", label: "NIB" },
  { key: "foto_produk", label: "Foto Produk" },
  { key: "foto_verifikasi", label: "Foto Verifikasi" },
  { key: "sertifikat", label: "Sertifikat Halal" },
];

export default function OwnerFieldAccess() {
  const { user, role } = useAuth();
  const { allAccess, loading, refetch, ownerId } = useOwnerFieldAccess();
  const [localAccess, setLocalAccess] = useState<Record<string, Record<string, { can_view: boolean; can_edit: boolean }>>>({});
  const [saving, setSaving] = useState(false);

  // Initialize local state from fetched data
  useEffect(() => {
    if (Object.keys(allAccess).length > 0) {
      const mapped: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {};
      for (const [r, fields] of Object.entries(allAccess)) {
        mapped[r] = {};
        (fields as FieldAccess[]).forEach((f) => {
          mapped[r][f.field_name] = { can_view: f.can_view, can_edit: f.can_edit };
        });
      }
      setLocalAccess(mapped);
    } else {
      // Initialize empty structure for all roles and fields
      const initial: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {};
      TEAM_ROLES.forEach((r) => {
        initial[r.key] = {};
        FIELDS.forEach((f) => {
          initial[r.key][f.key] = { can_view: true, can_edit: true };
        });
      });
      setLocalAccess(initial);
    }
  }, [allAccess]);

  const toggleAccess = (roleKey: string, fieldKey: string, type: "can_view" | "can_edit") => {
    setLocalAccess((prev) => {
      const updated = { ...prev };
      if (!updated[roleKey]) updated[roleKey] = {};
      if (!updated[roleKey][fieldKey]) updated[roleKey][fieldKey] = { can_view: false, can_edit: false };
      updated[roleKey][fieldKey] = { ...updated[roleKey][fieldKey], [type]: !updated[roleKey][fieldKey][type] };
      // If can_edit is enabled, can_view must be true
      if (type === "can_edit" && updated[roleKey][fieldKey].can_edit) {
        updated[roleKey][fieldKey].can_view = true;
      }
      // If can_view disabled, disable can_edit too
      if (type === "can_view" && !updated[roleKey][fieldKey].can_view) {
        updated[roleKey][fieldKey].can_edit = false;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!ownerId) return;
    setSaving(true);

    const updates: { owner_id: string; role: AppRole; field_name: string; can_view: boolean; can_edit: boolean }[] = [];
    for (const [r, fields] of Object.entries(localAccess)) {
      for (const [f, perms] of Object.entries(fields)) {
        updates.push({
          owner_id: ownerId,
          role: r as AppRole,
          field_name: f,
          can_view: perms.can_view,
          can_edit: perms.can_edit,
        });
      }
    }

    for (const u of updates) {
      await supabase
        .from("owner_field_access")
        .upsert(
          {
            owner_id: u.owner_id,
            role: u.role,
            field_name: u.field_name,
            can_view: u.can_view,
            can_edit: u.can_edit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner_id,role,field_name" }
        );
    }

    setSaving(false);
    refetch();
    toast({ title: "Pengaturan akses berhasil disimpan" });
  };

  if (role !== "owner") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Owner yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Akses Field Tim
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Atur field mana yang bisa dilihat dan diedit oleh setiap role dalam tim Anda
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pengaturan Akses per Role</CardTitle>
          <CardDescription>
            View = bisa melihat data, Edit = bisa mengubah data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {TEAM_ROLES.map((r) => (
                <div key={r.key} className="space-y-3">
                  <h3 className="font-semibold text-sm border-b pb-2">{r.label}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FIELDS.map((f) => {
                      const perms = localAccess[r.key]?.[f.key] || { can_view: true, can_edit: true };
                      return (
                        <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                          <span className="text-sm font-medium">{f.label}</span>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={perms.can_view}
                                onCheckedChange={() => toggleAccess(r.key, f.key, "can_view")}
                                className="scale-90"
                              />
                              <span className="text-xs text-muted-foreground">View</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={perms.can_edit}
                                onCheckedChange={() => toggleAccess(r.key, f.key, "can_edit")}
                                className="scale-90"
                              />
                              <span className="text-xs text-muted-foreground">Edit</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Simpan Pengaturan Akses
      </Button>
    </div>
  );
}
