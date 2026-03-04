-- Add unique constraints for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS field_access_role_field_name_unique ON public.field_access (role, field_name);
CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_role_unique ON public.commission_rates (role);