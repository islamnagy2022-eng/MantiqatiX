-- Atomic MantiGO Paymob callback regression suite.
-- Run only against the dedicated disposable PostgreSQL fixture.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO public.mantigo_financial_ledger
  (id, ride_id, customer_id, captain_id, currency, gross_amount, payment_status)
VALUES
  ('ledger-success', 'ride-success', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'EGP', 125.00, 'PENDING'),
  ('ledger-conflict', 'ride-conflict', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'EGP', 75.00, 'PENDING'),
  ('ledger-failure', 'ride-failure', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000013', 'EGP', 50.00, 'PENDING'),
  ('ledger-legacy', 'ride-legacy', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000014', 'EGP', 40.00, 'PENDING'),
  ('ledger-atomic-failure', 'ride-atomic-failure', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000015', 'EGP', 60.00, 'PENDING'),
  ('ledger-unauthorized', 'ride-unauthorized', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000016', 'EGP', 80.00, 'PENDING');

-- First successful event updates the ledger and records its event atomically.
DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_mantigo_payment_backend(
    'ledger-success','paymob:tx-success','tx-success',125.00,'EGP',true,true,'{"case":"success"}'::jsonb
  );
  IF result->>'payment_status' <> 'PAID' OR result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'success result incorrect: %', result;
  END IF;
  IF (SELECT payment_status FROM public.mantigo_financial_ledger WHERE id='ledger-success') <> 'PAID' THEN
    RAISE EXCEPTION 'success did not mark ledger PAID';
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE provider='PAYMOB' AND external_event_id='paymob:tx-success') <> 1 THEN
    RAISE EXCEPTION 'success event not persisted exactly once';
  END IF;
  IF (SELECT payment_intent_id IS NOT NULL OR financial_ledger_id <> 'ledger-success'
      FROM public.payment_provider_events WHERE provider='PAYMOB' AND external_event_id='paymob:tx-success') THEN
    RAISE EXCEPTION 'MantiGO event must use financial_ledger_id, not payment_intent_id';
  END IF;
END;
$test$;

-- Exact replay is idempotent and does not duplicate event rows.
DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_mantigo_payment_backend(
    'ledger-success','paymob:tx-success','tx-success',125.00,'EGP',true,true,'{"case":"duplicate"}'::jsonb
  );
  IF result->>'idempotent' <> 'true' OR result->>'payment_status' <> 'PAID' THEN
    RAISE EXCEPTION 'duplicate replay result incorrect: %', result;
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE provider='PAYMOB' AND external_event_id='paymob:tx-success') <> 1 THEN
    RAISE EXCEPTION 'duplicate replay created another event';
  END IF;
END;
$test$;

-- Amount mismatch is rejected before event persistence.
DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_mantigo_payment_backend(
      'ledger-conflict','paymob:tx-wrong-amount','tx-wrong-amount',74.00,'EGP',true,true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_AMOUNT_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_AMOUNT_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'MANTIGO_AMOUNT_CURRENCY_MISMATCH' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:tx-wrong-amount') THEN
    RAISE EXCEPTION 'amount mismatch persisted an event';
  END IF;
END;
$test$;

-- Reusing an event identity for another ledger is a hard conflict.
DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_mantigo_payment_backend(
      'ledger-conflict','paymob:tx-success','tx-success',75.00,'EGP',true,true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_EVENT_CONFLICT_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_EVENT_CONFLICT_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'PAYMOB_EVENT_IDEMPOTENCY_CONFLICT' THEN RAISE; END IF;
  END;
  IF (SELECT payment_status FROM public.mantigo_financial_ledger WHERE id='ledger-conflict') <> 'PENDING' THEN
    RAISE EXCEPTION 'event conflict changed the other ledger';
  END IF;
END;
$test$;

-- The old implementation could leave an event committed when the ledger update failed.
-- Force that failure and assert the function transaction rolls the event insert back.
CREATE OR REPLACE FUNCTION public.test_fail_mantigo_ledger_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id = 'ledger-atomic-failure' THEN RAISE EXCEPTION 'TEST_FORCED_LEDGER_WRITE_FAILURE'; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER test_fail_mantigo_ledger_update
BEFORE UPDATE ON public.mantigo_financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.test_fail_mantigo_ledger_update();

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_mantigo_payment_backend(
      'ledger-atomic-failure','paymob:tx-atomic-failure','tx-atomic-failure',60.00,'EGP',true,true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_FORCED_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_FORCED_FAILURE_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'TEST_FORCED_LEDGER_WRITE_FAILURE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:tx-atomic-failure') THEN
    RAISE EXCEPTION 'event was not rolled back after ledger write failure';
  END IF;
  IF (SELECT payment_status FROM public.mantigo_financial_ledger WHERE id='ledger-atomic-failure') <> 'PENDING' THEN
    RAISE EXCEPTION 'failed ledger update changed payment state';
  END IF;
END;
$test$;
DROP TRIGGER test_fail_mantigo_ledger_update ON public.mantigo_financial_ledger;
DROP FUNCTION public.test_fail_mantigo_ledger_update();

-- Reconcile the known legacy event shape without reprocessing its external event.
INSERT INTO public.payment_intents(id) VALUES ('ledger-legacy');
INSERT INTO public.payment_provider_events
  (id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
VALUES
  ('legacy-event','MNTY-PLATFORM','PAYMOB','MANTIGO_RIDE_PAYMENT','ledger-legacy','paymob:tx-legacy','PAID',true,'{"case":"legacy"}'::jsonb,now());
DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_mantigo_payment_backend(
    'ledger-legacy','paymob:tx-legacy','tx-legacy',40.00,'EGP',true,true,'{"case":"legacy-replay"}'::jsonb
  );
  IF result->>'reconciled' <> 'true' OR result->>'payment_status' <> 'PAID' THEN
    RAISE EXCEPTION 'legacy event did not reconcile safely: %', result;
  END IF;
  IF (SELECT payment_intent_id IS NOT NULL OR financial_ledger_id <> 'ledger-legacy'
      FROM public.payment_provider_events WHERE id='legacy-event') THEN
    RAISE EXCEPTION 'legacy event correlation was not repaired';
  END IF;
  IF (SELECT payment_status FROM public.mantigo_financial_ledger WHERE id='ledger-legacy') <> 'PAID' THEN
    RAISE EXCEPTION 'legacy pending ledger was not reconciled';
  END IF;
END;
$test$;

-- Non-service role is rejected even if it can see the function.
DO $test$
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    PERFORM public.process_verified_mantigo_payment_backend(
      'ledger-unauthorized','paymob:tx-unauthorized','tx-unauthorized',80.00,'EGP',true,true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_SERVICE_ROLE_DENIAL_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_SERVICE_ROLE_DENIAL_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'SERVICE_ROLE_REQUIRED' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:tx-unauthorized') THEN
    RAISE EXCEPTION 'unauthorized call persisted an event';
  END IF;
END;
$test$;

DO $privileges$
BEGIN
  IF has_function_privilege('anon','public.process_verified_mantigo_payment_backend(text,text,text,numeric,text,boolean,boolean,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute payment processor';
  END IF;
  IF has_function_privilege('authenticated','public.process_verified_mantigo_payment_backend(text,text,text,numeric,text,boolean,boolean,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute payment processor';
  END IF;
  IF NOT has_function_privilege('service_role','public.process_verified_mantigo_payment_backend(text,text,text,numeric,text,boolean,boolean,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute payment processor';
  END IF;
END;
$privileges$;

ROLLBACK;
