-- RC464B: verify the complete legacy permissive SELECT policy sets before RC465 replaces them.
-- This must execute after RC464 and immediately before RC465 in the ordered release chain.
-- PostgreSQL permissive policies OR together; an unreviewed SELECT/ALL policy can bypass
-- the new business/branch predicates even when RC465 itself succeeds.
-- This transaction is deliberately read-only: it only validates catalog state.

BEGIN;

DO $preflight$
DECLARE
  v_orders_rls boolean;
  v_history_rls boolean;
  v_orders_total integer;
  v_orders_expected integer;
  v_history_total integer;
  v_history_expected integer;
BEGIN
  IF pg_catalog.to_regclass('public.orders') IS NULL
     OR pg_catalog.to_regclass('public.order_status_history') IS NULL THEN
    RAISE EXCEPTION 'RC464B_REQUIRED_ORDER_TABLE_MISSING';
  END IF;

  SELECT c.relrowsecurity INTO v_orders_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.orders');

  SELECT c.relrowsecurity INTO v_history_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('public.order_status_history');

  IF NOT coalesce(v_orders_rls, false)
     OR NOT coalesce(v_history_rls, false) THEN
    RAISE EXCEPTION 'RC464B_ORDER_RLS_MUST_REMAIN_ENABLED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.orders', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.order_status_history', 'SELECT') THEN
    RAISE EXCEPTION 'RC464B_EXPECTED_AUTHENTICATED_READ_GRANTS_MISSING';
  END IF;

  SELECT count(*) INTO v_orders_total
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'orders'
    AND cmd IN ('SELECT', 'ALL')
    AND permissive = 'PERMISSIVE';

  SELECT count(*) INTO v_orders_expected
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'orders'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE'
    AND policyname IN (
      'orders_member_select',
      'orders_provider_select_own_business',
      'orders_customer_select_own'
    )
    AND roles = ARRAY['authenticated']::name[];

  IF v_orders_total <> 3 OR v_orders_expected <> 3 THEN
    RAISE EXCEPTION 'RC465_POLICY_PREFLIGHT_UNEXPECTED_ORDERS_SELECT_SET: permissive SELECT/ALL total %, expected authenticated SELECT policies %',
      v_orders_total, v_orders_expected;
  END IF;

  SELECT count(*) INTO v_history_total
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'order_status_history'
    AND cmd IN ('SELECT', 'ALL')
    AND permissive = 'PERMISSIVE';

  SELECT count(*) INTO v_history_expected
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'order_status_history'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE'
    AND policyname IN (
      'order_status_history_member_read',
      'order_status_history_customer_select_own'
    )
    AND roles = ARRAY['authenticated']::name[];

  IF v_history_total <> 2 OR v_history_expected <> 2 THEN
    RAISE EXCEPTION 'RC465_POLICY_PREFLIGHT_UNEXPECTED_HISTORY_SELECT_SET: permissive SELECT/ALL total %, expected authenticated SELECT policies %',
      v_history_total, v_history_expected;
  END IF;
END;
$preflight$;

COMMIT;
