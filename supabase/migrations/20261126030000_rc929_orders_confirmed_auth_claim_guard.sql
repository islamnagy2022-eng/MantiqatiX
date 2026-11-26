-- RC929: require an explicitly confirmed Supabase Auth identity for order resources.
-- RC465 narrows order reads to exact business/branch scope, but its legacy
-- COALESCE(is_anonymous, false) predicates allow a missing JWT claim.
-- This forward-only guard composes restrictively with existing policies.
-- No row data, grants, table definitions, payment state, or order state changes.

BEGIN;

DO $preflight$
DECLARE
  v_orders_rls boolean;
  v_history_rls boolean;
BEGIN
  IF pg_catalog.to_regclass('public.orders') IS NULL
     OR pg_catalog.to_regclass('public.order_status_history') IS NULL THEN
    RAISE EXCEPTION 'RC929_REQUIRED_ORDER_TABLE_MISSING';
  END IF;

  SELECT c.relrowsecurity
    INTO v_orders_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.orders');

  SELECT c.relrowsecurity
    INTO v_history_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.order_status_history');

  IF NOT coalesce(v_orders_rls, false)
     OR NOT coalesce(v_history_rls, false) THEN
    RAISE EXCEPTION 'RC929_ORDER_RESOURCE_RLS_MUST_REMAIN_ENABLED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'orders_member_select'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'orders_customer_select_own'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_status_history'
      AND policyname = 'order_status_history_member_read'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_status_history'
      AND policyname = 'order_status_history_customer_select_own'
      AND cmd = 'SELECT'
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'RC929_EXPECTED_ORDER_AND_HISTORY_POLICIES_MISSING';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.orders', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.order_status_history', 'SELECT') THEN
    RAISE EXCEPTION 'RC929_UNEXPECTED_ANON_ORDER_READ_GRANT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'orders_confirmed_auth_only'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_status_history'
      AND policyname = 'order_status_history_confirmed_auth_only'
  ) THEN
    RAISE EXCEPTION 'RC929_GUARD_POLICY_ALREADY_EXISTS';
  END IF;
END;
$preflight$;

-- Restrictive policies are ANDed with all permissive order policies.
-- Missing, NULL, true, or malformed is_anonymous claims are denied.
CREATE POLICY orders_confirmed_auth_only
ON public.orders
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
);

CREATE POLICY order_status_history_confirmed_auth_only
ON public.order_status_history
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
);

COMMENT ON POLICY orders_confirmed_auth_only ON public.orders IS
  'RC929: authenticated order access requires a non-null user identity and an explicit is_anonymous=false JWT claim; missing/null claims fail closed.';

COMMENT ON POLICY order_status_history_confirmed_auth_only ON public.order_status_history IS
  'RC929: authenticated order-history access and writes require a non-null user identity and an explicit is_anonymous=false JWT claim; missing/null claims fail closed.';

COMMIT;
