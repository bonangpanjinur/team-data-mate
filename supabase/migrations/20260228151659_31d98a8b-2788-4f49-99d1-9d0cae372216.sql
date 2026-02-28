
-- Fix security definer view by using security_invoker
ALTER VIEW public.tracking_view SET (security_invoker = on);
