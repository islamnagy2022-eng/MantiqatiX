-- Run after the RC501 fixture and migration in disposable PostgreSQL 17.
DO $metadata$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    pg_catalog.to_regprocedure('public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)'),
    pg_catalog.to_regprocedure('public.deactivate_business(uuid,text)'),
    pg_catalog.to_regprocedure('public.fashion_erp_mutate(text,jsonb,text)'),
    pg_catalog.to_regprocedure('public.resolve_legacy_scope(text)'),
    pg_catalog.to_regprocedure('public.restaurant_erp_mutate(text,jsonb,text)'),
    pg_catalog.to_regprocedure('public.restaurant_table_mutate(text,jsonb,text)'),
    pg_catalog.to_regprocedure('public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)')
  )
    AND p.prosecdef
    AND p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]
    AND p.prosrc ILIKE '%public.is_platform_admin()%';
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'RC501_EXPECTS_SEVEN_EMPTY_PATH_CALLERS: found %',v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid IN (
      pg_catalog.to_regprocedure('public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)'),
      pg_catalog.to_regprocedure('public.deactivate_business(uuid,text)'),
      pg_catalog.to_regprocedure('public.fashion_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.resolve_legacy_scope(text)'),
      pg_catalog.to_regprocedure('public.restaurant_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.restaurant_table_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)')
    )
    AND (
      pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('postgres',p.oid,'EXECUTE')
    )
  ) THEN
    RAISE EXCEPTION 'RC501_CALLER_ACL_CHANGED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid IN (
      pg_catalog.to_regprocedure('public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)'),
      pg_catalog.to_regprocedure('public.deactivate_business(uuid,text)'),
      pg_catalog.to_regprocedure('public.fashion_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.resolve_legacy_scope(text)'),
      pg_catalog.to_regprocedure('public.restaurant_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.restaurant_table_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)')
    )
    AND p.proowner <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')
  ) THEN
    RAISE EXCEPTION 'RC501_CALLER_OWNER_CHANGED';
  END IF;
END;
$metadata$;

-- A registered platform root remains authorized through all seven callers.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $root$
DECLARE v_ok boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'RC501_REGISTERED_ROOT_REJECTED'; END IF;
  SELECT public.create_notification_backend('N-1','TENANT-A','10000000-0000-4000-8000-000000000001','SYSTEM','Title','Body','BUSINESS','B-1') INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_NOTIFICATION_ROOT_REJECTED'; END IF;
  SELECT public.deactivate_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test') INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_DEACTIVATE_ROOT_REJECTED'; END IF;
  SELECT public.fashion_erp_mutate('test','{}'::jsonb,'idem-00000001') INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_FASHION_ROOT_REJECTED'; END IF;
  SELECT public.resolve_legacy_scope(NULL::text) INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_LEGACY_SCOPE_ROOT_REJECTED'; END IF;
  SELECT public.restaurant_erp_mutate('test','{}'::jsonb,'idem-00000002') INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_RESTAURANT_ROOT_REJECTED'; END IF;
  SELECT public.restaurant_table_mutate('test','{}'::jsonb,'idem-00000003') INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_RESTAURANT_TABLE_ROOT_REJECTED'; END IF;
  SELECT public.set_platform_feature_flag_backend('PLATFORM','MNTY-PLATFORM',NULL,NULL,NULL,NULL,'CORE','FEATURE',true,'{}'::jsonb) INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RC501_FEATURE_FLAG_ROOT_REJECTED'; END IF;
END;
$root$;

-- A tenant ADMIN outside the protected registry must not gain global root authority.
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
DO $tenant_admin$
DECLARE v_ok boolean;
BEGIN
  IF public.is_platform_admin() THEN RAISE EXCEPTION 'RC501_TENANT_ADMIN_ESCALATED_TO_PLATFORM_ROOT'; END IF;
  SELECT public.create_notification_backend('N-2','TENANT-A','20000000-0000-4000-8000-000000000002','SYSTEM','Title','Body','BUSINESS','B-2') INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_NOTIFICATION_TENANT_ADMIN_ESCALATED'; END IF;
  SELECT public.deactivate_business('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test') INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_DEACTIVATE_TENANT_ADMIN_ESCALATED'; END IF;
  SELECT public.fashion_erp_mutate('test','{}'::jsonb,'idem-00000004') INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_FASHION_TENANT_ADMIN_ESCALATED'; END IF;
  SELECT public.resolve_legacy_scope(NULL::text) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_LEGACY_SCOPE_TENANT_ADMIN_ESCALATED'; END IF;
  SELECT public.restaurant_erp_mutate('test','{}'::jsonb,'idem-00000005') INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_RESTAURANT_TENANT_ADMIN_ESCALATED'; END IF;
  SELECT public.restaurant_table_mutate('test','{}'::jsonb,'idem-00000006') INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_RESTAURANT_TABLE_TENANT_ADMIN_ESCALATED'; END IF;
  SELECT public.set_platform_feature_flag_backend('TENANT','TENANT-A',NULL,'TENANT-A',NULL,NULL,'CORE','FEATURE',true,'{}'::jsonb) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'RC501_FEATURE_FLAG_TENANT_ADMIN_ESCALATED'; END IF;
END;
$tenant_admin$;

-- Confirm an authenticated actor may still invoke only the registry-backed helper.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
DO $auth$
BEGIN
  IF public.is_platform_admin() THEN RAISE EXCEPTION 'RC501_AUTHENTICATED_TENANT_ADMIN_HELPER_ESCALATED'; END IF;
END;
$auth$;
RESET ROLE;
RESET request.jwt.claim.sub;

SELECT 'RC501 seven platform-admin callers empty-search-path contract: PASS' AS result;
