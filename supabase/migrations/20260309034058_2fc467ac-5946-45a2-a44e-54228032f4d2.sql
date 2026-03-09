
-- Add owner_id to commission_rates
ALTER TABLE public.commission_rates ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Drop constraint and recreate unique index
ALTER TABLE public.commission_rates DROP CONSTRAINT IF EXISTS commission_rates_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_role_owner_idx ON public.commission_rates (role, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'));

-- RLS: Owner can manage own commission rates
CREATE POLICY "Owner can manage own rates" ON public.commission_rates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND owner_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) AND owner_id = auth.uid());

-- Add owner_id to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Owner RLS for groups
CREATE POLICY "Owner can view own groups" ON public.groups
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND owner_id = auth.uid());

CREATE POLICY "Owner can update own groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND owner_id = auth.uid());

-- Trigger: auto create owner invoice
CREATE OR REPLACE FUNCTION public.auto_create_owner_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_owner_id uuid;
  v_fee integer;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sertifikat_selesai' THEN
    SELECT g.owner_id INTO v_owner_id FROM public.groups g WHERE g.id = NEW.group_id;
    IF v_owner_id IS NOT NULL THEN
      SELECT amount INTO v_fee FROM public.certificate_fees LIMIT 1;
      IF v_fee IS NOT NULL AND v_fee > 0 THEN
        INSERT INTO public.owner_invoices (owner_id, entry_id, group_id, amount, period)
        VALUES (v_owner_id, NEW.id, NEW.group_id, v_fee, to_char(now(), 'YYYY-MM'));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_create_owner_invoice_trigger
  AFTER UPDATE ON public.data_entries
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_owner_invoice();

-- Owner RLS for data_entries
CREATE POLICY "Owner can view own group entries" ON public.data_entries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = data_entries.group_id AND g.owner_id = auth.uid()
  ));

-- Owner RLS for commissions
CREATE POLICY "Owner can view own group commissions" ON public.commissions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = commissions.group_id AND g.owner_id = auth.uid()
  ));

-- Owner RLS for shared_links
CREATE POLICY "Owner can manage own group links" ON public.shared_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = shared_links.group_id AND g.owner_id = auth.uid()
  ))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = shared_links.group_id AND g.owner_id = auth.uid()
  ));

-- Owner RLS for audit_logs
CREATE POLICY "Owner can view own group audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = audit_logs.group_id AND g.owner_id = auth.uid()
  ));

-- Owner RLS for group_members
CREATE POLICY "Owner can manage own group members" ON public.group_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
  ))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
  ));

-- Owner RLS for entry_photos
CREATE POLICY "Owner can view own group entry photos" ON public.entry_photos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) AND EXISTS (
    SELECT 1 FROM public.data_entries de
    JOIN public.groups g ON g.id = de.group_id
    WHERE de.id = entry_photos.entry_id AND g.owner_id = auth.uid()
  ));
