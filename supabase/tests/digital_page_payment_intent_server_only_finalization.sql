\set ON_ERROR_STOP on

DO $acl$
BEGIN
  IF has_function_privilege('anon', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute four-argument finalizer';
  END IF;
  IF has_function_privilege('authenticated', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute four-argument finalizer';
  END IF;
  IF has_function_privilege('service_role', 'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role can execute legacy four-argument finalizer';
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

-- The privileged finalizer still enforces user binding and the active claim token.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $reject_invalid_claims$
BEGIN
  IF public.finalize_digital_page_payment_intent_backend(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'stale-token',
    'must-not-bind',
    'provider-order-stale'
  ) THEN RAISE EXCEPTION 'stale claim token was accepted'; END IF;
  IF public.finalize_digital_page_payment_intent_backend(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000099',
    'claim-four',
    'wrong-user-intent',
    'provider-order-wrong-user'
  ) THEN RAISE EXCEPTION 'wrong user was accepted'; END IF;
END
$reject_invalid_claims$;
RESET ROLE;
DO $invalid_state$
BEGIN
  IF EXISTS (SELECT 1 FROM public.digital_page_orders
    WHERE id='10000000-0000-4000-8000-000000000001' AND provider_intent_id IS NOT NULL)
  THEN RAISE EXCEPTION 'rejected claim mutated order'; END IF;
END
$invalid_state$;

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT public.finalize_digital_page_payment_intent_backend(
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'claim-four',
  'paymob-intent-four',
  'paymob-order-four'
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
      AND provider_order_id = 'paymob-order-four'
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

-- Same provider identifiers are idempotent; conflicting replay must fail closed.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $retry_contract$
BEGIN
  IF NOT public.finalize_digital_page_payment_intent_backend(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'retry-token-no-longer-needed',
    'paymob-intent-four',
    'paymob-order-four'
  ) THEN RAISE EXCEPTION 'same five-argument intent/order retry was not idempotent'; END IF;
  IF public.finalize_digital_page_payment_intent_backend(
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'retry-token-no-longer-needed',
    'conflicting-intent',
    'paymob-order-four'
  ) THEN RAISE EXCEPTION 'conflicting intent replay was accepted'; END IF;
  IF NOT public.finalize_digital_page_payment_intent_backend(
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'retry-token-no-longer-needed',
    'paymob-intent-five',
    'paymob-order-five'
  ) THEN RAISE EXCEPTION 'same five-argument intent/order retry was not idempotent'; END IF;
  IF public.finalize_digital_page_payment_intent_backend(
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'retry-token-no-longer-needed',
    'paymob-intent-five',
    'conflicting-provider-order'
  ) THEN RAISE EXCEPTION 'conflicting provider order replay was accepted'; END IF;
END
$retry_contract$;
RESET ROLE;

SELECT 'digital_page_payment_intent_server_only_finalization=PASS' AS result;
