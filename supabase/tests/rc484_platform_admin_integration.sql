-- RC484 behavioral acceptance. Run only after rc484_platform_admin_fixture.sql + RC484 migration.
-- Inspect metadata/ACLs as postgres first; the authenticated role intentionally has no
-- USAGE on schema private and must not be able to resolve the protected registry name.
DO $metadata$
DECLARE
  v_policy_count integer;
  v_table_count integer;
BEGIN
  SELECT count(*),count(DISTINCT schemaname||'.'||tablename)
    INTO v_policy_count,v_table_count
  FROM pg_catalog.pg_policies
  WHERE coalesce(qual,'') ILIKE '%is_platform_admin()%'
     OR coalesce(with_check,'') ILIKE '%is_platform_admin()%';
  IF v_policy_count<>57 OR v_table_count<>24 THEN
    RAISE EXCEPTION 'RC484_FIXTURE_POLICY_SHAPE_MISMATCH: % policies / % tables',v_policy_count,v_table_count;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid='public.is_platform_admin()'::regprocedure
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'RC484_HELPER_MUST_BE_SECURITY_DEFINER_WITH_EMPTY_SEARCH_PATH';
  END IF;

  IF has_table_privilege('anon','private.platform_admins','SELECT')
     OR has_table_privilege('authenticated','private.platform_admins','SELECT')
     OR has_table_privilege('anon','private.platform_admins','INSERT')
     OR has_table_privilege('authenticated','private.platform_admins','INSERT')
     OR has_table_privilege('anon','private.platform_admins','UPDATE')
     OR has_table_privilege('authenticated','private.platform_admins','UPDATE')
     OR has_table_privilege('anon','private.platform_admins','DELETE')
     OR has_table_privilege('authenticated','private.platform_admins','DELETE') THEN
    RAISE EXCEPTION 'RC484_CLIENT_ROLE_CAN_ACCESS_PRIVATE_REGISTRY';
  END IF;
  IF NOT has_table_privilege('service_role','private.platform_admins','SELECT')
     OR NOT has_table_privilege('service_role','private.platform_admins','INSERT')
     OR NOT has_table_privilege('service_role','private.platform_admins','UPDATE')
     OR NOT has_table_privilege('service_role','private.platform_admins','DELETE') THEN
    RAISE EXCEPTION 'RC484_TRUSTED_SERVICE_ROLE_REGISTRY_BOUNDARY_NOT_PRESERVED';
  END IF;
  IF has_function_privilege('anon','public.is_platform_admin()','EXECUTE')
     OR has_function_privilege('service_role','public.is_platform_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'RC484_UNEXPECTED_HELPER_EXECUTE_GRANT';
  END IF;
  IF NOT has_function_privilege('authenticated','public.is_platform_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'RC484_AUTHENTICATED_HELPER_EXECUTE_MISSING';
  END IF;
END;
$metadata$;

SET ROLE authenticated;

DO $test$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'RC484_TENANT_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN';
  END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe;
  IF v_count<>1 THEN
    RAISE EXCEPTION 'RC484_TENANT_ADMIN_CROSSTENANT_RLS_BYPASS: expected own row only, got %',v_count;
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
  IF public.is_platform_admin() THEN
    RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN';
  END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe;
  IF v_count<>1 THEN
    RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_CROSSTENANT_RLS_BYPASS: expected own row only, got %',v_count;
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'RC484_REGISTRY_ONLY_PLATFORM_ADMIN_MUST_PASS';
  END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe;
  IF v_count<>3 THEN
    RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_MUST_RETAIN_GLOBAL_POLICY_ACCESS: expected 3 rows, got %',v_count;
  END IF;
END;
$test$;

RESET ROLE;
