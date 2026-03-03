
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
