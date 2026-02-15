
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

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
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
