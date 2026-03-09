import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Palette, Type, Image as ImageIcon, ShieldCheck, ClipboardCheck, FileText, Users2, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAllFieldAccess } from "@/hooks/useFieldAccess";

interface OwnerPricing {
  id: string;
  owner_id: string | null;
  pricing_type: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  owner_name?: string;
}

const PRICING_TYPES = [
  { key: "per_certificate", label: "Per Sertifikat" },
  { key: "per_group", label: "Per Group" },
  { key: "monthly", label: "Bulanan" },
  { key: "custom", label: "Custom" },
];

function OwnerPricingTab() {
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [pricing, setPricing] = useState<OwnerPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedOwner, setSelectedOwner] = useState<string>("global");
  const [selectedType, setSelectedType] = useState<string>("per_certificate");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    // Fetch owners
    const { data: ownerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");
    
    if (ownerRoles && ownerRoles.length > 0) {
      const ownerIds = ownerRoles.map((o) => o.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ownerIds);
      setOwners(
        (profiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name || p.email || "Unknown",
        }))
      );
    }

    // Fetch pricing
    const { data: pricingData } = await supabase
      .from("owner_pricing")
      .select("*")
      .order("created_at", { ascending: true });
    setPricing((pricingData as OwnerPricing[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const ownerId = selectedOwner === "global" ? null : selectedOwner;

    await supabase
      .from("owner_pricing")
      .upsert(
        {
          owner_id: ownerId,
          pricing_type: selectedType,
          amount,
          description: description || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    setSaving(false);
    toast({ title: "Harga berhasil disimpan" });
    fetchData();
    // Reset form
    setSelectedOwner("global");
    setSelectedType("per_certificate");
    setAmount(0);
    setDescription("");
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users2 className="h-5 w-5" /> Harga per Owner
          </CardTitle>
          <CardDescription>
            Set harga default (global) atau khusus untuk owner tertentu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Default (Semua Owner)</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipe Harga</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                min={0}
                step={10000}
              />
            </div>
            <div className="space-y-2">
              <Label>Keterangan (opsional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Keterangan tambahan"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Harga
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Harga Terdaftar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pricing.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Belum ada harga yang diatur</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.owner_id ? owners.find((o) => o.id === p.owner_id)?.name || "Unknown" : "Default (Global)"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PRICING_TYPES.find((t) => t.key === p.pricing_type)?.label || p.pricing_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  const [savingSiapInput, setSavingSiapInput] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [certFee, setCertFee] = useState(0);
  // Siap Input required fields
  const [siapInputFields, setSiapInputFields] = useState<string[]>(["nama", "ktp", "nib", "foto_produk", "foto_verifikasi"]);

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
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="tampilan" className="gap-1 text-xs sm:text-sm">
            <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Tampilan</span><span className="sm:hidden">UI</span>
          </TabsTrigger>
          <TabsTrigger value="akses" className="gap-1 text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Akses
          </TabsTrigger>
          <TabsTrigger value="siap_input" className="gap-1 text-xs sm:text-sm">
            <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Siap Input</span><span className="sm:hidden">Input</span>
          </TabsTrigger>
          <TabsTrigger value="tarif" className="gap-1 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Tarif Sertifikat</span><span className="sm:hidden">Tarif</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Harga Owner</span><span className="sm:hidden">Owner</span>
          </TabsTrigger>
          <TabsTrigger value="kuota" className="gap-1 text-xs sm:text-sm">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Kuota
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


        <TabsContent value="tarif" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" /> Tarif per Sertifikat
              </CardTitle>
              <CardDescription>
                Biaya yang ditagihkan ke Owner setiap kali sertifikat halal selesai diproses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">Biaya per Sertifikat Selesai</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    value={certFee}
                    onChange={e => setCertFee(parseInt(e.target.value) || 0)}
                    className="w-40 text-right font-mono"
                    min={0}
                    step={10000}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tagihan akan otomatis dibuat untuk Owner ketika status entry berubah ke "Sertifikat Selesai"
              </p>
            </CardContent>
          </Card>

          <Button
            onClick={async () => {
              setSavingFee(true);
              await (supabase as any)
                .from("certificate_fees")
                .update({ amount: certFee, updated_at: new Date().toISOString() })
                .neq("id", "00000000-0000-0000-0000-000000000000");
              setSavingFee(false);
              toast({ title: "Tarif sertifikat berhasil disimpan" });
            }}
            disabled={savingFee}
            className="w-full gap-2"
          >
            {savingFee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Tarif Sertifikat
          </Button>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6 mt-4">
          <OwnerPricingTab />
        </TabsContent>

        <TabsContent value="kuota" className="space-y-6 mt-4">
          <OwnerQuotaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
