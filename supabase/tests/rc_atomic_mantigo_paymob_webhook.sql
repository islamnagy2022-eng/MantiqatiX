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

-- Ordinary-order failure callbacks use the same atomic event + state transition.
INSERT INTO public.orders
  (id,tenant_id,business_id,status,total_amount,total,currency,pricing_version,pricing_hash,pricing_authority)
VALUES
  ('00000000-0000-0000-0000-000000000020','tenant-1','00000000-0000-0000-0000-000000000120','PENDING',75.00,75.00,'EGP',1,'order-hash-1','SERVER'),
  ('00000000-0000-0000-0000-000000000021','tenant-1','00000000-0000-0000-0000-000000000121','PENDING',90.00,90.00,'EGP',1,'order-hash-2','SERVER'),
  ('00000000-0000-0000-0000-000000000022','tenant-1','00000000-0000-0000-0000-000000000122','PENDING',60.00,60.00,'EGP',1,'order-hash-3','SERVER'),
  ('00000000-0000-0000-0000-000000000023','tenant-1','00000000-0000-0000-0000-000000000123','PENDING',80.00,80.00,'EGP',1,'order-hash-4','SERVER');

INSERT INTO public.payment_intents
  (id,tenant_id,order_id,amount,currency,status,provider,payment_method,pricing_version,pricing_hash)
VALUES
  ('intent-failure','tenant-1','00000000-0000-0000-0000-000000000020',75.00,'EGP','PENDING','PAYMOB','CARD',1,'order-hash-1'),
  ('intent-conflict','tenant-1','00000000-0000-0000-0000-000000000021',90.00,'EGP','PENDING','PAYMOB','CARD',1,'order-hash-2'),
  ('intent-atomic-failure','tenant-1','00000000-0000-0000-0000-000000000022',60.00,'EGP','PENDING','PAYMOB','CARD',1,'order-hash-3'),
  ('intent-unauthorized','tenant-1','00000000-0000-0000-0000-000000000023',80.00,'EGP','PENDING','PAYMOB','CARD',1,'order-hash-4'),
  ('intent-final','tenant-1','00000000-0000-0000-0000-000000000021',90.00,'EGP','SUCCEEDED','PAYMOB','CARD',1,'order-hash-2');

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_payment_failure_backend(
    'event-order-failure','tenant-1','PAYMOB','paymob:order-failure','intent-failure','TRANSACTION',true,75.00,'EGP','{"case":"order-failure"}'::jsonb
  );
  IF result->>'status' <> 'FAILED' OR result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'order failure result incorrect: %', result;
  END IF;
  IF (SELECT status FROM public.payment_intents WHERE id='intent-failure') <> 'FAILED' THEN
    RAISE EXCEPTION 'payment intent did not transition to FAILED';
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE provider='PAYMOB' AND external_event_id='paymob:order-failure') <> 1 THEN
    RAISE EXCEPTION 'order failure event not persisted exactly once';
  END IF;
