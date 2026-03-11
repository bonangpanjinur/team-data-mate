-- Combined Supabase Migrations
-- Generated on Tue Mar 10 23:41:20 EDT 2026

-- File: 20260215010735_1a5195a5-7dba-4d34-80e9-5d5c856dab8d.sql

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'lapangan', 'nib');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 5. Group members table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 6. Data entries table
CREATE TABLE public.data_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  nama TEXT,
  alamat TEXT,
  nomor_hp TEXT,
  ktp_url TEXT,
  nib_url TEXT,
  foto_produk_url TEXT,
  foto_verifikasi_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_entries ENABLE ROW LEVEL SECURITY;

-- 7. Shared links table
CREATE TABLE public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- 8. Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 9. Helper function: is_member_of_group
CREATE OR REPLACE FUNCTION public.is_member_of_group(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- 10. Helper function: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 11. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_data_entries_updated_at ON public.data_entries;
CREATE TRIGGER update_data_entries_updated_at BEFORE UPDATE ON public.data_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS POLICIES ============

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Super admin can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Super admin can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR id = auth.uid());
CREATE POLICY "Super admin can delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles policies
CREATE POLICY "Super admin can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- Groups policies
CREATE POLICY "Super admin can manage groups" ON public.groups FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members can view their groups" ON public.groups FOR SELECT USING (public.is_member_of_group(auth.uid(), id));

-- Group members policies
CREATE POLICY "Super admin can manage group members" ON public.group_members FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT USING (public.is_member_of_group(auth.uid(), group_id));

-- Data entries policies
CREATE POLICY "Super admin full access to entries" ON public.data_entries FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members can view group entries" ON public.data_entries FOR SELECT USING (public.is_member_of_group(auth.uid(), group_id));
CREATE POLICY "Members can insert group entries" ON public.data_entries FOR INSERT WITH CHECK (public.is_member_of_group(auth.uid(), group_id));
CREATE POLICY "Members can update group entries" ON public.data_entries FOR UPDATE USING (public.is_member_of_group(auth.uid(), group_id));
CREATE POLICY "Members can delete group entries" ON public.data_entries FOR DELETE USING (public.is_member_of_group(auth.uid(), group_id));

-- Shared links policies
CREATE POLICY "Super admin can manage shared links" ON public.shared_links FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Lapangan can manage own shared links" ON public.shared_links FOR ALL USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'lapangan'));
CREATE POLICY "Members can view shared links" ON public.shared_links FOR SELECT USING (public.is_member_of_group(auth.uid(), group_id));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('ktp-photos', 'ktp-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('nib-documents', 'nib-documents', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('product-photos', 'product-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-photos', 'verification-photos', true);

-- Storage policies - authenticated users can upload/view
CREATE POLICY "Authenticated users can upload ktp" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ktp-photos');
CREATE POLICY "Anyone can view ktp" ON storage.objects FOR SELECT USING (bucket_id = 'ktp-photos');
CREATE POLICY "Authenticated users can delete ktp" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ktp-photos');

CREATE POLICY "Authenticated users can upload nib" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'nib-documents');
CREATE POLICY "Anyone can view nib" ON storage.objects FOR SELECT USING (bucket_id = 'nib-documents');
CREATE POLICY "Authenticated users can delete nib" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'nib-documents');

CREATE POLICY "Authenticated users can upload product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos');
CREATE POLICY "Anyone can view product photos" ON storage.objects FOR SELECT USING (bucket_id = 'product-photos');
CREATE POLICY "Authenticated users can delete product photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-photos');

CREATE POLICY "Authenticated users can upload verification" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'verification-photos');
CREATE POLICY "Anyone can view verification" ON storage.objects FOR SELECT USING (bucket_id = 'verification-photos');
CREATE POLICY "Authenticated users can delete verification" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'verification-photos');

-- Public users can upload to ktp-photos (for shared form)
CREATE POLICY "Public can upload ktp via shared form" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'ktp-photos');


-- File: 20260215012820_c47a9985-fcbf-45f5-ad9b-99ae22c504c7.sql
-- Create entry status enum
CREATE TYPE public.entry_status AS ENUM ('belum_lengkap', 'lengkap', 'terverifikasi');

