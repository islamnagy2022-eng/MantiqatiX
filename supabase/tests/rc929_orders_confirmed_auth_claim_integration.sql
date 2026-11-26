-- RC929 behavioral integration tests. Run only in disposable PostgreSQL.
SET ROLE authenticated;

DO $test$
DECLARE
  v_ids uuid[];
  v_history_ids text[];
BEGIN
  -- The exact same valid subject and active membership must not bypass a missing claim.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_MISSING_IS_ANONYMOUS_CLAIM_ALLOWED_ORDER_READ: %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_history_ids FROM public.order_status_history;
  IF v_history_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_MISSING_IS_ANONYMOUS_CLAIM_ALLOWED_HISTORY_READ: %',v_history_ids;
  END IF;

  -- An explicit JSON null is also missing evidence, not a confirmed identity.
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":null}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_NULL_IS_ANONYMOUS_CLAIM_ALLOWED_ORDER_READ: %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_history_ids FROM public.order_status_history;
  IF v_history_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_NULL_IS_ANONYMOUS_CLAIM_ALLOWED_HISTORY_READ: %',v_history_ids;
  END IF;

  -- Actual Anonymous Auth identities remain denied.
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_ANONYMOUS_AUTH_ORDER_READ_ALLOWED: %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_history_ids FROM public.order_status_history;
  IF v_history_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_ANONYMOUS_AUTH_HISTORY_READ_ALLOWED: %',v_history_ids;
  END IF;

  -- An explicit false claim is still insufficient without auth.uid().
  PERFORM set_config('request.jwt.claim.sub','',false);
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_NULL_AUTH_UID_ALLOWED_ORDER_READ: %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_history_ids FROM public.order_status_history;
  IF v_history_ids IS NOT NULL THEN
    RAISE EXCEPTION 'RC929_NULL_AUTH_UID_ALLOWED_HISTORY_READ: %',v_history_ids;
  END IF;

  -- A valid confirmed branch manager retains the exact RC465 business/branch scope.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS DISTINCT FROM ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000004'
  ]::uuid[] THEN
    RAISE EXCEPTION 'RC929_CONFIRMED_MANAGER_ORDER_COMPATIBILITY_FAILED: %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_history_ids FROM public.order_status_history;
  IF v_history_ids IS DISTINCT FROM ARRAY[
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004'
  ]::text[] THEN
    RAISE EXCEPTION 'RC929_CONFIRMED_MANAGER_HISTORY_COMPATIBILITY_FAILED: %',v_history_ids;
  END IF;

  -- Customers retain their own cross-tenant order visibility when explicitly confirmed.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS DISTINCT FROM ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000007'
  ]::uuid[] THEN
    RAISE EXCEPTION 'RC929_CONFIRMED_CUSTOMER_ORDER_COMPATIBILITY_FAILED: %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_history_ids FROM public.order_status_history;
  IF v_history_ids IS DISTINCT FROM ARRAY[
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000007'
  ]::text[] THEN
    RAISE EXCEPTION 'RC929_CONFIRMED_CUSTOMER_HISTORY_COMPATIBILITY_FAILED: %',v_history_ids;
  END IF;

  IF pg_catalog.has_table_privilege(current_user,'public.orders','INSERT')
     OR pg_catalog.has_table_privilege(current_user,'public.orders','UPDATE')
     OR pg_catalog.has_table_privilege(current_user,'public.orders','DELETE')
     OR pg_catalog.has_table_privilege(current_user,'public.order_status_history','INSERT')
     OR pg_catalog.has_table_privilege(current_user,'public.order_status_history','UPDATE')
     OR pg_catalog.has_table_privilege(current_user,'public.order_status_history','DELETE') THEN
    RAISE EXCEPTION 'RC929_UNEXPECTED_CLIENT_ORDER_WRITE_GRANT';
  END IF;
END;
$test$;

-- Read back the exact catalog policy contracts, independent of pg_policies formatting.
DO $policy_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class t ON t.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'orders'
      AND p.polname = 'orders_confirmed_auth_only'
      AND p.polpermissive IS FALSE
      AND p.polcmd = '*'
      AND (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = 'authenticated') = ANY(p.polroles)
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%is_anonymous%'
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%is not distinct from%'
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%auth.uid()%'
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%is not null%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%is_anonymous%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%is not distinct from%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%auth.uid()%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%is not null%'
  ) THEN
    RAISE EXCEPTION 'RC929_ORDERS_RESTRICTIVE_CONFIRMED_AUTH_POLICY_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class t ON t.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'order_status_history'
      AND p.polname = 'order_status_history_confirmed_auth_only'
      AND p.polpermissive IS FALSE
      AND p.polcmd = '*'
      AND (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = 'authenticated') = ANY(p.polroles)
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%is_anonymous%'
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%is not distinct from%'
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%auth.uid()%'
      AND lower(pg_catalog.pg_get_expr(p.polqual, p.polrelid)) LIKE '%is not null%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%is_anonymous%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%is not distinct from%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%auth.uid()%'
      AND lower(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) LIKE '%is not null%'
  ) THEN
    RAISE EXCEPTION 'RC929_HISTORY_RESTRICTIVE_CONFIRMED_AUTH_POLICY_MISSING';
  END IF;
END;
$policy_contract$;
