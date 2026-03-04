-- Add new entry_status values
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'ktp_terdaftar_nib';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'ktp_terdaftar_sertifikat';