-- Add status column to data_entries
ALTER TABLE public.data_entries 
ADD COLUMN status public.entry_status NOT NULL DEFAULT 'belum_lengkap';


-- File: 20260217221116_93a966ae-77aa-476a-a513-32fa5390b55c.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.data_entries;

-- File: 20260219094115_5a4a6342-72b5-41b5-bd27-4dde978c457e.sql

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
DROP TRIGGER IF EXISTS trigger_log_status_change ON public.data_entries;
CREATE TRIGGER trigger_log_status_change
AFTER UPDATE ON public.data_entries
FOR EACH ROW
EXECUTE FUNCTION public.log_status_change();


-- File: 20260228150713_ba68e627-4ec6-447a-a229-cd17eeb5042e.sql
-- App settings table for theme/branding management
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read app settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

-- Only super admin can modify
CREATE POLICY "Super admin can manage settings"
ON public.app_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('app_name', 'HalalTrack'),
  ('primary_color', '217 91% 50%'),
  ('logo_url', '');


-- File: 20260228151622_584ff65b-eff6-49e0-90d4-f85f0613c915.sql

-- 1. Add new enum values to entry_status
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'nib_selesai';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'pengajuan';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'sertifikat_selesai';


-- File: 20260228151648_2b6b9875-ad75-40e8-9cd5-83fe2d3d16f1.sql

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
DROP TRIGGER IF EXISTS trg_generate_tracking_code ON public.data_entries;
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
DROP TRIGGER IF EXISTS trg_auto_update_status ON public.data_entries;
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


-- File: 20260228151659_31d98a8b-2788-4f49-99d1-9d0cae372216.sql

-- Fix security definer view by using security_invoker
ALTER VIEW public.tracking_view SET (security_invoker = on);


-- File: 20260228151713_7f176fc2-6565-4df6-bc4f-1ac8d10f6cf5.sql

-- Allow anon/public to SELECT data_entries by tracking_code (for tracking view)
CREATE POLICY "Public can view entries by tracking code" ON public.data_entries
  FOR SELECT
  USING (tracking_code IS NOT NULL);


-- File: 20260228153220_58e20797-4b85-44da-bf9d-52ab175ffb5f.sql

-- Drop the existing trigger that's causing conflict
DROP TRIGGER IF EXISTS update_data_entries_updated_at ON public.data_entries;

-- Re-create it
DROP TRIGGER IF EXISTS update_data_entries_updated_at ON public.data_entries;
CREATE TRIGGER update_data_entries_updated_at
  BEFORE UPDATE ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill missing profiles from auth.users
INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  u.email,
  NOW(),
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;


-- File: 20260228154643_007603fc-898b-4ce4-99e0-0f07941e8d5c.sql

-- Create field_access table for dynamic field permissions per role
CREATE TABLE public.field_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  field_name text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, field_name)
);

ALTER TABLE public.field_access ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read field access (needed to render forms)
CREATE POLICY "Authenticated users can view field access"
  ON public.field_access FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only super_admin can manage
CREATE POLICY "Super admin can manage field access"
  ON public.field_access FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default field access data
INSERT INTO public.field_access (role, field_name, can_view, can_edit) VALUES
  -- super_admin: all fields
  ('super_admin', 'nama', true, true),
  ('super_admin', 'alamat', true, true),
  ('super_admin', 'nomor_hp', true, true),
  ('super_admin', 'ktp', true, true),
  ('super_admin', 'nib', true, true),
  ('super_admin', 'foto_produk', true, true),
  ('super_admin', 'foto_verifikasi', true, true),
  ('super_admin', 'sertifikat', true, true),
  -- admin: all fields view+edit, but nama disabled for edit
  ('admin', 'nama', true, false),
  ('admin', 'alamat', true, true),
  ('admin', 'nomor_hp', true, true),
  ('admin', 'ktp', true, true),
  ('admin', 'nib', true, true),
  ('admin', 'foto_produk', true, true),
  ('admin', 'foto_verifikasi', true, true),
  ('admin', 'sertifikat', true, true),
  -- lapangan: nama, alamat, nomor_hp, ktp
  ('lapangan', 'nama', true, true),
  ('lapangan', 'alamat', true, true),
  ('lapangan', 'nomor_hp', true, true),
  ('lapangan', 'ktp', true, true),
  ('lapangan', 'nib', false, false),
  ('lapangan', 'foto_produk', false, false),
  ('lapangan', 'foto_verifikasi', false, false),
  ('lapangan', 'sertifikat', false, false),
  -- nib: only nib
  ('nib', 'nama', true, false),
  ('nib', 'alamat', false, false),
  ('nib', 'nomor_hp', false, false),
  ('nib', 'ktp', false, false),
  ('nib', 'nib', true, true),
  ('nib', 'foto_produk', false, false),
  ('nib', 'foto_verifikasi', false, false),
  ('nib', 'sertifikat', false, false);