END;
$test$;

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_payment_failure_backend(
    'event-order-failure-retry','tenant-1','PAYMOB','paymob:order-failure','intent-failure','TRANSACTION',true,75.00,'EGP','{"case":"order-failure-retry"}'::jsonb
  );
  IF result->>'idempotent' <> 'true' OR result->>'status' <> 'FAILED' THEN
    RAISE EXCEPTION 'order failure replay result incorrect: %', result;
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE provider='PAYMOB' AND external_event_id='paymob:order-failure') <> 1 THEN
    RAISE EXCEPTION 'order failure replay created duplicate event';
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_payment_failure_backend(
      'event-order-wrong-amount','tenant-1','PAYMOB','paymob:order-wrong-amount','intent-conflict','TRANSACTION',true,89.00,'EGP','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_PROVIDER_FINANCIAL_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_PROVIDER_FINANCIAL_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'PROVIDER_FINANCIAL_MISMATCH' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:order-wrong-amount') THEN
    RAISE EXCEPTION 'order failure amount mismatch persisted event';
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_payment_failure_backend(
      'event-order-cross-intent','tenant-1','PAYMOB','paymob:order-failure','intent-conflict','TRANSACTION',true,90.00,'EGP','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_EXTERNAL_EVENT_REPLAY_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_EXTERNAL_EVENT_REPLAY_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'EXTERNAL_EVENT_REPLAY_MISMATCH' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.payment_intents WHERE id='intent-conflict') <> 'PENDING' THEN
    RAISE EXCEPTION 'cross-intent event reuse changed other payment intent';
  END IF;
END;
$test$;

CREATE OR REPLACE FUNCTION public.test_fail_payment_intent_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id = 'intent-atomic-failure' THEN RAISE EXCEPTION 'TEST_FORCED_PAYMENT_INTENT_WRITE_FAILURE'; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER test_fail_payment_intent_update
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.test_fail_payment_intent_update();

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_payment_failure_backend(
      'event-order-atomic-failure','tenant-1','PAYMOB','paymob:order-atomic-failure','intent-atomic-failure','TRANSACTION',true,60.00,'EGP','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_PAYMENT_INTENT_WRITE_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_PAYMENT_INTENT_WRITE_FAILURE_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'TEST_FORCED_PAYMENT_INTENT_WRITE_FAILURE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:order-atomic-failure') THEN
    RAISE EXCEPTION 'order failure event was not rolled back after intent update failure';
  END IF;
  IF (SELECT status FROM public.payment_intents WHERE id='intent-atomic-failure') <> 'PENDING' THEN
    RAISE EXCEPTION 'failed intent update changed payment state';
  END IF;
END;
$test$;
DROP TRIGGER test_fail_payment_intent_update ON public.payment_intents;
DROP FUNCTION public.test_fail_payment_intent_update();

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_payment_failure_backend(
    'event-order-already-final','tenant-1','PAYMOB','paymob:order-already-final','intent-final','TRANSACTION',true,90.00,'EGP','{}'::jsonb
  );
  IF result->>'already_final' <> 'true' OR result->>'status' <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'final intent should not be downgraded: %', result;
  END IF;
  IF (SELECT status FROM public.payment_intents WHERE id='intent-final') <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'final payment intent was downgraded';
  END IF;
END;
$test$;

-- Subscription failure callbacks also persist event + status in one transaction.
INSERT INTO public.businesses(id,tenant_id)
VALUES
  ('00000000-0000-0000-0000-000000000130','tenant-1'),
  ('00000000-0000-0000-0000-000000000131','tenant-1'),
  ('00000000-0000-0000-0000-000000000132','tenant-1'),
  ('00000000-0000-0000-0000-000000000133','tenant-1'),
  ('00000000-0000-0000-0000-000000000134','tenant-1');

INSERT INTO public.subscription_payment_intents
  (id,business_id,amount,currency,status,provider)
VALUES
  ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000130',30.00,'EGP','PENDING','PAYMOB'),
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000131',55.00,'EGP','PENDING','PAYMOB'),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000132',60.00,'EGP','PENDING','PAYMOB'),
  ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000133',80.00,'EGP','PENDING','PAYMOB'),
  ('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000134',90.00,'EGP','SUCCEEDED','PAYMOB');

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_failure_backend(
    'event-sub-failure','paymob:sub-failure','00000000-0000-0000-0000-000000000030','sub-tx-failure',30.00,'EGP',true,'{"case":"sub-failure"}'::jsonb
  );
  IF result->>'status' <> 'FAILED' OR result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'subscription failure result incorrect: %', result;
  END IF;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000030') <> 'FAILED' THEN
    RAISE EXCEPTION 'subscription intent did not transition to FAILED';
  END IF;
  IF (SELECT subscription_payment_intent_id <> '00000000-0000-0000-0000-000000000030'::uuid OR payment_intent_id IS NOT NULL
      FROM public.payment_provider_events WHERE external_event_id='paymob:sub-failure') THEN
    RAISE EXCEPTION 'subscription event correlation is incorrect';
  END IF;
END;
$test$;

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_failure_backend(
    'event-sub-failure-retry','paymob:sub-failure','00000000-0000-0000-0000-000000000030','sub-tx-failure',30.00,'EGP',true,'{"case":"sub-failure-retry"}'::jsonb
  );
  IF result->>'idempotent' <> 'true' OR result->>'status' <> 'FAILED' THEN
    RAISE EXCEPTION 'subscription failure replay incorrect: %', result;
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE provider='PAYMOB' AND external_event_id='paymob:sub-failure') <> 1 THEN
    RAISE EXCEPTION 'subscription failure replay created duplicate event';
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_subscription_payment_failure_backend(
      'event-sub-wrong-amount','paymob:sub-wrong-amount','00000000-0000-0000-0000-000000000031','sub-tx-wrong-amount',54.00,'EGP',true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_SUBSCRIPTION_AMOUNT_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_SUBSCRIPTION_AMOUNT_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:sub-wrong-amount') THEN
    RAISE EXCEPTION 'subscription amount mismatch persisted event';
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_subscription_payment_failure_backend(
      'event-sub-cross-intent','paymob:sub-failure','00000000-0000-0000-0000-000000000031','sub-tx-failure',55.00,'EGP',true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_SUBSCRIPTION_EVENT_REPLAY_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_SUBSCRIPTION_EVENT_REPLAY_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'SUBSCRIPTION_EVENT_REPLAY_MISMATCH' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000031') <> 'PENDING' THEN
    RAISE EXCEPTION 'subscription event conflict changed another intent';
  END IF;
END;
$test$;

CREATE OR REPLACE FUNCTION public.test_fail_subscription_intent_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id = '00000000-0000-0000-0000-000000000032'::uuid THEN RAISE EXCEPTION 'TEST_FORCED_SUBSCRIPTION_WRITE_FAILURE'; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER test_fail_subscription_intent_update
BEFORE UPDATE ON public.subscription_payment_intents
FOR EACH ROW EXECUTE FUNCTION public.test_fail_subscription_intent_update();

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_subscription_payment_failure_backend(
      'event-sub-atomic-failure','paymob:sub-atomic-failure','00000000-0000-0000-0000-000000000032','sub-tx-atomic-failure',60.00,'EGP',true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_SUBSCRIPTION_WRITE_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_SUBSCRIPTION_WRITE_FAILURE_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'TEST_FORCED_SUBSCRIPTION_WRITE_FAILURE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:sub-atomic-failure') THEN
    RAISE EXCEPTION 'subscription event was not rolled back after status update failure';
  END IF;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000032') <> 'PENDING' THEN
    RAISE EXCEPTION 'failed subscription update changed payment state';
  END IF;
END;
$test$;
DROP TRIGGER test_fail_subscription_intent_update ON public.subscription_payment_intents;
DROP FUNCTION public.test_fail_subscription_intent_update();

-- A successful subscription event created by the previous success RPC remains final on replay.
INSERT INTO public.payment_provider_events
  (id,tenant_id,provider,event_type,payment_intent_id,subscription_payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
VALUES
  ('legacy-sub-success','tenant-1','PAYMOB','SUBSCRIPTION',NULL,NULL,'paymob:sub-legacy-success','PROCESSED',true,'{}'::jsonb,now());
DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_failure_backend(
    'event-sub-legacy-replay','paymob:sub-legacy-success','00000000-0000-0000-0000-000000000034','sub-tx-legacy',90.00,'EGP',true,'{}'::jsonb
  );
  IF result->>'already_final' <> 'true' OR result->>'status' <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'legacy successful subscription was not preserved: %', result;
  END IF;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000034') <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'legacy successful subscription was downgraded';
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

DO $test$
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    PERFORM public.process_verified_payment_failure_backend(
      'event-order-unauthorized','tenant-1','PAYMOB','paymob:order-unauthorized','intent-unauthorized','TRANSACTION',true,80.00,'EGP','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_FAILURE_RPC_SERVICE_ROLE_DENIAL_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_FAILURE_RPC_SERVICE_ROLE_DENIAL_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM <> 'SERVICE_ROLE_REQUIRED' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:order-unauthorized') THEN
    RAISE EXCEPTION 'unauthorized failure RPC persisted an event';
  END IF;
END;
$test$;

DO $privileges$
BEGIN
  IF has_function_privilege('anon','public.process_verified_payment_failure_backend(text,text,text,text,text,text,boolean,numeric,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute payment failure processor';
  END IF;
  IF has_function_privilege('authenticated','public.process_verified_payment_failure_backend(text,text,text,text,text,text,boolean,numeric,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute payment failure processor';
  END IF;
  IF NOT has_function_privilege('service_role','public.process_verified_payment_failure_backend(text,text,text,text,text,text,boolean,numeric,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute payment failure processor';
  END IF;
END;
$privileges$;

ROLLBACK;
