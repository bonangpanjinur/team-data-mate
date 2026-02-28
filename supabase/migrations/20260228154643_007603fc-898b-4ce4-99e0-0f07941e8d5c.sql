
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
