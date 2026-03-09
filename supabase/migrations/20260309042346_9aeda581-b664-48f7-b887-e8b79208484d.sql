
-- Fix: trigger already existed, just ensure it's there
DROP TRIGGER IF EXISTS auto_create_owner_invoice_trigger ON public.data_entries;
CREATE TRIGGER auto_create_owner_invoice_trigger AFTER UPDATE ON public.data_entries FOR EACH ROW EXECUTE FUNCTION public.auto_create_owner_invoice();
