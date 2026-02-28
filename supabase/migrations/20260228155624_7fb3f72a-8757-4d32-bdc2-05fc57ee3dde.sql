
-- 1. Attach handle_new_user() trigger to auth.users
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