-- Update shared_links RLS: allow all roles to manage own links (not just lapangan)
DROP POLICY IF EXISTS "Lapangan can manage own shared links" ON public.shared_links;
CREATE POLICY "Users can manage own shared links"
  ON public.shared_links FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- File: 20260228155624_7fb3f72a-8757-4d32-bdc2-05fc57ee3dde.sql

-- 1. Attach handle_new_user() trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles from existing auth.users
INSERT INTO public.profiles (id, full_name, email)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', ''), email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Seed default app_settings
INSERT INTO public.app_settings (key, value) VALUES
  ('app_name', 'HalalTrack'),
  ('primary_color', '#16a34a'),
  ('logo_url', '')
ON CONFLICT DO NOTHING;

-- 4. Seed default field_access if empty
INSERT INTO public.field_access (role, field_name, can_view, can_edit)
SELECT r.role, f.field_name, 
  CASE WHEN r.role IN ('super_admin','admin') THEN true
       WHEN r.role = 'lapangan' AND f.field_name IN ('nama','nomor_hp','alamat','ktp_url','foto_produk_url','foto_verifikasi_url') THEN true
       WHEN r.role = 'nib' AND f.field_name IN ('nib_url') THEN true
       ELSE false END,
  CASE WHEN r.role IN ('super_admin','admin') THEN true
       WHEN r.role = 'lapangan' AND f.field_name IN ('nama','nomor_hp','alamat','ktp_url','foto_produk_url','foto_verifikasi_url') THEN true
       WHEN r.role = 'nib' AND f.field_name IN ('nib_url') THEN true
       ELSE false END
FROM (VALUES ('super_admin'::app_role),('admin'::app_role),('lapangan'::app_role),('nib'::app_role)) AS r(role)
CROSS JOIN (VALUES ('nama'),('nomor_hp'),('alamat'),('ktp_url'),('nib_url'),('foto_produk_url'),('foto_verifikasi_url'),('sertifikat_url'),('status')) AS f(field_name)
ON CONFLICT DO NOTHING;


-- File: 20260228161130_6f822d54-2cd7-45b6-8181-d7c39ac298fa.sql

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

DROP TRIGGER IF EXISTS generate_slug_on_insert ON public.shared_links;
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

DROP TRIGGER IF EXISTS auto_commission_on_entry ON public.data_entries;
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

DROP TRIGGER IF EXISTS validate_commission_status_trigger ON public.commissions;
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

DROP TRIGGER IF EXISTS validate_disbursement_status_trigger ON public.disbursements;
CREATE TRIGGER validate_disbursement_status_trigger
  BEFORE INSERT OR UPDATE ON public.disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_disbursement_status();


-- File: 20260228161240_08068a3c-3b40-480b-860c-e00365494caa.sql

-- Fix: Replace overly permissive INSERT policy on commissions
-- The trigger uses SECURITY DEFINER so it bypasses RLS anyway
DROP POLICY "System can insert commissions" ON public.commissions;

CREATE POLICY "Admin can insert commissions"
  ON public.commissions FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );


-- File: 20260301031707_2302fb3a-f174-418f-8489-09d0d12dea49.sql
-- Allow public (unauthenticated) users to read active shared links
CREATE POLICY "Public can read active shared links"
  ON public.shared_links
  FOR SELECT
  USING (is_active = true);


-- File: 20260301031832_82004e38-fa9a-448e-886f-0fd30d231c23.sql
-- Allow public to read basic profile info (name only) for shared link PIC display
CREATE POLICY "Public can read profile names"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Drop the narrower policies that are now redundant
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;


