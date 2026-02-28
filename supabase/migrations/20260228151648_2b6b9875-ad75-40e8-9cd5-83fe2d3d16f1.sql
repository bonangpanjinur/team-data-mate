
-- 2. Add columns to data_entries
ALTER TABLE public.data_entries ADD COLUMN IF NOT EXISTS sertifikat_url text;
ALTER TABLE public.data_entries ADD COLUMN IF NOT EXISTS tracking_code text;

-- Unique index on tracking_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_entries_tracking_code ON public.data_entries(tracking_code) WHERE tracking_code IS NOT NULL;

-- 3. Function to generate tracking code
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  code text;
  exists_check boolean;
BEGIN
  LOOP
    code := 'HT-' || upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.data_entries WHERE tracking_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  NEW.tracking_code := code;
  RETURN NEW;
END;
$$;

-- 4. Trigger to auto-generate tracking code on INSERT
CREATE TRIGGER trg_generate_tracking_code
  BEFORE INSERT ON public.data_entries
  FOR EACH ROW
  WHEN (NEW.tracking_code IS NULL)
  EXECUTE FUNCTION public.generate_tracking_code();

-- 5. Function to auto-update status based on file uploads
CREATE OR REPLACE FUNCTION public.auto_update_entry_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If sertifikat_url just filled -> sertifikat_selesai
  IF NEW.sertifikat_url IS NOT NULL AND (OLD.sertifikat_url IS NULL OR OLD.sertifikat_url = '') THEN
    NEW.status := 'sertifikat_selesai';
    RETURN NEW;
  END IF;
  
  -- If nib_url just filled -> nib_selesai (only if status is still early)
  IF NEW.nib_url IS NOT NULL AND (OLD.nib_url IS NULL OR OLD.nib_url = '') 
     AND OLD.status IN ('belum_lengkap', 'lengkap') THEN
    NEW.status := 'nib_selesai';
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Trigger for auto status update (BEFORE the existing log_status_change trigger)
CREATE TRIGGER trg_auto_update_status
  BEFORE UPDATE ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_entry_status();

-- 7. Create tracking view (non-sensitive fields only)
CREATE OR REPLACE VIEW public.tracking_view AS
SELECT tracking_code, nama, status::text as status, sertifikat_url, created_at
FROM public.data_entries
WHERE tracking_code IS NOT NULL;

-- 8. Grant public access to tracking view
GRANT SELECT ON public.tracking_view TO anon, authenticated;

-- 9. Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('sertifikat-halal', 'sertifikat-halal', true)
ON CONFLICT (id) DO NOTHING;

-- 10. Storage policies for sertifikat-halal bucket
CREATE POLICY "Anyone can view sertifikat" ON storage.objects FOR SELECT USING (bucket_id = 'sertifikat-halal');
CREATE POLICY "Auth users can upload sertifikat" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sertifikat-halal' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can update sertifikat" ON storage.objects FOR UPDATE USING (bucket_id = 'sertifikat-halal' AND auth.role() = 'authenticated');

-- 11. Generate tracking codes for existing entries
UPDATE public.data_entries SET tracking_code = 'HT-' || upper(substr(md5(random()::text || id::text), 1, 6)) WHERE tracking_code IS NULL;
