import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Photo {
  id: string;
  url: string;
  photo_type: string;
}

interface PhotoGalleryProps {
  entryId: string;
  legacyProdukUrl?: string | null;
  legacyVerifikasiUrl?: string | null;
  photoType?: "produk" | "verifikasi" | "all";
  trigger: React.ReactNode;
}

export default function PhotoGallery({ entryId, legacyProdukUrl, legacyVerifikasiUrl, photoType = "all", trigger }: PhotoGalleryProps) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchPhotos = async () => {
      setLoading(true);
      let query = supabase.from("entry_photos" as any).select("id, url, photo_type").eq("entry_id", entryId);
      if (photoType !== "all") {
        query = query.eq("photo_type", photoType);
      }
      const { data } = await query.order("created_at", { ascending: true });
      const result: Photo[] = (data ?? []) as any;

      // Add legacy photos if no entry_photos exist for that type
      if (photoType === "all" || photoType === "produk") {
        if (!result.some(p => p.photo_type === "produk") && legacyProdukUrl) {
          result.push({ id: "legacy-produk", url: legacyProdukUrl, photo_type: "produk" });
        }
      }
      if (photoType === "all" || photoType === "verifikasi") {
        if (!result.some(p => p.photo_type === "verifikasi") && legacyVerifikasiUrl) {
          result.push({ id: "legacy-verifikasi", url: legacyVerifikasiUrl, photo_type: "verifikasi" });
        }
      }

      setPhotos(result);
      setCurrentIndex(0);
      setLoading(false);
    };
    fetchPhotos();
  }, [open, entryId, photoType, legacyProdukUrl, legacyVerifikasiUrl]);

  const goNext = () => setCurrentIndex(i => Math.min(i + 1, photos.length - 1));
  const goPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));

  return (
    <>
      <span className="cursor-pointer" onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[92vw] max-h-[92vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden">
          <div className="relative flex flex-col items-center justify-center">
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 z-10 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <ImageIcon className="h-8 w-8 animate-pulse text-muted-foreground" />
              </div>
            ) : photos.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Tidak ada foto
              </div>
            ) : (
              <>
                <img
                  src={photos[currentIndex].url}
                  alt={`Foto ${currentIndex + 1}`}
                  className="max-h-[78vh] max-w-[88vw] rounded-lg object-contain"
                />

                <div className="flex items-center gap-3 mt-3">
                  <Button variant="secondary" size="icon" className="rounded-full" onClick={goPrev} disabled={currentIndex === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Badge variant={photos[currentIndex].photo_type === "produk" ? "default" : "secondary"}>
                      {photos[currentIndex].photo_type === "produk" ? "Produk" : "Verifikasi"}
                    </Badge>
                    <span className="text-sm text-white/80">{currentIndex + 1} / {photos.length}</span>
                  </div>
                  <Button variant="secondary" size="icon" className="rounded-full" onClick={goNext} disabled={currentIndex === photos.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Thumbnail strip */}
                {photos.length > 1 && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto max-w-[88vw] pb-1">
                    {photos.map((p, i) => (
                      <img
                        key={p.id}
                        src={p.url}
                        alt={`Thumbnail ${i + 1}`}
                        className={`h-12 w-12 rounded object-cover cursor-pointer border-2 transition-all ${
                          i === currentIndex ? "border-primary opacity-100" : "border-transparent opacity-60 hover:opacity-80"
                        }`}
                        onClick={() => setCurrentIndex(i)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