-- File: 20260302081638_e90ea992-9055-42f0-9d7e-af7e556032aa.sql
-- Automatically deactivate shared links when their group is deleted
CREATE OR REPLACE FUNCTION public.deactivate_links_on_group_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.shared_links SET is_active = false WHERE group_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS deactivate_shared_links_on_group_delete ON public.groups;
CREATE TRIGGER deactivate_shared_links_on_group_delete
  BEFORE DELETE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_links_on_group_delete();


-- File: 20260302082657_3a0c8c6d-776f-457d-ac5e-c1630dd1dea5.sql

-- Step 1: Add new enum values only
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'siap_input' AFTER 'belum_lengkap';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_input';


-- File: 20260302082730_52756eeb-8dc4-4fdc-9773-1957f3c521df.sql

-- 1. Add app_setting for siap_input required fields
INSERT INTO public.app_settings (key, value)
VALUES ('siap_input_required_fields', '["nama","ktp","nib","foto_produk","foto_verifikasi"]')
ON CONFLICT DO NOTHING;

-- 2. Add default field_access for admin_input role
INSERT INTO public.field_access (role, field_name, can_view, can_edit)
VALUES
  ('admin_input', 'nama', true, true),
  ('admin_input', 'alamat', true, true),
  ('admin_input', 'nomor_hp', true, true),
  ('admin_input', 'ktp', true, true),
  ('admin_input', 'nib', true, true),
  ('admin_input', 'foto_produk', true, true),
  ('admin_input', 'foto_verifikasi', true, true),
  ('admin_input', 'sertifikat', true, false)
ON CONFLICT DO NOTHING;

-- 3. Update auto_update_entry_status trigger
CREATE OR REPLACE FUNCTION public.auto_update_entry_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  required_fields jsonb;
  all_filled boolean := true;
  fname text;
BEGIN
  -- If sertifikat_url just filled -> sertifikat_selesai
  IF NEW.sertifikat_url IS NOT NULL AND (OLD.sertifikat_url IS NULL OR OLD.sertifikat_url = '') THEN
    NEW.status := 'sertifikat_selesai';
    RETURN NEW;
  END IF;
  
  -- If nib_url just filled -> nib_selesai (only if status is still early)
  IF NEW.nib_url IS NOT NULL AND (OLD.nib_url IS NULL OR OLD.nib_url = '') 
     AND OLD.status IN ('belum_lengkap', 'siap_input') THEN
    NEW.status := 'nib_selesai';
    RETURN NEW;
  END IF;

  -- Check siap_input: only upgrade from belum_lengkap
  IF OLD.status = 'belum_lengkap' THEN
    SELECT value::jsonb INTO required_fields
    FROM public.app_settings
    WHERE key = 'siap_input_required_fields';

    IF required_fields IS NOT NULL THEN
      FOR fname IN SELECT jsonb_array_elements_text(required_fields) LOOP
        CASE fname
          WHEN 'nama' THEN IF NEW.nama IS NULL OR NEW.nama = '' THEN all_filled := false; END IF;
          WHEN 'alamat' THEN IF NEW.alamat IS NULL OR NEW.alamat = '' THEN all_filled := false; END IF;
          WHEN 'nomor_hp' THEN IF NEW.nomor_hp IS NULL OR NEW.nomor_hp = '' THEN all_filled := false; END IF;
          WHEN 'ktp' THEN IF NEW.ktp_url IS NULL OR NEW.ktp_url = '' THEN all_filled := false; END IF;
          WHEN 'nib' THEN IF NEW.nib_url IS NULL OR NEW.nib_url = '' THEN all_filled := false; END IF;
          WHEN 'foto_produk' THEN IF NEW.foto_produk_url IS NULL OR NEW.foto_produk_url = '' THEN all_filled := false; END IF;
          WHEN 'foto_verifikasi' THEN IF NEW.foto_verifikasi_url IS NULL OR NEW.foto_verifikasi_url = '' THEN all_filled := false; END IF;
          WHEN 'sertifikat' THEN IF NEW.sertifikat_url IS NULL OR NEW.sertifikat_url = '' THEN all_filled := false; END IF;
          ELSE NULL;
        END CASE;
        EXIT WHEN NOT all_filled;
      END LOOP;

      IF all_filled THEN
        NEW.status := 'siap_input';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. RLS policies for admin_input
