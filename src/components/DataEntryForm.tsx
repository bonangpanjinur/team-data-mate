import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldAccess } from "@/hooks/useFieldAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Camera, Upload, MapPin, ArrowLeft, X, Image as ImageIcon, Plus } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import type { Tables } from "@/integrations/supabase/types";

type DataEntry = Tables<"data_entries">;

interface EntryPhoto {
  id: string;
  entry_id: string;
  photo_type: string;
  url: string;
}

interface Props {
  groupId: string;
  entry?: DataEntry | null;
  onCancel: () => void;
  onSaved: (trackingCode?: string) => void;
  isPublic?: boolean;
  sharedLinkUserId?: string;
  sourceLinkId?: string;
}

function ImagePreview({ file, existingUrl, onRemoveFile }: { file: File | null; existingUrl?: string | null; onRemoveFile: () => void }) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const src = previewUrl || existingUrl;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <div className="relative inline-block">
        <img
          src={src}
          alt="Preview"
          className="h-24 w-24 rounded-lg border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setLightboxOpen(true)}
          onLoad={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); }}
        />
        <Button type="button" variant="destructive" size="icon" className="absolute -right-2 -top-2 h-5 w-5 rounded-full" onClick={onRemoveFile}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ImageLightbox src={src} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
}

function ExistingPhotoPreview({ url, onRemove }: { url: string; onRemove?: () => void }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <>
      <div className="relative inline-block">
        <img
          src={url}
          alt="Foto"
          className="h-24 w-24 rounded-lg border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setLightboxOpen(true)}
        />
        {onRemove && (
          <Button type="button" variant="destructive" size="icon" className="absolute -right-2 -top-2 h-5 w-5 rounded-full" onClick={onRemove}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <ImageLightbox src={url} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
}

export default function DataEntryForm({ groupId, entry, onCancel, onSaved, isPublic, sharedLinkUserId, sourceLinkId }: Props) {
  const { role, user } = useAuth();
  const { canEdit: canEditField, loading: accessLoading } = useFieldAccess(isPublic ? "lapangan" : undefined);

  const [nama, setNama] = useState(entry?.nama ?? "");
  const [alamat, setAlamat] = useState(entry?.alamat ?? "");
  const [nomorHp, setNomorHp] = useState(entry?.nomor_hp ?? "");
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [nibFile, setNibFile] = useState<File | null>(null);
  const [sertifikatFile, setSertifikatFile] = useState<File | null>(null);

  // Multiple photos
  const [produkFiles, setProdukFiles] = useState<File[]>([]);
  const [verifikasiFiles, setVerifikasiFiles] = useState<File[]>([]);
  const [existingProdukPhotos, setExistingProdukPhotos] = useState<EntryPhoto[]>([]);
  const [existingVerifikasiPhotos, setExistingVerifikasiPhotos] = useState<EntryPhoto[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

  const ktpCameraRef = useRef<HTMLInputElement>(null);
  const ktpFileRef = useRef<HTMLInputElement>(null);
  const produkFileRef = useRef<HTMLInputElement>(null);
  const produkCameraRef = useRef<HTMLInputElement>(null);
  const verifikasiFileRef = useRef<HTMLInputElement>(null);
  const verifikasiCameraRef = useRef<HTMLInputElement>(null);
  const nibFileRef = useRef<HTMLInputElement>(null);
  const sertifikatFileRef = useRef<HTMLInputElement>(null);

  // Load existing photos when editing
  useState(() => {
    if (entry) {
      supabase
        .from("entry_photos" as any)
        .select("*")
        .eq("entry_id", entry.id)
        .then(({ data }) => {
          const photos = (data as unknown as EntryPhoto[]) ?? [];
          setExistingProdukPhotos(photos.filter((p) => p.photo_type === "produk"));
          setExistingVerifikasiPhotos(photos.filter((p) => p.photo_type === "verifikasi"));
        });
    }
  });

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
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
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
    let sertifikat_url = (entry as any)?.sertifikat_url ?? null;

    if (ktpFile) ktp_url = await uploadFile(ktpFile, "ktp-photos");
    if (nibFile) nib_url = await uploadFile(nibFile, "nib-documents");
    if (sertifikatFile) sertifikat_url = await uploadFile(sertifikatFile, "sertifikat-halal");

    const payload: Record<string, unknown> = {};
    if (canEditField("nama")) payload.nama = nama;
    if (canEditField("alamat")) payload.alamat = alamat;
    if (canEditField("nomor_hp")) payload.nomor_hp = nomorHp;
    if (canEditField("ktp") && ktp_url) payload.ktp_url = ktp_url;
    if (canEditField("nib") && nib_url) payload.nib_url = nib_url;
    if (canEditField("sertifikat") && sertifikat_url) payload.sertifikat_url = sertifikat_url;

    // For backward compat, also set foto_produk_url/foto_verifikasi_url to first photo
    let firstProdukUrl = existingProdukPhotos.filter(p => !photosToDelete.includes(p.id))[0]?.url ?? null;
    let firstVerifikasiUrl = existingVerifikasiPhotos.filter(p => !photosToDelete.includes(p.id))[0]?.url ?? null;

    let error;
    let resultData: any = null;
    let entryId = entry?.id;

    if (entry) {
      // Upload new produk/verifikasi photos
      if (canEditField("foto_produk")) {
        for (const file of produkFiles) {
          const url = await uploadFile(file, "product-photos");
          if (url) {
            await supabase.from("entry_photos" as any).insert({ entry_id: entry.id, photo_type: "produk", url });
            if (!firstProdukUrl) firstProdukUrl = url;
          }
        }
      }
      if (canEditField("foto_verifikasi")) {
        for (const file of verifikasiFiles) {
          const url = await uploadFile(file, "verification-photos");
          if (url) {
            await supabase.from("entry_photos" as any).insert({ entry_id: entry.id, photo_type: "verifikasi", url });
            if (!firstVerifikasiUrl) firstVerifikasiUrl = url;
          }
        }
      }

      // Delete removed photos
      if (photosToDelete.length > 0) {
        await supabase.from("entry_photos" as any).delete().in("id", photosToDelete);
      }

      if (canEditField("foto_produk")) payload.foto_produk_url = firstProdukUrl;
      if (canEditField("foto_verifikasi")) payload.foto_verifikasi_url = firstVerifikasiUrl;

      ({ error } = await supabase.from("data_entries").update(payload).eq("id", entry.id));
    } else {
      const res = await supabase.from("data_entries").insert({
        ...payload,
        group_id: groupId,
        created_by: isPublic ? sharedLinkUserId : user?.id,
        pic_user_id: isPublic ? sharedLinkUserId : user?.id,
        source_link_id: sourceLinkId || null,
      } as any).select("id, tracking_code" as any).single();
      error = res.error;
      resultData = res.data;
      entryId = resultData?.id;

      // Upload multiple photos for new entry
      if (entryId) {
        if (canEditField("foto_produk")) {
          for (const file of produkFiles) {
            const url = await uploadFile(file, "product-photos");
            if (url) {
              await supabase.from("entry_photos" as any).insert({ entry_id: entryId, photo_type: "produk", url });
              if (!firstProdukUrl) firstProdukUrl = url;
            }
          }
        }
        if (canEditField("foto_verifikasi")) {
          for (const file of verifikasiFiles) {
            const url = await uploadFile(file, "verification-photos");
            if (url) {
              await supabase.from("entry_photos" as any).insert({ entry_id: entryId, photo_type: "verifikasi", url });
              if (!firstVerifikasiUrl) firstVerifikasiUrl = url;
            }
          }
        }

        // Update entry with first photo URLs for backward compat
        if (firstProdukUrl || firstVerifikasiUrl) {
          const updatePayload: Record<string, unknown> = {};
          if (firstProdukUrl) updatePayload.foto_produk_url = firstProdukUrl;
          if (firstVerifikasiUrl) updatePayload.foto_verifikasi_url = firstVerifikasiUrl;
          await supabase.from("data_entries").update(updatePayload).eq("id", entryId);
        }
      }
    }

    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: entry ? "Data diperbarui" : "Data disimpan" });
      onSaved(resultData?.tracking_code);
    }
  };

  const clearFile = (setter: (f: File | null) => void, ...refs: React.RefObject<HTMLInputElement | null>[]) => {
    setter(null);
    refs.forEach((r) => { if (r.current) r.current.value = ""; });
  };

  const addProdukFile = (file: File | null) => {
    if (file) setProdukFiles((prev) => [...prev, file]);
  };

  const removeProdukFile = (index: number) => {
    setProdukFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addVerifikasiFile = (file: File | null) => {
    if (file) setVerifikasiFiles((prev) => [...prev, file]);
  };

  const removeVerifikasiFile = (index: number) => {
    setVerifikasiFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const markPhotoForDeletion = (photoId: string) => {
    setPhotosToDelete((prev) => [...prev, photoId]);
  };

  if (accessLoading) {
    return <div className="text-muted-foreground text-center py-8">Memuat form...</div>;
  }

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
        {canEditField("nama") && (
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
          </div>
        )}

        {canEditField("ktp") && (
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

        {canEditField("alamat") && (
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

        {canEditField("nomor_hp") && (
          <div className="space-y-2">
            <Label>Nomor HP</Label>
            <Input value={nomorHp} onChange={(e) => setNomorHp(e.target.value)} placeholder="08xxxxxxxxxx" />
          </div>
        )}

        {canEditField("nib") && (
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

        {canEditField("foto_produk") && (
          <div className="space-y-2">
            <Label>Foto Produk (bisa lebih dari satu)</Label>
            <input ref={produkFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { addProdukFile(e.target.files?.[0] ?? null); if (produkFileRef.current) produkFileRef.current.value = ""; }} />
            <input ref={produkCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addProdukFile(e.target.files?.[0] ?? null); if (produkCameraRef.current) produkCameraRef.current.value = ""; }} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => produkFileRef.current?.click()}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Foto
              </Button>
              <Button type="button" variant="outline" onClick={() => produkCameraRef.current?.click()}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {existingProdukPhotos
                .filter((p) => !photosToDelete.includes(p.id))
                .map((photo) => (
                  <ExistingPhotoPreview key={photo.id} url={photo.url} onRemove={() => markPhotoForDeletion(photo.id)} />
                ))}
              {produkFiles.map((file, i) => (
                <ImagePreview key={`new-produk-${i}`} file={file} onRemoveFile={() => removeProdukFile(i)} />
              ))}
            </div>
          </div>
        )}

        {canEditField("foto_verifikasi") && (
          <div className="space-y-2">
            <Label>Foto Verifikasi Lapangan (bisa lebih dari satu)</Label>
            <input ref={verifikasiFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { addVerifikasiFile(e.target.files?.[0] ?? null); if (verifikasiFileRef.current) verifikasiFileRef.current.value = ""; }} />
            <input ref={verifikasiCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addVerifikasiFile(e.target.files?.[0] ?? null); if (verifikasiCameraRef.current) verifikasiCameraRef.current.value = ""; }} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => verifikasiFileRef.current?.click()}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Foto
              </Button>
              <Button type="button" variant="outline" onClick={() => verifikasiCameraRef.current?.click()}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {existingVerifikasiPhotos
                .filter((p) => !photosToDelete.includes(p.id))
                .map((photo) => (
                  <ExistingPhotoPreview key={photo.id} url={photo.url} onRemove={() => markPhotoForDeletion(photo.id)} />
                ))}
              {verifikasiFiles.map((file, i) => (
                <ImagePreview key={`new-verifikasi-${i}`} file={file} onRemoveFile={() => removeVerifikasiFile(i)} />
              ))}
            </div>
          </div>
        )}

        {canEditField("sertifikat") && (
          <div className="space-y-2">
            <Label>Sertifikat Halal (PDF / Foto)</Label>
            <input ref={sertifikatFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setSertifikatFile(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="w-full" onClick={() => sertifikatFileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Pilih File Sertifikat
            </Button>
            {sertifikatFile?.type?.startsWith("image/") ? (
              <ImagePreview file={sertifikatFile} onRemoveFile={() => clearFile(setSertifikatFile, sertifikatFileRef)} />
            ) : sertifikatFile ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span className="truncate">{sertifikatFile.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => clearFile(setSertifikatFile, sertifikatFileRef)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (entry as any)?.sertifikat_url ? (
              <p className="text-xs text-muted-foreground">Sertifikat sudah diupload ✓</p>
            ) : null}
          </div>
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
