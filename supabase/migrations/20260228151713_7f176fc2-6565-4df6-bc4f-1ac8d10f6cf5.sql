
-- Allow anon/public to SELECT data_entries by tracking_code (for tracking view)
CREATE POLICY "Public can view entries by tracking code" ON public.data_entries
  FOR SELECT
  USING (tracking_code IS NOT NULL);
