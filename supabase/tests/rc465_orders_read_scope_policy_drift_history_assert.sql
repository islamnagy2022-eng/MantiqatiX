-- After the second rejected RC465 preflight, only the extra history SELECT policy remains.
DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='orders'
      AND policyname='orders_member_select' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='order_status_history'
      AND policyname='order_status_history_member_read' AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'RC465_HISTORY_PREFLIGHT_FAILURE_DROPPED_LEGACY_POLICY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='orders'
      AND policyname='rc465_unexpected_orders_select'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='order_status_history'
      AND policyname='rc465_unexpected_history_select'
  ) THEN
    RAISE EXCEPTION 'RC465_HISTORY_PREFLIGHT_ROLLBACK_STATE_INCORRECT';
  END IF;
END;
$assert$;

SELECT 'RC465_HISTORY_POLICY_DRIFT_FAIL_CLOSED=PASS' AS result;