CREATE POLICY "Admin input can view group entries"
ON public.data_entries FOR SELECT
USING (has_role(auth.uid(), 'admin_input'::app_role) AND is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Admin input can update group entries"
ON public.data_entries FOR UPDATE
USING (has_role(auth.uid(), 'admin_input'::app_role) AND is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Admin input can view their groups"
ON public.groups FOR SELECT
USING (is_member_of_group(auth.uid(), id) AND has_role(auth.uid(), 'admin_input'::app_role));

CREATE POLICY "Admin input can view group members"
ON public.group_members FOR SELECT
USING (is_member_of_group(auth.uid(), group_id) AND has_role(auth.uid(), 'admin_input'::app_role));

CREATE POLICY "Admin input can view shared links"
ON public.shared_links FOR SELECT
USING (has_role(auth.uid(), 'admin_input'::app_role) AND is_member_of_group(auth.uid(), group_id));


-- File: 20260303055015_7364710a-c569-4e57-8f94-e2ad3f468d00.sql

-- Create entry_photos table for multiple product & verification photos
CREATE TABLE public.entry_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.data_entries(id) ON DELETE CASCADE,
  photo_type text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for photo_type
CREATE OR REPLACE FUNCTION public.validate_photo_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.photo_type NOT IN ('produk', 'verifikasi') THEN
    RAISE EXCEPTION 'Invalid photo_type: %. Must be produk or verifikasi', NEW.photo_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_entry_photo_type ON public.entry_photos;
CREATE TRIGGER validate_entry_photo_type
BEFORE INSERT OR UPDATE ON public.entry_photos
FOR EACH ROW EXECUTE FUNCTION public.validate_photo_type();

-- Enable RLS
ALTER TABLE public.entry_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies: access mirrors data_entries
CREATE POLICY "Members can view entry photos"
ON public.entry_photos FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.data_entries de
  WHERE de.id = entry_id AND is_member_of_group(auth.uid(), de.group_id)
));

CREATE POLICY "Members can insert entry photos"
ON public.entry_photos FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.data_entries de
  WHERE de.id = entry_id AND is_member_of_group(auth.uid(), de.group_id)
));

CREATE POLICY "Members can delete entry photos"
ON public.entry_photos FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.data_entries de
  WHERE de.id = entry_id AND is_member_of_group(auth.uid(), de.group_id)
));

CREATE POLICY "Super admin full access to entry photos"
ON public.entry_photos FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admin input can view entry photos"
ON public.entry_photos FOR SELECT
USING (
  has_role(auth.uid(), 'admin_input'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.data_entries de
    WHERE de.id = entry_id AND is_member_of_group(auth.uid(), de.group_id)
  )
);

CREATE POLICY "Admin input can insert entry photos"
ON public.entry_photos FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin_input'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.data_entries de
    WHERE de.id = entry_id AND is_member_of_group(auth.uid(), de.group_id)
  )
);

-- Migrate existing data from data_entries to entry_photos
INSERT INTO public.entry_photos (entry_id, photo_type, url)
SELECT id, 'produk', foto_produk_url FROM public.data_entries WHERE foto_produk_url IS NOT NULL AND foto_produk_url != '';

INSERT INTO public.entry_photos (entry_id, photo_type, url)
SELECT id, 'verifikasi', foto_verifikasi_url FROM public.data_entries WHERE foto_verifikasi_url IS NOT NULL AND foto_verifikasi_url != '';

-- Create index for performance
CREATE INDEX idx_entry_photos_entry_id ON public.entry_photos(entry_id);
CREATE INDEX idx_entry_photos_type ON public.entry_photos(photo_type);


-- File: 20260304050500_6d8b3d67-8fb1-427f-a86c-fc89dc034806.sql
-- Add new entry_status values
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'ktp_terdaftar_nib';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'ktp_terdaftar_sertifikat';

-- File: 20260304220715_7ff06b76-5e78-4012-aca8-361e9e09cf41.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'umkm';

