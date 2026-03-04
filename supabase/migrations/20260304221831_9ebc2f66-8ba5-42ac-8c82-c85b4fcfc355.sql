-- Notifications table for UMKM users
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_id uuid REFERENCES public.data_entries(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Trigger to create notification on status change for UMKM-linked entries
CREATE OR REPLACE FUNCTION public.notify_umkm_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  status_label text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.umkm_user_id IS NOT NULL THEN
    CASE NEW.status::text
      WHEN 'belum_lengkap' THEN status_label := 'Belum Lengkap';
      WHEN 'siap_input' THEN status_label := 'Siap Input';
      WHEN 'terverifikasi' THEN status_label := 'Terverifikasi';
      WHEN 'nib_selesai' THEN status_label := 'NIB Selesai';
      WHEN 'pengajuan' THEN status_label := 'Pengajuan';
      WHEN 'sertifikat_selesai' THEN status_label := 'Sertifikat Selesai';
      WHEN 'ktp_terdaftar_nib' THEN status_label := 'KTP Terdaftar NIB';
      WHEN 'ktp_terdaftar_sertifikat' THEN status_label := 'KTP Terdaftar Sertifikat';
      ELSE status_label := NEW.status::text;
    END CASE;

    INSERT INTO public.notifications (user_id, entry_id, title, message)
    VALUES (
      NEW.umkm_user_id,
      NEW.id,
      'Status Diperbarui',
      'Status untuk "' || COALESCE(NEW.nama, 'Data UMKM') || '" berubah menjadi ' || status_label
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_entry_status_change_notify_umkm
  AFTER UPDATE ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_umkm_on_status_change();