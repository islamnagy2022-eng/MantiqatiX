-- RC469 regression: preserve the existing authorization boundary while
-- proving all shared SECURITY DEFINER callers use an empty search_path.
-- Disposable PostgreSQL only.
DO $test$
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
    RAISE EXCEPTION 'RC469_EXPECTED_FOUR_SECURITY_DEFINER_EMPTY_PATH_CALLERS: found %', v_count;
  END IF;

  IF has_function_privilege('anon','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR has_function_privilege('anon','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC469_ANON_EXECUTE_WAS_GRANTED';
  END IF;

  IF NOT has_function_privilege('authenticated','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC469_AUTHENTICATED_EXECUTE_WAS_REMOVED';
  END IF;
END;
$test$;

SELECT 'RC469 shared platform-admin caller search_path: PASS' AS result;
