-- RC484 behavioral acceptance. Run only after rc484_platform_admin_fixture.sql + RC484 migration.
DO $metadata$
DECLARE
  v_policy_count integer;
  v_table_count integer;
  v_select_count integer;
  v_update_count integer;
  v_delete_count integer;
  v_all_count integer;
BEGIN
  SELECT count(*),count(DISTINCT schemaname||'.'||tablename),
    count(*) FILTER(WHERE cmd='SELECT'),
    count(*) FILTER(WHERE cmd='UPDATE'),
    count(*) FILTER(WHERE cmd='DELETE'),
    count(*) FILTER(WHERE cmd='ALL')
  INTO v_policy_count,v_table_count,v_select_count,v_update_count,v_delete_count,v_all_count
  FROM pg_catalog.pg_policies
  WHERE coalesce(qual,'') ILIKE '%is_platform_admin()%'
     OR coalesce(with_check,'') ILIKE '%is_platform_admin()%';
  IF v_policy_count<>57 OR v_table_count<>24
     OR v_select_count<>18 OR v_update_count<>17
     OR v_delete_count<>15 OR v_all_count<>7 THEN
    RAISE EXCEPTION 'RC484_FIXTURE_POLICY_SHAPE_MISMATCH: total %, tables %, SELECT %, UPDATE %, DELETE %, ALL %',
      v_policy_count,v_table_count,v_select_count,v_update_count,v_delete_count,v_all_count;
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
  v_denied boolean;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  IF public.is_platform_admin() THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN'; END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_CROSSTENANT_SELECT_BYPASS'; END IF;
  UPDATE public.scope_probe SET tenant_id='ADMIN_TAMPER' WHERE id=2;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_CROSSTENANT_UPDATE_BYPASS'; END IF;
  DELETE FROM public.scope_probe WHERE id=2;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_CROSSTENANT_DELETE_BYPASS'; END IF;
  v_denied:=false;
  BEGIN
    INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id)
    VALUES(4,'10000000-0000-4000-8000-000000000002','TENANT-B');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_CROSSTENANT_INSERT_BYPASS'; END IF;

  -- Tenant-local ADMIN keeps its own exact tenant/business/branch access through
  -- the explicit membership clause in the representative legacy ALL policy.
  SELECT count(*) INTO v_count FROM public.scope_probe_03;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_LOCAL_MEMBERSHIP_SELECT_LOST'; END IF;
  UPDATE public.scope_probe_03 SET tenant_id='TENANT-A' WHERE id=1;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_LOCAL_MEMBERSHIP_UPDATE_LOST'; END IF;
  DELETE FROM public.scope_probe_03 WHERE id=1;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_LOCAL_MEMBERSHIP_DELETE_LOST'; END IF;
  INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id,business_id,branch_id)
  VALUES(4,'10000000-0000-4000-8000-000000000003','TENANT-A','BUSINESS-A','BRANCH-A');
  v_denied:=false;
  BEGIN
    INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id,business_id,branch_id)
    VALUES(5,'10000000-0000-4000-8000-000000000002','TENANT-B','BUSINESS-B','BRANCH-B');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC484_TENANT_ADMIN_CROSS_TENANT_ALL_POLICY_BYPASS'; END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
  IF public.is_platform_admin() THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN'; END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_CROSSTENANT_SELECT_BYPASS'; END IF;
  UPDATE public.scope_probe SET tenant_id='SUPER_ADMIN_TAMPER' WHERE id=1;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_CROSSTENANT_UPDATE_BYPASS'; END IF;
  DELETE FROM public.scope_probe WHERE id=1;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>0 THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_CROSSTENANT_DELETE_BYPASS'; END IF;
  v_denied:=false;
  BEGIN
    INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id)
    VALUES(5,'10000000-0000-4000-8000-000000000001','TENANT-A');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_CROSSTENANT_INSERT_BYPASS'; END IF;

  -- Tenant SUPER_ADMIN retains only its own tenant/business/branch scope.
  SELECT count(*) INTO v_count FROM public.scope_probe_03;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_LOCAL_MEMBERSHIP_SELECT_LOST'; END IF;
  UPDATE public.scope_probe_03 SET tenant_id='TENANT-B' WHERE id=2;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_LOCAL_MEMBERSHIP_UPDATE_LOST'; END IF;
  DELETE FROM public.scope_probe_03 WHERE id=2;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_LOCAL_MEMBERSHIP_DELETE_LOST'; END IF;
  INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id,business_id,branch_id)
  VALUES(6,'10000000-0000-4000-8000-000000000001','TENANT-B','BUSINESS-B','BRANCH-B');
  v_denied:=false;
  BEGIN
    INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id,business_id,branch_id)
    VALUES(7,'10000000-0000-4000-8000-000000000001','TENANT-A','BUSINESS-A','BRANCH-A');
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC484_TENANT_SUPER_ADMIN_CROSS_TENANT_ALL_POLICY_BYPASS'; END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'RC484_REGISTRY_ONLY_PLATFORM_ADMIN_MUST_PASS'; END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe;
  IF v_count<>3 THEN RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_SELECT_FAILED'; END IF;
  UPDATE public.scope_probe SET tenant_id='ROOT_UPDATE' WHERE id=2;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_UPDATE_FAILED'; END IF;
  DELETE FROM public.scope_probe WHERE id=2;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_DELETE_FAILED'; END IF;
  SELECT count(*) INTO v_count FROM public.scope_probe_03;
  IF v_count<>3 THEN RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_ALL_SELECT_FAILED'; END IF;
  UPDATE public.scope_probe_03 SET tenant_id='ROOT_UPDATE' WHERE id=4;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_ALL_UPDATE_FAILED'; END IF;
  DELETE FROM public.scope_probe_03 WHERE id=4;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_ALL_DELETE_FAILED'; END IF;
  INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id,business_id,branch_id)
  VALUES(8,'10000000-0000-4000-8000-000000000002','TENANT-C','BUSINESS-C','BRANCH-C');
END;
$test$;

RESET ROLE;
