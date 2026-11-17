-- RC464 shared-helper dependent global RPC regression tests.
-- Run after the RC449 integration suite in disposable PostgreSQL only.
DO $test$
DECLARE
  v_owner uuid := '10000000-0000-4000-8000-000000000041';
  v_platform uuid := '10000000-0000-4000-8000-000000000044';
  v_rejected boolean;
  v_id uuid;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
      AND c.relname = 'platform_admins'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'RC464 private platform registry must have RLS and FORCE RLS enabled';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,false);

  v_rejected := false;
  BEGIN
    PERFORM public.admin_create_global_ad('test ad','https://example.invalid/creative.png',NULL,NULL,NULL);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant OWNER created a platform global advertisement'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.fulfill_digital_page_publish(v_owner,gen_random_uuid(),gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant OWNER fulfilled a global digital page publish'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.review_mantigo_captain_application(v_owner,gen_random_uuid(),'APPROVE',NULL,NULL,NULL,NULL);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant OWNER reviewed a MantiGO captain application'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.set_mantigo_financial_config_backend(v_owner,12.5,'EGP');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant OWNER changed global MantiGO financial configuration'; END IF;

  -- A tenant ADMIN must be denied by the same shared root-only guard.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000042',false);

  v_rejected := false;
  BEGIN
    PERFORM public.admin_create_global_ad('tenant admin ad','https://example.invalid/creative.png',NULL,NULL,NULL);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant ADMIN created a platform global advertisement'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.fulfill_digital_page_publish('10000000-0000-4000-8000-000000000042',gen_random_uuid(),gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant ADMIN fulfilled a global digital page publish'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.review_mantigo_captain_application('10000000-0000-4000-8000-000000000042',gen_random_uuid(),'APPROVE',NULL,NULL,NULL,NULL);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant ADMIN reviewed a MantiGO captain application'; END IF;

  v_rejected := false;
  BEGIN
    PERFORM public.set_mantigo_financial_config_backend('10000000-0000-4000-8000-000000000042',12.5,'EGP');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'PLATFORM_ADMIN_REQUIRED' THEN v_rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'tenant ADMIN changed global MantiGO financial configuration'; END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_platform::text,false);

  v_id := public.admin_create_global_ad('test ad','https://example.invalid/creative.png',NULL,NULL,NULL);
  IF v_id IS NULL THEN RAISE EXCEPTION 'platform registry admin could not create global advertisement'; END IF;

  v_result := public.fulfill_digital_page_publish(v_platform,gen_random_uuid(),gen_random_uuid());
  IF v_result->>'published' <> 'true' THEN RAISE EXCEPTION 'platform registry admin could not reach digital-page fulfillment'; END IF;

  v_result := public.review_mantigo_captain_application(v_platform,gen_random_uuid(),'APPROVE',NULL,NULL,NULL,NULL);
  IF v_result->>'reviewed' <> 'true' THEN RAISE EXCEPTION 'platform registry admin could not review captain application'; END IF;

  v_result := public.set_mantigo_financial_config_backend(v_platform,12.5,'EGP');
  IF v_result->>'updated' <> 'true' THEN RAISE EXCEPTION 'platform registry admin could not update global MantiGO configuration'; END IF;

  IF has_function_privilege('anon','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR has_function_privilege('anon','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute any shared-helper global RPC';
  END IF;

  IF NOT has_function_privilege('authenticated','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated intended helper-caller grants unexpectedly changed';
  END IF;
END;
$test$;

DO $search_path$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'admin_create_global_ad',
      'fulfill_digital_page_publish',
      'review_mantigo_captain_application',
      'set_mantigo_financial_config_backend'
    )
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""'];

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RC464_SHARED_HELPER_CALLERS_EMPTY_SEARCH_PATH_REQUIRED: expected 4, found %',v_count;
  END IF;
END;
$search_path$;

SELECT 'RC464 shared helper callers and empty search_path: PASS' AS result;
