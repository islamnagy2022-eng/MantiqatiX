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
  v_root_is_definer boolean;
  v_admin_definition text;
  v_list_definition text;
  v_function_config text[];
  v_function_is_definer boolean;
  v_registry_rls boolean;
  v_registry_force_rls boolean;
  v_membership_index_unique boolean;
  v_membership_index_definition text;
  v_bizcatalog_rls boolean;
  v_delete_oid oid;
  v_delete_definer boolean;
  v_delete_config text[];
  v_delete_body text;
  v_delete_select_tables text[] := ARRAY[
    'businesses','branches','orders','restaurant_orders','fashion_orders',
    'erp_purchase_orders','erp_purchase_receipts','erp_stock_transfers','refund_transactions',
    'subscription_payment_intents','business_referral_events','agreements',
    'inventory_transactions','journal_entries','order_status_history','stock_balances'
  ];
  v_delete_tables text[] := ARRAY[
    'user_memberships','departments','restaurant_inventory','restaurant_menu_items',
    'restaurant_tables','fashion_products','warehouses','catalog_items',
    'catalog_business_settings','advertisements','marketing_provider_profiles','branches','businesses'
  ];

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
    SELECT p.prosecdef, p.proconfig
      INTO v_function_is_definer, v_function_config
    FROM pg_catalog.pg_proc p WHERE p.oid = v_oid;
    IF NOT v_function_is_definer THEN
      RAISE EXCEPTION 'DEMO_ADMIN_RPC_NOT_SECURITY_DEFINER: %', v_signature;
    END IF;
    IF NOT coalesce(v_function_config, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[] THEN
      RAISE EXCEPTION 'DEMO_ADMIN_DEFINER_SEARCH_PATH_NOT_EMPTY: % (%).', v_signature, v_function_config;
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
    IF v_signature = 'public.mnty_business_employee_permission_ceiling_allows(jsonb,varchar,uuid,varchar)' THEN
      SELECT p.prosecdef, p.proconfig
        INTO v_function_is_definer, v_function_config
      FROM pg_catalog.pg_proc p WHERE p.oid = v_oid;
      IF NOT v_function_is_definer OR NOT coalesce(v_function_config, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[] THEN
        RAISE EXCEPTION 'DEMO_ADMIN_INTERNAL_DEFINER_PATH_FAILED: % (%)', v_signature, v_function_config;
      END IF;
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

  -- Preserve RC117 activity synchronization and never truncate the admin directory.
  SELECT pg_catalog.pg_get_functiondef('public.mnty_platform_admin_manage_business(uuid,text,jsonb,text)'::regprocedure)
    INTO v_admin_definition;
  IF position('marketing_provider_profiles' IN coalesce(v_admin_definition,'')) = 0 THEN
    RAISE EXCEPTION 'DEMO_ADMIN_RC117_ACTIVITY_NAME_SYNC_MISSING';
  END IF;
  SELECT pg_catalog.pg_get_functiondef('public.mnty_platform_admin_list_businesses(text)'::regprocedure)
    INTO v_list_definition;
  IF position('limit 300' IN lower(coalesce(v_list_definition,''))) > 0 THEN
    RAISE EXCEPTION 'DEMO_ADMIN_RC117_ACTIVITY_LIST_TRUNCATED';
  END IF;

  -- The business-wide membership idempotency prerequisite is installed by RC472.
  SELECT i.indisunique, pg_catalog.pg_get_indexdef(i.indexrelid)
    INTO v_membership_index_unique, v_membership_index_definition
  FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_catalog.pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = tbl.relnamespace
  WHERE n.nspname = 'public'
    AND tbl.relname = 'user_memberships'
    AND idx.relname = 'ux_user_memberships_user_business_branch_nullsafe';
  IF NOT FOUND OR NOT v_membership_index_unique
     OR position('COALESCE' IN upper(coalesce(v_membership_index_definition,''))) = 0 THEN
    RAISE EXCEPTION 'DEMO_ADMIN_MEMBERSHIP_SCOPE_INDEX_MISSING_OR_INVALID: %', v_membership_index_definition;
  END IF;

  -- BizCatalog platform settings are server-role-only.
  SELECT c.relrowsecurity INTO v_bizcatalog_rls
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='bizcatalog_platform_settings';
  IF NOT FOUND OR NOT v_bizcatalog_rls THEN RAISE EXCEPTION 'DEMO_ADMIN_BIZCATALOG_SETTINGS_RLS_MISSING'; END IF;
  FOREACH v_privilege IN ARRAY v_table_privileges LOOP
    IF pg_catalog.has_table_privilege('anon','public.bizcatalog_platform_settings',v_privilege)
       OR pg_catalog.has_table_privilege('authenticated','public.bizcatalog_platform_settings',v_privilege) THEN
      RAISE EXCEPTION 'DEMO_ADMIN_BIZCATALOG_SETTINGS_CLIENT_PRIVILEGE_GRANTED: %', v_privilege;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname='public'
      AND p.tablename='bizcatalog_platform_settings'
      AND p.policyname='bizcatalog_platform_settings_service_role_only'
      AND p.cmd='ALL'
      AND 'service_role'=ANY(p.roles::text[])
  ) THEN
    RAISE EXCEPTION 'DEMO_ADMIN_BIZCATALOG_SETTINGS_SERVICE_POLICY_MISSING';
  END IF;
  IF NOT pg_catalog.has_table_privilege('service_role','public.bizcatalog_platform_settings','SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role','public.bizcatalog_platform_settings','INSERT')
     OR NOT pg_catalog.has_table_privilege('service_role','public.bizcatalog_platform_settings','UPDATE') THEN
    RAISE EXCEPTION 'DEMO_ADMIN_BIZCATALOG_SETTINGS_SERVICE_PRIVILEGE_MISSING';
  END IF;

  -- Business deletion is invoker-safe and server-role-only; its body must retain history guards/audit.
  v_delete_oid := pg_catalog.to_regprocedure('public.mnty_platform_admin_delete_business(text,uuid,uuid)');
  IF v_delete_oid IS NULL THEN RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_MISSING'; END IF;
  SELECT p.prosecdef,p.proconfig,p.prosrc INTO v_delete_definer,v_delete_config,v_delete_body
  FROM pg_catalog.pg_proc p WHERE p.oid=v_delete_oid;
  IF v_delete_definer THEN RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_MUST_BE_INVOKER'; END IF;
  IF NOT coalesce(v_delete_config,ARRAY[]::text[]) @> ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_SEARCH_PATH_NOT_EMPTY';
  END IF;
  IF pg_catalog.has_function_privilege('anon',v_delete_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',v_delete_oid,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role',v_delete_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_ACL_FAILED';
  END IF;
  IF position('business_delete_blocked_by_history' IN lower(coalesce(v_delete_body,'')))=0
     OR position('bizcatalog_business_deleted' IN lower(coalesce(v_delete_body,'')))=0 THEN
    RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_HISTORY_OR_AUDIT_GUARD_MISSING';
  END IF;

  FOREACH v_table IN ARRAY v_delete_select_tables LOOP
    IF NOT pg_catalog.has_table_privilege('service_role',pg_catalog.format('public.%I',v_table),'SELECT') THEN
      RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_SERVICE_SELECT_MISSING: %',v_table;
    END IF;
  END LOOP;
  FOREACH v_table IN ARRAY v_delete_tables LOOP
    IF NOT pg_catalog.has_table_privilege('service_role',pg_catalog.format('public.%I',v_table),'DELETE') THEN
      RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_SERVICE_DELETE_MISSING: %',v_table;
    END IF;
  END LOOP;
  IF NOT pg_catalog.has_table_privilege('service_role','public.businesses','UPDATE')
     OR NOT pg_catalog.has_table_privilege('service_role','public.audit_logs','INSERT') THEN
    RAISE EXCEPTION 'DEMO_ADMIN_DELETE_RPC_SERVICE_LOCK_OR_AUDIT_PRIVILEGE_MISSING';
  END IF;

  -- The full replay must include the canonical registry-backed root helper,
  -- with its execution path pinned. A standalone helper hot patch is not enough.
  SELECT p.prosrc, p.proconfig, p.prosecdef
    INTO v_root_body, v_root_config, v_root_is_definer
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'mnty_can_platform_admin'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = '';

  IF NOT FOUND OR position('private.platform_admins' IN coalesce(v_root_body,'')) = 0 THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_HELPER_NOT_REGISTRY_BACKED';
  END IF;
  v_oid := pg_catalog.to_regprocedure('public.mnty_can_platform_admin()');
  IF v_oid IS NULL OR NOT v_root_is_definer THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_HELPER_NOT_SECURITY_DEFINER';
  END IF;
  IF pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_HELPER_ANON_EXECUTE_GRANTED';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'DEMO_ADMIN_ROOT_HELPER_AUTHENTICATED_EXECUTE_MISSING';
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

  FOREACH v_privilege IN ARRAY v_table_privileges LOOP
    IF pg_catalog.has_table_privilege('anon', 'private.platform_admins', v_privilege)
       OR pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', v_privilege) THEN
      RAISE EXCEPTION 'DEMO_ADMIN_ROOT_REGISTRY_DIRECT_CLIENT_PRIVILEGE_GRANTED: %', v_privilege;
    END IF;
  END LOOP;
END;
$demo_admin_compatibility$;

SELECT 'DEMO_ADMIN_COMPATIBILITY_ACL_RLS_DEFINER_AND_EDGE_DEPS=PASS' AS result;
