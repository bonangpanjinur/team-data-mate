
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
CREATE TRIGGER update_owner_field_access_updated_at
BEFORE UPDATE ON public.owner_field_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owner_pricing_updated_at
BEFORE UPDATE ON public.owner_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