-- File: 20260304220749_0aaeeafb-ba9e-4fc5-ac59-bbdf72c3fd03.sql

-- Add umkm_user_id to data_entries to link UMKM accounts
ALTER TABLE public.data_entries ADD COLUMN IF NOT EXISTS umkm_user_id uuid;

-- RLS: UMKM users can view their own entries
CREATE POLICY "UMKM can view own entries"
ON public.data_entries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'umkm'::app_role) AND umkm_user_id = auth.uid());

-- RLS: UMKM users can view own role
-- (already covered by existing "Users can view own role" policy)

-- RLS: UMKM can view own profile (already covered by existing policies)


-- File: 20260304221437_393c2a05-fe65-42d4-bc2a-ae3b03c1374f.sql
-- DROP TRIGGER IF EXISTS to ON signup;
Create trigger to auto-assign umkm role on signup via metadata flag
CREATE OR REPLACE FUNCTION public.auto_assign_umkm_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'register_as' = 'umkm' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'umkm')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_umkm ON auth.users;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_umkm ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_umkm
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_umkm_role();

-- File: 20260304221831_9ebc2f66-8ba5-42ac-8c82-c85b4fcfc355.sql
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

DROP TRIGGER IF EXISTS on_entry_status_change_notify_umkm ON public.data_entries;
CREATE TRIGGER on_entry_status_change_notify_umkm
  AFTER UPDATE ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_umkm_on_status_change();

-- File: 20260304221958_8c7f16ab-51a0-4181-ac43-ffcb20e4c38c.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- File: 20260304223725_b5f86cd9-4bcd-49d8-b0e3-b42a68984ada.sql

CREATE OR REPLACE FUNCTION public.auto_create_commission_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changer_id uuid;
  changer_role app_role;
  rate integer;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changer_id := auth.uid();
    IF changer_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT role INTO changer_role FROM public.user_roles WHERE user_id = changer_id LIMIT 1;
    IF changer_role IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT amount_per_entry INTO rate FROM public.commission_rates WHERE role = changer_role;
    IF rate IS NOT NULL AND rate > 0 THEN
      INSERT INTO public.commissions (user_id, entry_id, group_id, amount, period)
      VALUES (changer_id, NEW.id, NEW.group_id, rate, to_char(now(), 'YYYY-MM'))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Add unique constraint to prevent duplicate commissions per user per entry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commissions_user_entry_unique'
  ) THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_user_entry_unique UNIQUE (user_id, entry_id);
  END IF;
END $$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_commission_on_status_change ON public.data_entries;
DROP TRIGGER IF EXISTS trg_commission_on_status_change ON public.data_entries;
CREATE TRIGGER trg_commission_on_status_change
  AFTER UPDATE ON public.data_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_commission_on_status_change();


-- File: 20260304224929_5b398eed-2bd2-4e1c-a2eb-8c638b608592.sql
-- Add unique constraints for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS field_access_role_field_name_unique ON public.field_access (role, field_name);
CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_role_unique ON public.commission_rates (role);

-- File: 20260304230935_8a83a721-4294-43a0-b61e-8e9de3f4a45f.sql

-- Add phone column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Allow UMKM users to view audit logs for their own entries
CREATE POLICY "UMKM can view own entry audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'umkm'::app_role) AND
  EXISTS (
    SELECT 1 FROM public.data_entries de
    WHERE de.id = audit_logs.entry_id AND de.umkm_user_id = auth.uid()
  )
);


-- File: 20260304233915_e9d3307d-7b32-4ff4-80cb-f1ceb032a10f.sql

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


-- File: 20260304235252_82c6838a-6d7f-4e96-b9c6-4b0578e257ec.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- File: 20260305033128_5b5b716d-7582-41e3-8132-7fa90f47dbda.sql

-- Create the trigger on auth.users to auto-create profiles
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing auth users that don't have one
INSERT INTO public.profiles (id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', ''), u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;


-- File: 20260309034025_2b196a5c-a1e7-4f8f-a3a7-8a09cb9b2966.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

-- File: 20260309034058_2fc467ac-5946-45a2-a44e-54228032f4d2.sql

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

DROP TRIGGER IF EXISTS auto_create_owner_invoice_trigger ON public.data_entries;
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


-- File: 20260309040123_499eb7d6-2dc7-4c36-a67d-0ed2a91b9b7c.sql

-- ============================================
-- MULTI-TENANT OWNER SYSTEM
-- ============================================

-- 1. Table owner_teams - link team members to owners
CREATE TABLE public.owner_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, user_id)
);

