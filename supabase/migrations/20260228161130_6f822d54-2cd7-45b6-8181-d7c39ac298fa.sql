
-- 1. Add slug column to shared_links
ALTER TABLE public.shared_links ADD COLUMN slug text UNIQUE;

-- 2. Add pic_user_id and source_link_id to data_entries
ALTER TABLE public.data_entries ADD COLUMN pic_user_id uuid;
ALTER TABLE public.data_entries ADD COLUMN source_link_id uuid REFERENCES public.shared_links(id) ON DELETE SET NULL;

-- 3. Auto-generate slug trigger
CREATE OR REPLACE FUNCTION public.generate_link_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  code text;
  exists_check boolean;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    LOOP
      code := lower(substr(md5(random()::text), 1, 6));
      SELECT EXISTS(SELECT 1 FROM public.shared_links WHERE slug = code) INTO exists_check;
      EXIT WHEN NOT exists_check;
    END LOOP;
    NEW.slug := code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_slug_on_insert
  BEFORE INSERT ON public.shared_links
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_link_slug();

-- Backfill existing links with slugs
UPDATE public.shared_links SET slug = lower(substr(md5(id::text || random()::text), 1, 6)) WHERE slug IS NULL;

-- 4. Commission rates table (dynamic per role, managed by super admin)
CREATE TABLE public.commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL UNIQUE,
  amount_per_entry integer NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rates"
  ON public.commission_rates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin can manage rates"
  ON public.commission_rates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default rates
INSERT INTO public.commission_rates (role, amount_per_entry) VALUES
  ('lapangan', 10000),
  ('admin', 5000),
  ('nib', 5000),
  ('super_admin', 0);

-- 5. Commissions table (per entry earning record)
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_id uuid REFERENCES public.data_entries(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id),
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  period text
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own commissions"
  ON public.commissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admin can view all commissions"
  ON public.commissions FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin can view all commissions"
  ON public.commissions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert commissions"
  ON public.commissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admin can update commissions"
  ON public.commissions FOR UPDATE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin can update commissions"
  ON public.commissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Disbursements table (withdrawal records)
CREATE TABLE public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  notes text
);

ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own disbursements"
  ON public.disbursements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admin can manage disbursements"
  ON public.disbursements FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin can manage disbursements"
  ON public.disbursements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. Trigger: auto-create commission when data_entry is inserted with pic_user_id
CREATE OR REPLACE FUNCTION public.auto_create_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rate integer;
  pic_role app_role;
BEGIN
  -- Only create commission for new entries with a PIC
  IF NEW.pic_user_id IS NOT NULL THEN
    -- Get the PIC's role
    SELECT role INTO pic_role FROM public.user_roles WHERE user_id = NEW.pic_user_id LIMIT 1;
    IF pic_role IS NOT NULL THEN
      -- Get the commission rate for that role
      SELECT amount_per_entry INTO rate FROM public.commission_rates WHERE role = pic_role;
      IF rate IS NOT NULL AND rate > 0 THEN
        INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
        VALUES (NEW.pic_user_id, NEW.id, NEW.group_id, rate, to_char(now(), 'YYYY-MM'));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_commission_on_entry
  AFTER INSERT ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_commission();

-- 8. Validation trigger for commissions status
CREATE OR REPLACE FUNCTION public.validate_commission_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'Invalid commission status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_commission_status_trigger
  BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commission_status();

-- 9. Validation trigger for disbursements status
CREATE OR REPLACE FUNCTION public.validate_disbursement_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid disbursement status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_disbursement_status_trigger
  BEFORE INSERT OR UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_disbursement_status();
