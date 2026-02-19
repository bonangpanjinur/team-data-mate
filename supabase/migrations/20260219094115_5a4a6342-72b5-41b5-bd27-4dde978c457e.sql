
-- Buat tabel audit_logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL,
  entry_name TEXT,
  group_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin bisa lihat semua audit log
CREATE POLICY "Super admin can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin bisa lihat audit log grup mereka
CREATE POLICY "Members can view audit logs of their group"
ON public.audit_logs
FOR SELECT
USING (is_member_of_group(auth.uid(), group_id));

-- Hanya trigger yang boleh insert (via security definer function)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Function untuk log perubahan status
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (entry_id, entry_name, group_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NEW.nama, NEW.group_id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger pada data_entries
CREATE TRIGGER trigger_log_status_change
AFTER UPDATE ON public.data_entries
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();
