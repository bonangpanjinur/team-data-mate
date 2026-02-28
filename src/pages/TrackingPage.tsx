import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Search, CheckCircle2, Clock, FileText, Download, Copy, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TrackingData {
  tracking_code: string;
  nama: string | null;
  status: string;
  sertifikat_url: string | null;
  created_at: string;
}

const STEPS = [
  { key: "belum_lengkap", label: "Data Terisi", description: "Data UMKM telah diinput" },
  { key: "nib_selesai", label: "NIB Selesai", description: "NIB telah diupload" },
  { key: "pengajuan", label: "Pengajuan", description: "Sertifikat sedang diajukan" },
  { key: "sertifikat_selesai", label: "Sertifikat Selesai", description: "Sertifikat halal telah terbit" },
];

const STATUS_ORDER: Record<string, number> = {
  belum_lengkap: 0,
  lengkap: 0,
  terverifikasi: 0,
  nib_selesai: 1,
  pengajuan: 2,
  sertifikat_selesai: 3,
};

export default function TrackingPage() {
  const { code: urlCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(urlCode ?? "");
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!urlCode);

  const handleSearch = async (codeToSearch?: string) => {
    const code = (codeToSearch ?? inputCode).trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from("tracking_view" as any)
      .select("*")
      .eq("tracking_code", code)
      .single();

    if (error || !data) {
      setTracking(null);
    } else {
      setTracking(data as unknown as TrackingData);
    }
    setLoading(false);
  };

  // Auto-search if URL has code
  useState(() => {
    if (urlCode) handleSearch(urlCode);
  });

  const currentStep = tracking ? (STATUS_ORDER[tracking.status] ?? 0) : -1;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <Shield className="mx-auto mb-2 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold">Tracking Sertifikat Halal</h1>
          <p className="text-sm text-muted-foreground">Masukkan kode tracking untuk melihat status proses sertifikasi</p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="HT-XXXXXX"
                className="font-mono text-lg tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                maxLength={9}
              />
              <Button onClick={() => handleSearch()} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                Cari
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Mencari...</p>
          </div>
        )}

        {!loading && searched && !tracking && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive font-medium">Kode tracking tidak ditemukan</p>
              <p className="text-sm text-muted-foreground mt-1">Periksa kembali kode yang Anda masukkan</p>
            </CardContent>
          </Card>
        )}

        {!loading && tracking && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{tracking.nama || "UMKM"}</span>
                <Badge variant="outline" className="font-mono text-xs">{tracking.tracking_code}</Badge>
              </CardTitle>
              <CardDescription>
                Terdaftar: {new Date(tracking.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {STEPS.map((step, idx) => {
                  const isComplete = currentStep >= idx;
                  const isCurrent = currentStep === idx;
                  return (
                    <div key={step.key} className="flex gap-4">
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isComplete
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div className={`w-0.5 flex-1 min-h-[32px] ${isComplete ? "bg-primary" : "bg-muted-foreground/20"}`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className={`pb-6 ${isCurrent ? "" : ""}`}>
                        <p className={`font-medium text-sm ${isComplete ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                        {/* Download button on last step */}
                        {step.key === "sertifikat_selesai" && isComplete && tracking.sertifikat_url && (
                          <a href={tracking.sertifikat_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="mt-2">
                              <Download className="mr-2 h-3 w-3" />
                              Download Sertifikat
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            <ArrowLeft className="mr-2 h-3 w-3" />
            Ke Halaman Login
          </Button>
        </div>
      </div>
    </div>
  );
}
