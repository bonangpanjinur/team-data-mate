
-- Add email and kata_sandi columns to data_entries
ALTER TABLE public.data_entries ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.data_entries ADD COLUMN IF NOT EXISTS kata_sandi text;

-- Update auto_update_entry_status function
-- siap_input triggers when: ktp_url, nib_url, foto_produk_url, foto_verifikasi_url are all filled
CREATE OR REPLACE FUNCTION public.auto_update_entry_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If sertifikat_url just filled -> sertifikat_selesai
  IF NEW.sertifikat_url IS NOT NULL AND (OLD.sertifikat_url IS NULL OR OLD.sertifikat_url = '') THEN
    NEW.status := 'sertifikat_selesai';
    RETURN NEW;
  END IF;

  -- Check siap_input: auto-upgrade from belum_lengkap when ktp, nib, foto_produk, foto_verifikasi are all filled
  IF OLD.status = 'belum_lengkap' THEN
    IF (NEW.ktp_url IS NOT NULL AND NEW.ktp_url <> '')
       AND (NEW.nib_url IS NOT NULL AND NEW.nib_url <> '')
       AND (NEW.foto_produk_url IS NOT NULL AND NEW.foto_produk_url <> '')
       AND (NEW.foto_verifikasi_url IS NOT NULL AND NEW.foto_verifikasi_url <> '')
    THEN
      NEW.status := 'siap_input';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
