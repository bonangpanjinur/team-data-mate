
-- Create certificate_fees table if not exists
CREATE TABLE IF NOT EXISTS public.certificate_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificate_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certificate_fees
CREATE POLICY "Super admin can manage certificate fees"
ON public.certificate_fees FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can view certificate fees"
ON public.certificate_fees FOR SELECT
TO authenticated
USING (true);

-- Insert default fee if empty
INSERT INTO public.certificate_fees (amount, description)
SELECT 50000, 'Biaya default per sertifikat'
WHERE NOT EXISTS (SELECT 1 FROM public.certificate_fees);

-- Create owner_invoices table if not exists
CREATE TABLE IF NOT EXISTS public.owner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  entry_id uuid REFERENCES public.data_entries(id),
  group_id uuid REFERENCES public.groups(id),
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  period text, -- 'YYYY-MM'
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.owner_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for owner_invoices
CREATE POLICY "Super admin can manage all owner invoices"
ON public.owner_invoices FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owner can view own invoices"
ON public.owner_invoices FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_certificate_fees_updated_at
BEFORE UPDATE ON public.certificate_fees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owner_invoices_updated_at
BEFORE UPDATE ON public.owner_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