ALTER TABLE public.owner_teams ENABLE ROW LEVEL SECURITY;

-- 2. Table owner_field_access - per-owner field permissions
CREATE TABLE public.owner_field_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  role public.app_role NOT NULL,
  field_name text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, role, field_name)
);

ALTER TABLE public.owner_field_access ENABLE ROW LEVEL SECURITY;

-- 3. Table owner_pricing - dynamic pricing per owner
CREATE TABLE public.owner_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid, -- NULL = default global pricing
  pricing_type text NOT NULL, -- 'per_certificate', 'per_group', 'monthly', 'custom'
  amount integer NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_pricing ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function to get owner_id for a team member
CREATE OR REPLACE FUNCTION public.get_owner_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.owner_teams WHERE user_id = _user_id LIMIT 1
$$;

-- 5. Security definer function to check if user belongs to owner's team
CREATE OR REPLACE FUNCTION public.is_team_member_of_owner(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.owner_teams
    WHERE user_id = _user_id AND owner_id = _owner_id
  )
$$;

-- ============================================
-- RLS POLICIES FOR owner_teams
-- ============================================

CREATE POLICY "Super admin can manage all owner teams"
ON public.owner_teams FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owner can view and manage own team"
ON public.owner_teams FOR ALL
USING (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid());

CREATE POLICY "Team members can view their own membership"
ON public.owner_teams FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES FOR owner_field_access
-- ============================================

CREATE POLICY "Super admin can manage all owner field access"
ON public.owner_field_access FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owner can manage own field access"
ON public.owner_field_access FOR ALL
USING (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid());

CREATE POLICY "Team members can view field access of their owner"
ON public.owner_field_access FOR SELECT
USING (owner_id = public.get_owner_id_for_user(auth.uid()));

-- ============================================
-- RLS POLICIES FOR owner_pricing
-- ============================================

CREATE POLICY "Super admin can manage all pricing"
ON public.owner_pricing FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owner can view own pricing"
ON public.owner_pricing FOR SELECT
USING (public.has_role(auth.uid(), 'owner') AND (owner_id = auth.uid() OR owner_id IS NULL));

-- ============================================
-- UPDATE EXISTING RLS POLICIES FOR ISOLATION
-- ============================================

-- Groups: Team members can only see groups of their owner
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups"
ON public.groups FOR SELECT
USING (
  is_member_of_group(auth.uid(), id) 
  OR (public.get_owner_id_for_user(auth.uid()) IS NOT NULL AND owner_id = public.get_owner_id_for_user(auth.uid()))
);

-- Owner can create groups (insert)
CREATE POLICY "Owner can create groups"
ON public.groups FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid());

-- Owner can delete own groups
CREATE POLICY "Owner can delete own groups"
ON public.groups FOR DELETE
USING (public.has_role(auth.uid(), 'owner') AND owner_id = auth.uid());

