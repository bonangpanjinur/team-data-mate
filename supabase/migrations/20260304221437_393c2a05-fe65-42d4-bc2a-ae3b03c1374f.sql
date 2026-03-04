-- Create trigger to auto-assign umkm role on signup via metadata flag
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

CREATE TRIGGER on_auth_user_created_assign_umkm
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_umkm_role();