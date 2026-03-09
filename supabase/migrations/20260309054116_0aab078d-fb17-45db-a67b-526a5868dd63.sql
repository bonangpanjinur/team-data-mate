
-- Update auto_create_owner_invoice to also send notification to owner
CREATE OR REPLACE FUNCTION public.auto_create_owner_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_fee integer;
  v_entry_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sertifikat_selesai' THEN
    SELECT g.owner_id INTO v_owner_id FROM public.groups g WHERE g.id = NEW.group_id;
    IF v_owner_id IS NOT NULL THEN
      SELECT amount INTO v_fee FROM public.certificate_fees LIMIT 1;
      IF v_fee IS NOT NULL AND v_fee > 0 THEN
        INSERT INTO public.owner_invoices (owner_id, entry_id, group_id, amount, period)
        VALUES (v_owner_id, NEW.id, NEW.group_id, v_fee, to_char(now(), 'YYYY-MM'));

        -- Send notification to owner
        v_entry_name := COALESCE(NEW.nama, 'Data UMKM');
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
          v_owner_id,
          'Tagihan Baru',
          'Tagihan baru Rp ' || to_char(v_fee, 'FM999,999,999') || ' untuk "' || v_entry_name || '" periode ' || to_char(now(), 'YYYY-MM')
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
