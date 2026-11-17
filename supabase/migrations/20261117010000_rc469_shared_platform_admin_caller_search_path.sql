-- RC469: pin the four existing SECURITY DEFINER entrypoints that inherit
-- the canonical platform-admin guard to an empty search_path.
-- Function bodies, execution grants and authorization behavior remain unchanged.
-- Requires RC464's canonical public.mnty_can_platform_admin() helper.
BEGIN;

DO $preflight$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid = pg_catalog.to_regprocedure('public.mnty_can_platform_admin()')
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'RC469_CANONICAL_PLATFORM_ADMIN_GUARD_NOT_HARDENED';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    pg_catalog.to_regprocedure('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)'),
    pg_catalog.to_regprocedure('public.fulfill_digital_page_publish(uuid,uuid,uuid)'),
    pg_catalog.to_regprocedure('public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)'),
    pg_catalog.to_regprocedure('public.set_mantigo_financial_config_backend(uuid,numeric,text)')
  )
    AND p.prosecdef
    AND p.prosrc ILIKE '%mnty_can_platform_admin%';

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RC469_EXPECTS_FOUR_SHARED_PLATFORM_ADMIN_CALLERS: found %', v_count;
  END IF;

  IF has_function_privilege('anon','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR has_function_privilege('anon','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC469_ANON_EXECUTE_MUST_REMAIN_REVOKED';
  END IF;

  IF NOT has_function_privilege('authenticated','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC469_AUTHENTICATED_EXECUTE_MUST_BE_PRESERVED';
  END IF;
END;
$preflight$;

ALTER FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)
  SET search_path = '';
ALTER FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid)
  SET search_path = '';
ALTER FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)
  SET search_path = '';
ALTER FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text)
  SET search_path = '';

DO $postcondition$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    pg_catalog.to_regprocedure('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)'),
    pg_catalog.to_regprocedure('public.fulfill_digital_page_publish(uuid,uuid,uuid)'),
    pg_catalog.to_regprocedure('public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)'),
    pg_catalog.to_regprocedure('public.set_mantigo_financial_config_backend(uuid,numeric,text)')
  )
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""'];

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RC469_EMPTY_SEARCH_PATH_POSTCONDITION_FAILED: expected 4, found %', v_count;
  END IF;
END;
$postcondition$;

COMMIT;
