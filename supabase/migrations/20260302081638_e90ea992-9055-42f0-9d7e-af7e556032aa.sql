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

CREATE TRIGGER deactivate_shared_links_on_group_delete
  BEFORE DELETE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_links_on_group_delete();
