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

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_platform::text,false);

  v_id := public.admin_create_global_ad('test ad','https://example.invalid/creative.png',NULL,NULL,NULL);
  IF v_id IS NULL THEN RAISE EXCEPTION 'platform registry admin could not create global advertisement'; END IF;

  v_result := public.fulfill_digital_page_publish(v_platform,gen_random_uuid(),gen_random_uuid());
  IF v_result->>'published' <> 'true' THEN RAISE EXCEPTION 'platform registry admin could not reach digital-page fulfillment'; END IF;

  v_result := public.review_mantigo_captain_application(v_platform,gen_random_uuid(),'APPROVE',NULL,NULL,NULL,NULL);
  IF v_result->>'reviewed' <> 'true' THEN RAISE EXCEPTION 'platform registry admin could not review captain application'; END IF;

  v_result := public.set_mantigo_financial_config_backend(v_platform,12.5,'EGP');
  IF v_result->>'updated' <> 'true' THEN RAISE EXCEPTION 'platform registry admin could not update global MantiGO configuration'; END IF;
END;
$test$;

SELECT 'RC464 shared helper callers: PASS' AS result;