-- Data entries: Team members isolated by owner
DROP POLICY IF EXISTS "Members can view group entries" ON public.data_entries;
CREATE POLICY "Members can view group entries"
ON public.data_entries FOR SELECT
USING (
  is_member_of_group(auth.uid(), group_id) 
  OR (
    public.get_owner_id_for_user(auth.uid()) IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = data_entries.group_id 
      AND g.owner_id = public.get_owner_id_for_user(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Members can insert group entries" ON public.data_entries;
CREATE POLICY "Members can insert group entries"
ON public.data_entries FOR INSERT
WITH CHECK (
  is_member_of_group(auth.uid(), group_id) 
  OR (
    public.get_owner_id_for_user(auth.uid()) IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id 
      AND g.owner_id = public.get_owner_id_for_user(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Members can update group entries" ON public.data_entries;
CREATE POLICY "Members can update group entries"
ON public.data_entries FOR UPDATE
USING (
  is_member_of_group(auth.uid(), group_id) 
  OR (
    public.get_owner_id_for_user(auth.uid()) IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = data_entries.group_id 
      AND g.owner_id = public.get_owner_id_for_user(auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Members can delete group entries" ON public.data_entries;
CREATE POLICY "Members can delete group entries"
ON public.data_entries FOR DELETE
USING (
  is_member_of_group(auth.uid(), group_id) 
  OR (
    public.get_owner_id_for_user(auth.uid()) IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = data_entries.group_id 
      AND g.owner_id = public.get_owner_id_for_user(auth.uid())
    )
  )
);

-- Group members: Team isolation
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members"
ON public.group_members FOR SELECT
USING (
  is_member_of_group(auth.uid(), group_id) 
  OR (
    public.get_owner_id_for_user(auth.uid()) IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_members.group_id 
      AND g.owner_id = public.get_owner_id_for_user(auth.uid())
    )
  )
);

-- Shared links: Team isolation
DROP POLICY IF EXISTS "Members can view shared links" ON public.shared_links;
CREATE POLICY "Members can view shared links"
ON public.shared_links FOR SELECT
USING (
  is_member_of_group(auth.uid(), group_id) 
  OR (
    public.get_owner_id_for_user(auth.uid()) IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = shared_links.group_id 
      AND g.owner_id = public.get_owner_id_for_user(auth.uid())
    )
  )
);

-- Insert default global pricing
INSERT INTO public.owner_pricing (owner_id, pricing_type, amount, description, is_active)
VALUES 
  (NULL, 'per_certificate', 0, 'Tarif default per sertifikat', true);

-- Trigger for updated_at on new tables
DROP TRIGGER IF EXISTS update_owner_field_access_updated_at ON public.owner_field_access;
CREATE TRIGGER update_owner_field_access_updated_at
BEFORE UPDATE ON public.owner_field_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_owner_pricing_updated_at ON public.owner_pricing;
CREATE TRIGGER update_owner_pricing_updated_at
BEFORE UPDATE ON public.owner_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- File: 20260309042346_9aeda581-b664-48f7-b887-e8b79208484d.sql

-- Fix: trigger already existed, just ensure it's there
DROP TRIGGER IF EXISTS auto_create_owner_invoice_trigger ON public.data_entries;
DROP TRIGGER IF EXISTS auto_create_owner_invoice_trigger ON public.data_entries;
CREATE TRIGGER auto_create_owner_invoice_trigger AFTER UPDATE ON public.data_entries FOR EACH ROW EXECUTE FUNCTION public.auto_create_owner_invoice();


-- File: 20260309054116_0aab078d-fb17-45db-a67b-526a5868dd63.sql

-- Update auto_create_owner_invoice to also send notification to owner
CREATE OR REPLACE FUNCTION public.auto_create_owner_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_fee integer;
  v_entry_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sertifikat_selesai' THEN
    SELECT g.owner_id INTO v_owner_id FROM public.groups g WHERE g.id = NEW.group_id;
    IF v_owner_id IS NOT NULL THEN
      SELECT amount INTO v_fee FROM public.certificate_fees LIMIT 1;
      IF v_fee IS NOT NULL AND v_fee > 0 THEN
        INSERT INTO public.owner_invoices (owner_id, entry_id, group_id, amount, period)
        VALUES (v_owner_id, NEW.id, NEW.group_id, v_fee, to_char(now(), 'YYYY-MM'));

        -- Send notification to owner
        v_entry_name := COALESCE(NEW.nama, 'Data UMKM');
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
          v_owner_id,
          'Tagihan Baru',
          'Tagihan baru Rp ' || to_char(v_fee, 'FM999,999,999') || ' untuk "' || v_entry_name || '" periode ' || to_char(now(), 'YYYY-MM')
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- File: 20260311000000_fix_missing_tables.sql

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
DROP TRIGGER IF EXISTS update_certificate_fees_updated_at ON public.certificate_fees;
CREATE TRIGGER update_certificate_fees_updated_at
BEFORE UPDATE ON public.certificate_fees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_owner_invoices_updated_at ON public.owner_invoices;
CREATE TRIGGER update_owner_invoices_updated_at
BEFORE UPDATE ON public.owner_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

