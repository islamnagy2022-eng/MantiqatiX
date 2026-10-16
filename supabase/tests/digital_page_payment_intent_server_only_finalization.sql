\set ON_ERROR_STOP on

DO $acl$
BEGIN
  IF has_function_privilege('anon', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute four-argument finalizer';
  END IF;
  IF has_function_privilege('authenticated', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute four-argument finalizer';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute four-argument finalizer';
  END IF;
  IF has_function_privilege('anon', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute five-argument finalizer';
  END IF;
  IF has_function_privilege('authenticated', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute five-argument finalizer';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute five-argument finalizer';
  END IF;
END
$acl$;

INSERT INTO public.digital_page_orders (id, user_id, payment_status, metadata)
VALUES
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'PENDING',
   '{"payment_intent_claim":{"token":"claim-four"}}'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'PENDING',
   '{"payment_intent_claim":{"token":"claim-five"}}');

-- A direct authenticated caller must not be able to persist a caller-chosen provider ID.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $deny_four$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.finalize_digital_page_payment_intent_backend(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'claim-four',
      'attacker-controlled-intent'
    );
  EXCEPTION WHEN OTHERS THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'authenticated four-argument finalization unexpectedly succeeded'; END IF;
END
$deny_four$;
DO $deny_five$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.finalize_digital_page_payment_intent_backend(
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      'claim-five',
      'attacker-controlled-intent',
      'attacker-controlled-order'
    );
  EXCEPTION WHEN OTHERS THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'authenticated five-argument finalization unexpectedly succeeded'; END IF;
END
$deny_five$;
RESET ROLE;

-- The trusted server role may finalize only when the active claim matches the order.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.finalize_digital_page_payment_intent_backend(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'claim-four',
  'paymob-intent-four'
);
SELECT public.finalize_digital_page_payment_intent_backend(
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'claim-five',
  'paymob-intent-five',
  'paymob-order-five'
);
RESET ROLE;

DO $state$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.digital_page_orders
    WHERE id = '10000000-0000-4000-8000-000000000001'
      AND provider = 'PAYMOB' AND provider_intent_id = 'paymob-intent-four'
      AND payment_status = 'PENDING' AND NOT (metadata ? 'payment_intent_claim')
  ) THEN RAISE EXCEPTION 'four-argument trusted finalization did not persist expected state'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.digital_page_orders
    WHERE id = '10000000-0000-4000-8000-000000000002'
      AND provider = 'PAYMOB' AND provider_intent_id = 'paymob-intent-five'
      AND provider_order_id = 'paymob-order-five'
      AND payment_status = 'PENDING' AND NOT (metadata ? 'payment_intent_claim')
  ) THEN RAISE EXCEPTION 'five-argument trusted finalization did not persist expected state'; END IF;
END
$state$;

SELECT 'digital_page_payment_intent_server_only_finalization=PASS' AS result;
