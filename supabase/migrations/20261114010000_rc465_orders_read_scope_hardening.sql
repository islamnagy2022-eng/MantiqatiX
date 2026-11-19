-- RC465: align direct order reads with the business/branch authorization contract.
-- RC103 already requires scoped operational mutations to match business and exact branch.
-- This forward-only migration closes the older RC109 tenant-only SELECT boundary.
-- Customer-owned cross-tenant reads remain governed by orders_customer_select_own.
-- No table, data, grant, payment, or order-state changes are performed.

BEGIN;

DO $preflight$
DECLARE
  v_orders_rls boolean;
  v_memberships_rls boolean;
  v_history_rls boolean;
  v_orders_select_policy_count integer;
  v_orders_expected_select_policy_count integer;
  v_history_select_policy_count integer;
  v_history_expected_select_policy_count integer;
BEGIN
  IF pg_catalog.to_regclass('public.orders') IS NULL
     OR pg_catalog.to_regclass('public.user_memberships') IS NULL
     OR pg_catalog.to_regclass('public.order_status_history') IS NULL THEN
    RAISE EXCEPTION 'RC465_REQUIRED_TABLE_MISSING';
  END IF;

  SELECT c.relrowsecurity INTO v_orders_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.orders');

  SELECT c.relrowsecurity INTO v_memberships_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.user_memberships');

  SELECT c.relrowsecurity INTO v_history_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.order_status_history');

  IF NOT coalesce(v_orders_rls, false)
     OR NOT coalesce(v_memberships_rls, false)
     OR NOT coalesce(v_history_rls, false) THEN
    RAISE EXCEPTION 'RC465_RLS_MUST_REMAIN_ENABLED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.orders', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.user_memberships', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.order_status_history', 'SELECT') THEN
    RAISE EXCEPTION 'RC465_EXPECTED_READ_ONLY_AUTHENTICATED_GRANTS_MISSING';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.order_status_history', 'INSERT')
     OR pg_catalog.has_table_privilege('anon', 'public.order_status_history', 'UPDATE')
     OR pg_catalog.has_table_privilege('anon', 'public.order_status_history', 'DELETE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.order_status_history', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.order_status_history', 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', 'public.order_status_history', 'DELETE') THEN
    RAISE EXCEPTION 'RC465_UNEXPECTED_HISTORY_CLIENT_WRITE_GRANT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'orders_member_select' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'orders_provider_select_own_business' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'orders_customer_select_own' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_status_history'
      AND policyname = 'order_status_history_member_read' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_status_history'
      AND policyname = 'order_status_history_customer_select_own' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'RC465_EXPECTED_ORDER_AND_HISTORY_SELECT_POLICIES_MISSING';
  END IF;

  -- RLS policies are permissive by default and OR together. An unreviewed
  -- extra SELECT/ALL policy could silently bypass the scoped policies below.
  -- Match the complete live policy set exactly before replacing anything.
  SELECT count(*) INTO v_orders_select_policy_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public' AND tablename = 'orders'
    AND cmd IN ('SELECT', 'ALL') AND permissive = 'PERMISSIVE';

  SELECT count(*) INTO v_orders_expected_select_policy_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public' AND tablename = 'orders'
    AND cmd IN ('SELECT', 'ALL') AND permissive = 'PERMISSIVE'
    AND policyname IN (
      'orders_member_select',
      'orders_provider_select_own_business',
      'orders_customer_select_own'
    )
    AND roles = ARRAY['authenticated']::name[];

  IF v_orders_select_policy_count <> 3 OR v_orders_expected_select_policy_count <> 3 THEN
    RAISE EXCEPTION 'RC465_UNEXPECTED_PERMISSIVE_ORDERS_SELECT_POLICY_SET: total %, expected authenticated policies %',
      v_orders_select_policy_count, v_orders_expected_select_policy_count;
  END IF;

  SELECT count(*) INTO v_history_select_policy_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public' AND tablename = 'order_status_history'
    AND cmd IN ('SELECT', 'ALL') AND permissive = 'PERMISSIVE';

  SELECT count(*) INTO v_history_expected_select_policy_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public' AND tablename = 'order_status_history'
    AND cmd IN ('SELECT', 'ALL') AND permissive = 'PERMISSIVE'
    AND policyname IN (
      'order_status_history_member_read',
      'order_status_history_customer_select_own'
    )
    AND roles = ARRAY['authenticated']::name[];

  IF v_history_select_policy_count <> 2 OR v_history_expected_select_policy_count <> 2 THEN
    RAISE EXCEPTION 'RC465_UNEXPECTED_PERMISSIVE_HISTORY_SELECT_POLICY_SET: total %, expected authenticated policies %',
      v_history_select_policy_count, v_history_expected_select_policy_count;
  END IF;
