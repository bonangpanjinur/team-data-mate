import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Palette, Type, Image as ImageIcon, ShieldCheck, Wallet, ClipboardCheck, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAllFieldAccess } from "@/hooks/useFieldAccess";

const COLOR_PRESETS = [
  { label: "Biru Profesional", value: "217 91% 50%" },
  { label: "Hijau Halal", value: "142 71% 40%" },
  { label: "Teal Modern", value: "174 72% 40%" },
  { label: "Ungu Elegan", value: "262 83% 58%" },
  { label: "Oranye Hangat", value: "25 95% 53%" },
  { label: "Merah Tegas", value: "0 84% 50%" },
];

const ROLES = [
  { key: "super_admin", label: "Super Admin" },
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

export default function AppSettings() {
  const { role } = useAuth();
  const [appName, setAppName] = useState("HalalTrack");
  const [primaryColor, setPrimaryColor] = useState("217 91% 50%");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [savingSiapInput, setSavingSiapInput] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [certFee, setCertFee] = useState(0);
  // Siap Input required fields
  const [siapInputFields, setSiapInputFields] = useState<string[]>(["nama", "ktp", "nib", "foto_produk", "foto_verifikasi"]);

  // Commission rates
  const [rates, setRates] = useState<Record<string, number>>({
    super_admin: 0,
    admin: 5000,
    admin_input: 0,
    lapangan: 10000,
    nib: 5000,
  });

  const { allAccess, loading: accessLoading, refetch: refetchAccess } = useAllFieldAccess();

  // Local editable copy of field access
  const [localAccess, setLocalAccess] = useState<Record<string, Record<string, { can_view: boolean; can_edit: boolean }>>>({});

  useEffect(() => {
    if (Object.keys(allAccess).length > 0) {
      const mapped: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {};
      for (const [r, fields] of Object.entries(allAccess)) {
        mapped[r] = {};
        fields.forEach((f) => {
          mapped[r][f.field_name] = { can_view: f.can_view, can_edit: f.can_edit };
        });
      }
      setLocalAccess(mapped);
    }
  }, [allAccess]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      if (data) {
        data.forEach((row: any) => {
          if (row.key === "app_name") setAppName(row.value ?? "HalalTrack");
          if (row.key === "primary_color") setPrimaryColor(row.value ?? "217 91% 50%");
          if (row.key === "logo_url") setLogoUrl(row.value ?? "");
          if (row.key === "siap_input_required_fields") {
            try { setSiapInputFields(JSON.parse(row.value ?? "[]")); } catch {}
          }
        });
      }
    };
    load();

    // Load certificate fee
    const loadFee = async () => {
      const { data } = await (supabase as any).from("certificate_fees").select("amount").limit(1).single();
      if (data) setCertFee(data.amount);
    };
    loadFee();
  }, []);

  // Load commission rates
  useEffect(() => {
    const loadRates = async () => {
      const { data } = await supabase.from("commission_rates").select("role, amount_per_entry");
      if (data) {
        const r: Record<string, number> = {};
        data.forEach((row: any) => { r[row.role] = row.amount_per_entry; });
        setRates(r);
      }
    };
    loadRates();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", primaryColor);
    return () => { document.documentElement.style.removeProperty("--primary"); };
  }, [primaryColor]);

  const handleSave = async () => {
    setSaving(true);
    const updates = [
      { key: "app_name", value: appName },
      { key: "primary_color", value: primaryColor },
      { key: "logo_url", value: logoUrl },
    ];

    for (const u of updates) {
      await supabase
        .from("app_settings")
        .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }

    setSaving(false);
    toast({ title: "Pengaturan berhasil disimpan" });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `logo/app-logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("product-photos").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Gagal upload logo", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-photos").getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Logo berhasil diupload" });
  };

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

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    const updates: { role: string; field_name: string; can_view: boolean; can_edit: boolean }[] = [];
    for (const [r, fields] of Object.entries(localAccess)) {
      for (const [f, perms] of Object.entries(fields)) {
        updates.push({ role: r, field_name: f, can_view: perms.can_view, can_edit: perms.can_edit });
      }
    }

    for (const u of updates) {
      await supabase
        .from("field_access")
        .upsert(
          { role: u.role as any, field_name: u.field_name, can_view: u.can_view, can_edit: u.can_edit, updated_at: new Date().toISOString() },
          { onConflict: "role,field_name" }
        );
    }

    setSavingAccess(false);
    refetchAccess();
    toast({ title: "Hak akses berhasil disimpan" });
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    for (const [r, amount] of Object.entries(rates)) {
      await supabase
        .from("commission_rates")
        .upsert(
          { role: r as any, amount_per_entry: amount, updated_at: new Date().toISOString() },
          { onConflict: "role" }
        );
    }
    setSavingRates(false);
    toast({ title: "Tarif komisi berhasil disimpan" });
  };

  if (role !== "super_admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Hanya Super Admin yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Pengaturan</h1>

      <Tabs defaultValue="tampilan">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="tampilan" className="gap-1 text-xs sm:text-sm">
            <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Tampilan</span><span className="sm:hidden">UI</span>
          </TabsTrigger>
          <TabsTrigger value="akses" className="gap-1 text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Akses
          </TabsTrigger>
          <TabsTrigger value="siap_input" className="gap-1 text-xs sm:text-sm">
            <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Siap Input</span><span className="sm:hidden">Input</span>
          </TabsTrigger>
          <TabsTrigger value="komisi" className="gap-1 text-xs sm:text-sm">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Komisi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tampilan" className="space-y-6 mt-4">
          {/* App Name */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="h-5 w-5" /> Nama Aplikasi
              </CardTitle>
              <CardDescription>Nama yang tampil di sidebar dan halaman login</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Nama Aplikasi" />
            </CardContent>
          </Card>

          {/* Primary Color */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5" /> Warna Utama
              </CardTitle>
              <CardDescription>Pilih warna utama aplikasi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setPrimaryColor(preset.value)}
                    className={`group flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${
                      primaryColor === preset.value ? "border-primary shadow-md" : "border-transparent hover:border-border"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full shadow-sm ring-1 ring-border" style={{ backgroundColor: `hsl(${preset.value})` }} />
                    <span className="text-[10px] text-muted-foreground leading-tight text-center">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>HSL Kustom</Label>
                <div className="flex items-center gap-3">
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="217 91% 50%" className="font-mono text-sm" />
                  <div className="h-9 w-9 shrink-0 rounded-lg border shadow-sm" style={{ backgroundColor: `hsl(${primaryColor})` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5" /> Logo Aplikasi
              </CardTitle>
              <CardDescription>Upload logo yang tampil di sidebar (opsional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logoUrl && (
                <div className="flex items-center gap-4">
                  <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-lg border object-contain bg-background p-1" />
                  <Button variant="outline" size="sm" onClick={() => setLogoUrl("")}>Hapus Logo</Button>
                </div>
              )}
              <div className="space-y-2">
                <Label>Upload Logo Baru</Label>
                <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                {uploading && <p className="text-sm text-muted-foreground">Mengupload...</p>}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg border p-4" style={{ backgroundColor: `hsl(${primaryColor} / 0.08)` }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `hsl(${primaryColor})` }}>
                    <span className="text-sm font-bold text-white">{appName.charAt(0)}</span>
                  </div>
                )}
                <span className="font-bold" style={{ color: `hsl(${primaryColor})` }}>{appName}</span>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan Tampilan
          </Button>
        </TabsContent>

        <TabsContent value="akses" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" /> Hak Akses Field per Role
              </CardTitle>
              <CardDescription>
                Atur field mana yang bisa dilihat (View) dan diedit (Edit) oleh setiap role
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accessLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {ROLES.map((r) => (
                    <div key={r.key} className="space-y-3">
                      <h3 className="font-semibold text-sm border-b pb-2">{r.label}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {FIELDS.map((f) => {
                          const perms = localAccess[r.key]?.[f.key] || { can_view: false, can_edit: false };
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

          <Button onClick={handleSaveAccess} disabled={savingAccess} className="w-full gap-2">
            {savingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Hak Akses
          </Button>
        </TabsContent>

        <TabsContent value="siap_input" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5" /> Syarat Status "Siap Input"
              </CardTitle>
              <CardDescription>
                Pilih field yang harus terisi agar status data otomatis berubah menjadi "Siap Input"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox
                    id={`siap-${f.key}`}
                    checked={siapInputFields.includes(f.key)}
                    onCheckedChange={(checked) => {
                      setSiapInputFields((prev) =>
                        checked ? [...prev, f.key] : prev.filter((k) => k !== f.key)
                      );
                    }}
                  />
                  <label htmlFor={`siap-${f.key}`} className="text-sm font-medium cursor-pointer flex-1">
                    {f.label}
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            onClick={async () => {
              setSavingSiapInput(true);
              await supabase
                .from("app_settings")
                .upsert(
                  { key: "siap_input_required_fields", value: JSON.stringify(siapInputFields), updated_at: new Date().toISOString() },
                  { onConflict: "key" }
                );
              setSavingSiapInput(false);
              toast({ title: "Pengaturan siap input berhasil disimpan" });
            }}
            disabled={savingSiapInput}
            className="w-full gap-2"
          >
            {savingSiapInput ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan Siap Input
          </Button>
        </TabsContent>

        <TabsContent value="komisi" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5" /> Tarif Komisi per Role
              </CardTitle>
              <CardDescription>
                Atur jumlah komisi (Rupiah) per data baru yang berhasil diinput oleh masing-masing role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ROLES.map((r) => (
                <div key={r.key} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{r.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rp</span>
                    <Input
                      type="number"
                      value={rates[r.key] ?? 0}
                      onChange={(e) => setRates((prev) => ({ ...prev, [r.key]: parseInt(e.target.value) || 0 }))}
                      className="w-32 text-right font-mono"
                      min={0}
                      step={1000}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button onClick={handleSaveRates} disabled={savingRates} className="w-full gap-2">
            {savingRates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Tarif Komisi
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
