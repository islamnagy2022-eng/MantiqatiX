-- After a rejected RC465 preflight, transaction rollback must preserve legacy policies.
DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='orders'
      AND policyname='orders_member_select' AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'RC465_PREFLIGHT_FAILURE_DROPPED_ORDERS_MEMBER_POLICY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='order_status_history'
      AND policyname='order_status_history_member_read' AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'RC465_PREFLIGHT_FAILURE_DROPPED_HISTORY_MEMBER_POLICY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='orders'
      AND policyname='rc465_unexpected_orders_select'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='order_status_history'
      AND policyname='rc465_unexpected_history_select'
  ) THEN
    RAISE EXCEPTION 'RC465_PREFLIGHT_FAILURE_DID_NOT_ROLL_BACK_POLICY_SET';
  END IF;
END;
$assert$;

SELECT 'RC465_POLICY_DRIFT_FAIL_CLOSED=PASS' AS result;