END;
$preflight$;

DROP POLICY orders_member_select ON public.orders;
CREATE POLICY orders_member_select
ON public.orders
FOR SELECT
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND (
    -- Only a fully unscoped tenant OWNER/ADMIN retains tenant-wide visibility.
    EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id::text = orders.tenant_id::text
        AND m.status = 'ACTIVE'
        AND upper(m.role) IN ('OWNER', 'ADMIN')
        AND m.business_id IS NULL
        AND m.branch_id IS NULL
    )
    OR
    -- Every scoped operational role must match both the order's business and branch.
    EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id::text = orders.tenant_id::text
        AND m.status = 'ACTIVE'
        AND upper(m.role) = ANY (ARRAY[
          'OWNER', 'ADMIN', 'BUSINESS_OWNER', 'MANAGER', 'STAFF', 'EMPLOYEE',
          'FINANCE', 'ACCOUNTANT', 'FINANCE_MANAGER'
        ])
        AND m.business_id = orders.business_id
        AND m.branch_id IS NOT DISTINCT FROM orders.branch_id
    )
    OR
    -- Explicit assignment remains valid, but cannot escape a scoped membership.
    (
      orders.assigned_partner_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.user_memberships mp
        WHERE mp.user_id = auth.uid()
          AND mp.tenant_id::text = orders.tenant_id::text
          AND mp.status = 'ACTIVE'
          AND (mp.business_id IS NULL OR mp.business_id = orders.business_id)
          AND (mp.branch_id IS NULL OR mp.branch_id = orders.branch_id)
      )
    )
  )
);

DROP POLICY orders_provider_select_own_business ON public.orders;
CREATE POLICY orders_provider_select_own_business
ON public.orders
FOR SELECT
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = orders.tenant_id::text
      AND m.business_id = orders.business_id
      AND (m.branch_id IS NULL OR m.branch_id = orders.branch_id)
      AND m.status = 'ACTIVE'
      AND upper(m.role) = 'SERVICE_PROVIDER'
  )
);

COMMENT ON POLICY orders_member_select ON public.orders IS
  'RC465: tenant-wide reads require a fully unscoped OWNER/ADMIN; all scoped operational memberships match the exact order business and branch. Customer-owned cross-tenant reads remain in orders_customer_select_own.';

-- Order history is a child resource of orders. Preserve the existing
-- RESTRICTIVE anonymous-session guards; replace only the permissive tenant-wide
-- member-read policy so it inherits the parent order's business/branch boundary.
DROP POLICY order_status_history_member_read ON public.order_status_history;
CREATE POLICY order_status_history_member_read
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.tenant_id::text = order_status_history.tenant_id::text
      AND o.business_id = order_status_history.business_id
      AND o.branch_id IS NOT DISTINCT FROM order_status_history.branch_id
  )
);

DROP POLICY order_status_history_customer_select_own ON public.order_status_history;
CREATE POLICY order_status_history_customer_select_own
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.customer_id = auth.uid()
      AND o.tenant_id::text = order_status_history.tenant_id::text
      AND o.business_id = order_status_history.business_id
      AND o.branch_id IS NOT DISTINCT FROM order_status_history.branch_id
  )
);

-- Keep the legacy insert policy fail-closed even if a future release adds a
-- client INSERT grant: actor, membership, exact order, business and branch must agree.
DROP POLICY order_status_history_manager_insert ON public.order_status_history;
CREATE POLICY order_status_history_manager_insert
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = order_status_history.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (
          um.business_id = order_status_history.business_id
          AND um.branch_id IS NOT DISTINCT FROM order_status_history.branch_id
        )
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.tenant_id::text = order_status_history.tenant_id::text
      AND o.business_id = order_status_history.business_id
      AND o.branch_id IS NOT DISTINCT FROM order_status_history.branch_id
  )
);

COMMENT ON POLICY order_status_history_member_read ON public.order_status_history IS
  'RC465: order history inherits the parent order visibility boundary; business and branch identifiers must match the parent order.';
COMMENT ON POLICY order_status_history_customer_select_own ON public.order_status_history IS
  'RC465: customers can read history only for their own orders and only when the history scope matches the parent order.';
COMMENT ON POLICY order_status_history_manager_insert ON public.order_status_history IS
  'RC465: future authenticated writes require an active manager membership in the exact business/branch scope and a matching parent order.';

COMMENT ON POLICY orders_provider_select_own_business ON public.orders IS
  'RC465: service providers read only their own business; branch-scoped providers are restricted to their assigned branch.';

COMMIT;
