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
BEGIN
  IF pg_catalog.to_regclass('public.orders') IS NULL
     OR pg_catalog.to_regclass('public.user_memberships') IS NULL THEN
    RAISE EXCEPTION 'RC465_REQUIRED_TABLE_MISSING';
  END IF;

  SELECT c.relrowsecurity INTO v_orders_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.orders');

  SELECT c.relrowsecurity INTO v_memberships_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.user_memberships');

  IF NOT coalesce(v_orders_rls, false)
     OR NOT coalesce(v_memberships_rls, false) THEN
    RAISE EXCEPTION 'RC465_RLS_MUST_REMAIN_ENABLED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.orders', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.user_memberships', 'SELECT') THEN
    RAISE EXCEPTION 'RC465_EXPECTED_READ_ONLY_AUTHENTICATED_GRANTS_MISSING';
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
  ) THEN
    RAISE EXCEPTION 'RC465_EXPECTED_ORDER_SELECT_POLICIES_MISSING';
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

COMMENT ON POLICY orders_provider_select_own_business ON public.orders IS
  'RC465: service providers read only their own business; branch-scoped providers are restricted to their assigned branch.';

COMMIT;
