-- Disposable-only overlay that reproduces the exact live search_path values
-- observed for the four shared SECURITY DEFINER platform-admin callers.
-- Never apply this file to Production.
ALTER FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)
  SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid)
  SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)
  SET search_path TO 'public';
ALTER FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text)
  SET search_path TO 'public';
