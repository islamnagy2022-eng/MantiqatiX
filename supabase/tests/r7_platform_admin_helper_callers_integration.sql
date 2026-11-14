-- Disposable PostgreSQL test for the four RPCs that inherit platform authorization
-- from mnty_can_platform_admin(). Run after RC449, RC462, the R7 caller fixture,
-- and 20261113020000_harden_mantigo_platform_financial_report.sql.

CREATE OR REPLACE FUNCTION pg_temp.assert_r7_helper_callers_denied(p_user uuid,p_role_label text)
RETURNS void LANGUAGE plpgsql
AS $function$
DECLARE v_rejected boolean;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',p_user::text,false);

  v_rejected:=false;
  BEGIN
    PERFORM public.admin_create_global_ad('test title','https://cdn.example.test/ad.png');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='PLATFORM_ADMIN_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION '% created a global advertisement',p_role_label; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.fulfill_digital_page_publish(p_user,'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='PLATFORM_ADMIN_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION '% fulfilled a platform digital page',p_role_label; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.review_mantigo_captain_application(p_user,'30000000-0000-4000-8000-000000000003','APPROVE');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='PLATFORM_ADMIN_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION '% reviewed a platform captain',p_role_label; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.set_mantigo_financial_config_backend(p_user,10,'EGP');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='PLATFORM_ADMIN_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION '% changed global MantiGO commission',p_role_label; END IF;
END
$function$;

DO $test$
DECLARE
  tenant_owner uuid := '10000000-0000-4000-8000-000000000041';
  tenant_admin uuid := '10000000-0000-4000-8000-000000000042';
  platform_admin uuid := '10000000-0000-4000-8000-000000000044';
  result_uuid uuid;
  result_json jsonb;
BEGIN
  PERFORM pg_temp.assert_r7_helper_callers_denied(tenant_owner,'tenant OWNER');
  PERFORM pg_temp.assert_r7_helper_callers_denied(tenant_admin,'tenant ADMIN');

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',platform_admin::text,false);

  result_uuid:=public.admin_create_global_ad('test title','https://cdn.example.test/ad.png');
  IF result_uuid IS NULL THEN RAISE EXCEPTION 'registered platform admin could not create test global ad'; END IF;

  result_json:=public.fulfill_digital_page_publish(
    platform_admin,'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'
  );
  IF result_json->>'status'<>'TEST_ONLY' THEN RAISE EXCEPTION 'registered platform admin could not pass digital publish guard'; END IF;

  result_json:=public.review_mantigo_captain_application(
    platform_admin,'30000000-0000-4000-8000-000000000003','APPROVE'
  );
  IF result_json->>'decision'<>'APPROVE' THEN RAISE EXCEPTION 'registered platform admin could not pass captain review guard'; END IF;

  result_json:=public.set_mantigo_financial_config_backend(platform_admin,10,'EGP');
  IF result_json->>'currency'<>'EGP' THEN RAISE EXCEPTION 'registered platform admin could not pass commission config guard'; END IF;

  IF has_function_privilege('anon','public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE')
     OR has_function_privilege('anon','public.fulfill_digital_page_publish(uuid,uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.set_mantigo_financial_config_backend(uuid,numeric,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute the four global helper callers';
  END IF;
END
$test$;

SELECT 'R7 helper-dependent global RPC integration: PASS' AS result;


DO $r7_search_path$
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

  IF v_count<>4 THEN
    RAISE EXCEPTION 'R7_HELPER_CALLER_SEARCH_PATH_NOT_HARDENED: expected four empty search_path configs, found %',v_count;
  END IF;
END
$r7_search_path$;

SELECT 'R7 helper caller empty search_path contract: PASS' AS result;
