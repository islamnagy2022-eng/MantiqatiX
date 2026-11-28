-- DEMO admin compatibility: exact ACL/RLS assertions after full ordered migration replay.
-- This contract runs only against the disposable localhost PostgreSQL 17 replay database.

DO $demo_admin_compatibility$
DECLARE
  v_signature text;
  v_oid oid;
  v_table text;
  v_privilege text;
  v_has_rls boolean;
  v_force_rls boolean;
  v_root_body text;
  v_root_config text[];
  v_registry_rls boolean;
  v_registry_force_rls boolean;

  v_rpc_signatures text[] := ARRAY[
    'public.mnty_platform_admin_list_custom_roles()',
    'public.mnty_platform_admin_upsert_custom_role(text,text,text,text,jsonb,uuid,boolean)',
    'public.mnty_platform_admin_assign_custom_role(uuid,uuid,varchar,uuid,varchar,boolean,uuid)',
    'public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid)',
    'public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid)',
    'public.mnty_platform_has_permission(text,varchar,uuid,varchar)',
    'public.mnty_platform_admin_list_people(text)',
    'public.mnty_platform_admin_list_role_assignments()',
    'public.mnty_business_employee_list(varchar,uuid)',
    'public.mnty_business_employee_list_scoped(varchar,uuid,varchar)',
    'public.mnty_platform_admin_list_audit(text)',
    'public.mnty_platform_admin_list_businesses(text)',
    'public.mnty_platform_admin_manage_business(uuid,text,jsonb,text)',
    'public.mnty_platform_admin_manage_membership(uuid,text,text)'
  ];
  v_internal_signatures text[] := ARRAY[
    'public.mnty_business_employee_permission_ceiling_allows(jsonb,varchar,uuid,varchar)',
    'public.mnty_business_employee_permissions_subset(jsonb,jsonb)'
  ];
  v_tables text[] := ARRAY[
    'platform_custom_roles',
    'platform_role_assignments',
    'business_job_positions',
    'business_employees'
  ];
  v_table_privileges text[] := ARRAY[
    'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
  ];
BEGIN
  -- Every exposed control-center RPC must exist, deny anon/PUBLIC, and be
  -- explicitly callable by authenticated. PUBLIC grants also make anon pass.
  FOREACH v_signature IN ARRAY v_rpc_signatures LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'DEMO_ADMIN_RPC_MISSING: %', v_signature;
    END IF;
    IF pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'DEMO_ADMIN_ANON_EXECUTE_GRANTED: %', v_signature;
    END IF;
    IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'DEMO_ADMIN_AUTHENTICATED_EXECUTE_MISSING: %', v_signature;
    END IF;
  END LOOP;

  -- Internal permission helpers must not be directly callable by client roles.
  FOREACH v_signature IN ARRAY v_internal_signatures LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'DEMO_ADMIN_INTERNAL_HELPER_MISSING: %', v_signature;
    END IF;
    IF pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'DEMO_ADMIN_INTERNAL_HELPER_CLIENT_EXECUTE_GRANTED: %', v_signature;
    END IF;
  END LOOP;

  -- Privileged tables must have enabled + forced RLS and no direct client DML/read ACL.
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO v_has_rls, v_force_rls
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table AND c.relkind = 'r';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DEMO_ADMIN_TABLE_MISSING: %', v_table;
    END IF;
    IF NOT v_has_rls OR NOT v_force_rls THEN
      RAISE EXCEPTION 'DEMO_ADMIN_RLS_NOT_FORCED: % (enabled %, forced %)',
        v_table, v_has_rls, v_force_rls;
    END IF;

    FOREACH v_privilege IN ARRAY v_table_privileges LOOP
      IF pg_catalog.has_table_privilege('anon', pg_catalog.format('public.%I', v_table), v_privilege)
         OR pg_catalog.has_table_privilege('authenticated', pg_catalog.format('public.%I', v_table), v_privilege) THEN
        RAISE EXCEPTION 'DEMO_ADMIN_DIRECT_TABLE_PRIVILEGE_GRANTED: %.% to a client role',
          v_table, v_privilege;
      END IF;
    END LOOP;
  END LOOP;

  -- The full replay must include the canonical registry-backed root helper,
  -- with its execution path pinned. A standalone helper hot patch is not enough.
  SELECT p.prosrc, p.proconfig
    INTO v_root_body, v_root_config
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'mnty_can_platform_admin'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

  IF NOT FOUND OR position('private.platform_admins' IN coalesce(v_root_body,'')) = 0 THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_HELPER_NOT_REGISTRY_BACKED';
  END IF;
  IF NOT coalesce(v_root_config, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_HELPER_SEARCH_PATH_NOT_EMPTY: %', v_root_config;
  END IF;

  SELECT c.relrowsecurity, c.relforcerowsecurity
    INTO v_registry_rls, v_registry_force_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private' AND c.relname = 'platform_admins';

  IF NOT FOUND OR NOT v_registry_rls OR NOT v_registry_force_rls THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_REGISTRY_RLS_NOT_FORCED';
  END IF;
END;
$demo_admin_compatibility$;

SELECT 'DEMO_ADMIN_COMPATIBILITY_ACL_RLS=PASS' AS result;
