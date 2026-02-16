import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Camera, Upload, MapPin, ArrowLeft, X, Image as ImageIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type DataEntry = Tables<"data_entries">;

interface Props {
  groupId: string;
  entry?: DataEntry | null;
  onCancel: () => void;
  onSaved: () => void;
  isPublic?: boolean;
  sharedLinkUserId?: string;
}

function ImagePreview({ file, existingUrl, onRemoveFile }: { file: File | null; existingUrl?: string | null; onRemoveFile: () => void }) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const src = previewUrl || existingUrl;

  if (!src) return null;

  return (
    <div className="relative mt-2 inline-block">
      <img
        src={src}
        alt="Preview"
        className="h-24 w-24 rounded-lg border border-border object-cover"
        onLoad={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); }}
      />
      {file && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -right-2 -top-2 h-5 w-5 rounded-full"
          onClick={onRemoveFile}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      {!file && existingUrl && (
        <p className="mt-1 text-xs text-muted-foreground text-center">Tersimpan ✓</p>
      )}
    </div>
  );
}

export default function DataEntryForm({ groupId, entry, onCancel, onSaved, isPublic, sharedLinkUserId }: Props) {
  const { role, user } = useAuth();
  const [nama, setNama] = useState(entry?.nama ?? "");
  const [alamat, setAlamat] = useState(entry?.alamat ?? "");
  const [nomorHp, setNomorHp] = useState(entry?.nomor_hp ?? "");
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // File states
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [nibFile, setNibFile] = useState<File | null>(null);
  const [produkFile, setProdukFile] = useState<File | null>(null);
  const [verifikasiFile, setVerifikasiFile] = useState<File | null>(null);

  // Refs for camera inputs
  const ktpCameraRef = useRef<HTMLInputElement>(null);
  const ktpFileRef = useRef<HTMLInputElement>(null);
  const produkCameraRef = useRef<HTMLInputElement>(null);
  const produkFileRef = useRef<HTMLInputElement>(null);
  const verifikasiCameraRef = useRef<HTMLInputElement>(null);
  const verifikasiFileRef = useRef<HTMLInputElement>(null);
  const nibFileRef = useRef<HTMLInputElement>(null);

  const currentRole = isPublic ? "public" : role;

  const canEdit = (field: string) => {
    if (currentRole === "super_admin" || currentRole === "admin") return true;
    if (currentRole === "lapangan" || currentRole === "public") {
      return ["nama", "ktp", "alamat", "nomor_hp"].includes(field);
    }
    if (currentRole === "nib") return field === "nib";
    return false;
  };

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      toast({ title: "Upload gagal", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const getLocation = async () => {
    setGettingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await res.json();
      setAlamat(data.display_name || `${latitude}, ${longitude}`);
    } catch {
      toast({ title: "Gagal mendapatkan lokasi", variant: "destructive" });
    }
    setGettingLocation(false);
  };

  const handleSave = async () => {
    setSaving(true);

    let ktp_url = entry?.ktp_url ?? null;
    let nib_url = entry?.nib_url ?? null;
    let foto_produk_url = entry?.foto_produk_url ?? null;
    let foto_verifikasi_url = entry?.foto_verifikasi_url ?? null;

    if (ktpFile) ktp_url = await uploadFile(ktpFile, "ktp-photos");
    if (nibFile) nib_url = await uploadFile(nibFile, "nib-documents");
    if (produkFile) foto_produk_url = await uploadFile(produkFile, "product-photos");
    if (verifikasiFile) foto_verifikasi_url = await uploadFile(verifikasiFile, "verification-photos");

    const payload: Record<string, unknown> = {};
    if (canEdit("nama")) payload.nama = nama;
    if (canEdit("alamat")) payload.alamat = alamat;
    if (canEdit("nomor_hp")) payload.nomor_hp = nomorHp;
    if (canEdit("ktp") && ktp_url) payload.ktp_url = ktp_url;
    if (canEdit("nib") && nib_url) payload.nib_url = nib_url;
    if ((currentRole === "super_admin" || currentRole === "admin") && foto_produk_url) payload.foto_produk_url = foto_produk_url;
    if ((currentRole === "super_admin" || currentRole === "admin") && foto_verifikasi_url) payload.foto_verifikasi_url = foto_verifikasi_url;

    let error;
    if (entry) {
      ({ error } = await supabase.from("data_entries").update(payload).eq("id", entry.id));
    } else {
      ({ error } = await supabase.from("data_entries").insert({
        ...payload,
        group_id: groupId,
        created_by: isPublic ? sharedLinkUserId : user?.id,
      } as any));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: entry ? "Data diperbarui" : "Data disimpan" });
      onSaved();
    }
  };

  const clearFile = (setter: (f: File | null) => void, ...refs: React.RefObject<HTMLInputElement | null>[]) => {
    setter(null);
    refs.forEach((r) => { if (r.current) r.current.value = ""; });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {!isPublic && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <CardTitle className="text-lg">{entry ? "Edit Data" : "Tambah Data Baru"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit("nama") && (
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
          </div>
        )}

        {canEdit("ktp") && (
          <div className="space-y-2">
            <Label>Foto KTP</Label>
            <input ref={ktpFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setKtpFile(e.target.files?.[0] ?? null)} />
            <input ref={ktpCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setKtpFile(e.target.files?.[0] ?? null)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => ktpFileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Pilih File
              </Button>
              <Button type="button" variant="outline" onClick={() => ktpCameraRef.current?.click()}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <ImagePreview file={ktpFile} existingUrl={entry?.ktp_url} onRemoveFile={() => clearFile(setKtpFile, ktpFileRef, ktpCameraRef)} />
          </div>
        )}

        {canEdit("alamat") && (
          <div className="space-y-2">
            <Label>Alamat</Label>
            <p className="text-xs text-muted-foreground">Ketik manual atau tekan ikon lokasi untuk ambil otomatis</p>
            <div className="flex gap-2">
              <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Ketik alamat..." className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={getLocation} disabled={gettingLocation}>
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {canEdit("nomor_hp") && (
          <div className="space-y-2">
            <Label>Nomor HP</Label>
            <Input value={nomorHp} onChange={(e) => setNomorHp(e.target.value)} placeholder="08xxxxxxxxxx" />
          </div>
        )}

        {canEdit("nib") && (
          <div className="space-y-2">
            <Label>NIB (PDF / Foto)</Label>
            <input ref={nibFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setNibFile(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="w-full" onClick={() => nibFileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Pilih File NIB
            </Button>
            {nibFile?.type?.startsWith("image/") ? (
              <ImagePreview file={nibFile} onRemoveFile={() => clearFile(setNibFile, nibFileRef)} />
            ) : nibFile ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span className="truncate">{nibFile.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => clearFile(setNibFile, nibFileRef)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : entry?.nib_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <ImagePreview file={null} existingUrl={entry.nib_url} onRemoveFile={() => {}} />
            ) : entry?.nib_url ? (
              <p className="text-xs text-muted-foreground">File sudah diupload ✓</p>
            ) : null}
          </div>
        )}

        {(currentRole === "super_admin" || currentRole === "admin") && (
          <>
            <div className="space-y-2">
              <Label>Foto Produk</Label>
              <input ref={produkFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setProdukFile(e.target.files?.[0] ?? null)} />
              <input ref={produkCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setProdukFile(e.target.files?.[0] ?? null)} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => produkFileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Pilih File
                </Button>
                <Button type="button" variant="outline" onClick={() => produkCameraRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <ImagePreview file={produkFile} existingUrl={entry?.foto_produk_url} onRemoveFile={() => clearFile(setProdukFile, produkFileRef, produkCameraRef)} />
            </div>

            <div className="space-y-2">
              <Label>Foto Verifikasi Lapangan</Label>
              <input ref={verifikasiFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setVerifikasiFile(e.target.files?.[0] ?? null)} />
              <input ref={verifikasiCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setVerifikasiFile(e.target.files?.[0] ?? null)} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => verifikasiFileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Pilih File
                </Button>
                <Button type="button" variant="outline" onClick={() => verifikasiCameraRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <ImagePreview file={verifikasiFile} existingUrl={entry?.foto_verifikasi_url} onRemoveFile={() => clearFile(setVerifikasiFile, verifikasiFileRef, verifikasiCameraRef)} />
            </div>
          </>
        )}

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          {!isPublic && (
            <Button variant="outline" onClick={onCancel}>Batal</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}