
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
