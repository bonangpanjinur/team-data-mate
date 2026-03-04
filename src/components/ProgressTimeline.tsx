import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "belum_lengkap", label: "Belum Lengkap" },
  { key: "siap_input", label: "Siap Input" },
  { key: "nib_selesai", label: "NIB Selesai" },
  { key: "terverifikasi", label: "Terverifikasi" },
  { key: "pengajuan", label: "Pengajuan" },
  { key: "sertifikat_selesai", label: "Sertifikat Selesai" },
];

// Map any status to its step index (some statuses map to the same step)
const STATUS_TO_STEP: Record<string, number> = {
  belum_lengkap: 0,
  siap_input: 1,
  lengkap: 1,
  ktp_terdaftar_nib: 1,
  nib_selesai: 2,
  ktp_terdaftar_sertifikat: 2,
  terverifikasi: 3,
  pengajuan: 4,
  sertifikat_selesai: 5,
};

interface Props {
  currentStatus: string;
}

export default function ProgressTimeline({ currentStatus }: Props) {
  const currentStep = STATUS_TO_STEP[currentStatus] ?? 0;

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-2">
      {STEPS.map((step, i) => {
        const isDone = i < currentStep;
        const isCurrent = i === currentStep;
        const isFuture = i > currentStep;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10 text-primary ring-2 ring-primary/30",
                  isFuture && "border-muted-foreground/30 bg-muted text-muted-foreground"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isCurrent ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight text-center max-w-[70px]",
                  isDone && "text-primary font-medium",
                  isCurrent && "text-primary font-semibold",
                  isFuture && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-1 min-w-[12px] rounded-full transition-all",
                  i < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
