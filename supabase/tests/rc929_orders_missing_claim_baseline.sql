-- Demonstrate the missing-claim gap before RC929, after the RC465 scope repair.
-- Disposable PostgreSQL only. The valid member identity and exact branch scope
-- intentionally make the legacy COALESCE predicates evaluate to TRUE.

SET ROLE authenticated;

DO $baseline$
DECLARE
  v_orders uuid[];
  v_history text[];
BEGIN
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',false);

  SELECT array_agg(id ORDER BY id) INTO v_orders
  FROM public.orders;

  IF v_orders IS DISTINCT FROM ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000004'
  ]::uuid[] THEN
    RAISE EXCEPTION 'RC929_BASELINE_EXPECTED_MISSING_CLAIM_ORDER_VISIBILITY: %', v_orders;
  END IF;

  SELECT array_agg(id ORDER BY id) INTO v_history
  FROM public.order_status_history;

  IF v_history IS DISTINCT FROM ARRAY[
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004'
  ]::text[] THEN
    RAISE EXCEPTION 'RC929_BASELINE_EXPECTED_MISSING_CLAIM_HISTORY_VISIBILITY: %', v_history;
  END IF;
END;
$baseline$;

RESET ROLE;
