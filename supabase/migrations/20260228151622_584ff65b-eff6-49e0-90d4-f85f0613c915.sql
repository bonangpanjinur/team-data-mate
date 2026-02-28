
-- 1. Add new enum values to entry_status
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'nib_selesai';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'pengajuan';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'sertifikat_selesai';
