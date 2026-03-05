import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, Link2, Trash2, Clock, CheckCircle2, AlertTriangle, Send, Award } from "lucide-react";
import PhotoGallery from "@/components/PhotoGallery";
import type { Tables } from "@/integrations/supabase/types";

type DataEntry = Tables<"data_entries">;

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  belum_lengkap: { label: "Belum Lengkap", variant: "destructive", icon: Clock },
  siap_input: { label: "Siap Input", variant: "secondary", icon: CheckCircle2 },
  ktp_terdaftar_nib: { label: "KTP Terdaftar NIB", variant: "destructive", icon: AlertTriangle },
  pengajuan: { label: "Pengajuan", variant: "outline", icon: Send },
  sertifikat_selesai: { label: "Sertifikat Selesai", variant: "default", icon: Award },
};

interface Props {
  entry: DataEntry;
  photoCounts: { produk: number; verifikasi: number } | undefined;
  canDownload: boolean;
  canChangeStatus: boolean;
  allowedStatuses: string[];
  downloading: boolean;
  selected: boolean;
  showCheckbox: boolean;
  role: string | null;
  onToggleSelect: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onDownload: () => void;
  onDelete: () => void;
  onLinkUmkm: () => void;
}

export default function EntryMobileCard({
  entry: e, photoCounts, canDownload, canChangeStatus, allowedStatuses,
  downloading, selected, showCheckbox, role, onToggleSelect, onEdit,
  onStatusChange, onDownload, onDelete, onLinkUmkm,
}: Props) {
  const statusCfg = STATUS_CONFIG[(e as any).status || "belum_lengkap"];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header: checkbox + name + status */}
        <div className="flex items-start gap-2">
          {showCheckbox && (
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />
          )}
          <div className="flex-1 min-w-0" onClick={onEdit}>
            <p className="font-medium truncate cursor-pointer">{e.nama || "-"}</p>
            <p className="text-xs text-muted-foreground truncate">{(e as any).email || "-"}</p>
          </div>
          {canChangeStatus ? (
            <Select value={(e as any).status || "belum_lengkap"} onValueChange={onStatusChange}>
              <SelectTrigger className="h-7 w-auto text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const current = (e as any).status || "belum_lengkap";
                  const all = new Set([current, ...allowedStatuses]);
                  return [...all].map((key) => {
                    const cfg = STATUS_CONFIG[key];
                    if (!cfg) return null;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-1">
                          <cfg.icon className="h-3 w-3" />{cfg.label}
                        </span>
                      </SelectItem>
                    );
                  });
                })()}
              </SelectContent>
            </Select>
          ) : statusCfg ? (
            <Badge variant={statusCfg.variant} className="text-xs shrink-0">
              <statusCfg.icon className="mr-1 h-3 w-3" />{statusCfg.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{(e as any).status}</Badge>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" onClick={onEdit}>
          <span className="text-muted-foreground">Alamat</span>
          <span className="truncate">{e.alamat || "-"}</span>
          <span className="text-muted-foreground">No HP</span>
          <span>{e.nomor_hp || "-"}</span>
          <span className="text-muted-foreground">Kata Sandi</span>
          <span>{(e as any).kata_sandi || "-"}</span>
          <span className="text-muted-foreground">Tracking</span>
          <code className="font-mono text-muted-foreground">{(e as any).tracking_code || "-"}</code>
        </div>

        {/* Document badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={e.ktp_url ? "secondary" : "outline"} className="text-xs">KTP {e.ktp_url ? "✓" : "✗"}</Badge>
          <Badge variant={e.nib_url ? "secondary" : "outline"} className="text-xs">NIB {e.nib_url ? "✓" : "✗"}</Badge>
          <Badge variant={(e as any).sertifikat_url ? "secondary" : "outline"} className="text-xs">Sertifikat {(e as any).sertifikat_url ? "✓" : "✗"}</Badge>
          {((photoCounts?.produk || 0) > 0 || e.foto_produk_url) && (
            <PhotoGallery
              entryId={e.id}
              legacyProdukUrl={e.foto_produk_url}
              legacyVerifikasiUrl={e.foto_verifikasi_url}
              photoType="produk"
              trigger={<Badge variant="secondary" className="cursor-pointer text-xs">{photoCounts?.produk || 1} Produk</Badge>}
            />
          )}
          {((photoCounts?.verifikasi || 0) > 0 || e.foto_verifikasi_url) && (
            <PhotoGallery
              entryId={e.id}
              legacyProdukUrl={e.foto_produk_url}
              legacyVerifikasiUrl={e.foto_verifikasi_url}
              photoType="verifikasi"
              trigger={<Badge variant="secondary" className="cursor-pointer text-xs">{photoCounts?.verifikasi || 1} Verifikasi</Badge>}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 border-t pt-2">
          {(role === "super_admin" || role === "admin") && (
            <Button variant="ghost" size="sm" onClick={onLinkUmkm}>
              <Link2 className="mr-1 h-3 w-3" /> UMKM
            </Button>
          )}
          {canDownload && (
            <Button variant="ghost" size="sm" onClick={onDownload} disabled={downloading}>
              <Download className="mr-1 h-3 w-3" /> Unduh
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive ml-auto">
                <Trash2 className="mr-1 h-3 w-3" /> Hapus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Entri</AlertDialogTitle>
                <AlertDialogDescription>
                  Yakin ingin menghapus data "{e.nama || "ini"}"?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
