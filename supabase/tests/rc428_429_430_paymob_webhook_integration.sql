-- Focused behavioral tests for the candidate RC428/RC429/RC430 Paymob RPCs.
-- Run only in the dedicated disposable PostgreSQL harness.
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);

INSERT INTO public.businesses(id,tenant_id) VALUES
 ('00000000-0000-0000-0000-000000000130','tenant-1'),
 ('00000000-0000-0000-0000-000000000131','tenant-1'),
 ('00000000-0000-0000-0000-000000000132','tenant-1'),
 ('00000000-0000-0000-0000-000000000133','tenant-1'),
 ('00000000-0000-0000-0000-000000000134','tenant-1'),
 ('00000000-0000-0000-0000-000000000135','tenant-1');

INSERT INTO public.orders(id,tenant_id,status,total,currency,pricing_version,pricing_hash,pricing_authority) VALUES
 ('00000000-0000-0000-0000-000000000020','tenant-1','PENDING',75.00,'EGP',1,'hash-1','SERVER'),
 ('00000000-0000-0000-0000-000000000021','tenant-1','PENDING',90.00,'EGP',1,'hash-2','SERVER'),
 ('00000000-0000-0000-0000-000000000022','tenant-1','PENDING',60.00,'EGP',1,'hash-3','SERVER'),
 ('00000000-0000-0000-0000-000000000023','tenant-1','PENDING',80.00,'EGP',1,'hash-4','SERVER');

INSERT INTO public.payment_intents(id,tenant_id,order_id,amount,currency,status,provider,provider_order_id,pricing_version,pricing_hash) VALUES
 ('00000000-0000-0000-0000-000000000001','tenant-1','00000000-0000-0000-0000-000000000020',75.00,'EGP','PENDING','PAYMOB','9001',1,'hash-1'),
 ('00000000-0000-0000-0000-000000000002','tenant-1','00000000-0000-0000-0000-000000000021',90.00,'EGP','PENDING','PAYMOB','9002',1,'hash-2'),
 ('00000000-0000-0000-0000-000000000003','tenant-1','00000000-0000-0000-0000-000000000022',60.00,'EGP','PENDING','PAYMOB','9003',1,'hash-3'),
 ('00000000-0000-0000-0000-000000000004','tenant-1','00000000-0000-0000-0000-000000000023',80.00,'EGP','SUCCEEDED','PAYMOB','9004',1,'hash-4');

-- RC428: normal order failure is atomic, idempotent, amount-bound, and replay-bound.
DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_provider_payment_failure(
    'event-order-failure','tenant-1','PAYMOB','paymob:TX-ORDER-FAIL',
    '00000000-0000-0000-0000-000000000001','TRANSACTION',true,75.00,'EGP','TX-ORDER-FAIL','9001','{"case":"order-failure"}'::jsonb
  );
  IF result->>'status' <> 'FAILED' OR result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'RC428 first failure result incorrect: %',result;
  END IF;
  IF (SELECT status FROM public.payment_intents WHERE id='00000000-0000-0000-0000-000000000001') <> 'FAILED' THEN
    RAISE EXCEPTION 'RC428 did not fail payment intent';
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE external_event_id='paymob:TX-ORDER-FAIL') <> 1 THEN
    RAISE EXCEPTION 'RC428 event was not recorded exactly once';
  END IF;
END;
$test$;

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_provider_payment_failure(
    'event-order-failure-retry','tenant-1','PAYMOB','paymob:TX-ORDER-FAIL',
    '00000000-0000-0000-0000-000000000001','TRANSACTION',true,75.00,'EGP','TX-ORDER-FAIL','9001','{}'::jsonb
  );
  IF result->>'idempotent' <> 'true' OR result->>'status' <> 'FAILED' THEN
    RAISE EXCEPTION 'RC428 duplicate replay incorrect: %',result;
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_provider_payment_failure(
      'event-order-wrong-amount','tenant-1','PAYMOB','paymob:TX-ORDER-WRONG',
      '00000000-0000-0000-0000-000000000002','TRANSACTION',true,89.00,'EGP','TX-ORDER-WRONG','9002','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_RC428_AMOUNT_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='EXPECTED_RC428_AMOUNT_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%PROVIDER_FINANCIAL_MISMATCH%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:TX-ORDER-WRONG') THEN
    RAISE EXCEPTION 'RC428 persisted an amount-mismatched event';
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_provider_payment_failure(
      'event-order-cross-intent','tenant-1','PAYMOB','paymob:TX-ORDER-FAIL',
      '00000000-0000-0000-0000-000000000002','TRANSACTION',true,90.00,'EGP','TX-ORDER-FAIL','9002','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_RC428_EVENT_REPLAY_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='EXPECTED_RC428_EVENT_REPLAY_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%EXTERNAL_EVENT_REPLAY_MISMATCH%' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.payment_intents WHERE id='00000000-0000-0000-0000-000000000002') <> 'PENDING' THEN
    RAISE EXCEPTION 'RC428 cross-intent conflict changed another intent';
  END IF;
END;
$test$;

CREATE OR REPLACE FUNCTION public.test_fail_order_intent_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id='00000000-0000-0000-0000-000000000003'::uuid THEN RAISE EXCEPTION 'TEST_RC428_WRITE_FAILURE'; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER test_fail_order_intent_update BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.test_fail_order_intent_update();

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_provider_payment_failure(
      'event-order-rollback','tenant-1','PAYMOB','paymob:TX-ORDER-ROLLBACK',
      '00000000-0000-0000-0000-000000000003','TRANSACTION',true,60.00,'EGP','TX-ORDER-ROLLBACK','9003','{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_RC428_WRITE_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='EXPECTED_RC428_WRITE_FAILURE_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%TEST_RC428_WRITE_FAILURE%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:TX-ORDER-ROLLBACK') THEN
    RAISE EXCEPTION 'RC428 event was not rolled back with failed intent update';
  END IF;
  IF (SELECT status FROM public.payment_intents WHERE id='00000000-0000-0000-0000-000000000003') <> 'PENDING' THEN
    RAISE EXCEPTION 'RC428 failed write changed intent status';
  END IF;
END;
$test$;
DROP TRIGGER test_fail_order_intent_update ON public.payment_intents;
DROP FUNCTION public.test_fail_order_intent_update();

DO $test$
BEGIN
  PERFORM public.process_verified_provider_payment_failure(
    'event-order-final','tenant-1','PAYMOB','paymob:TX-ORDER-FINAL',
    '00000000-0000-0000-0000-000000000004','TRANSACTION',true,80.00,'EGP','TX-ORDER-FINAL','9004','{}'::jsonb
  );
  IF (SELECT status FROM public.payment_intents WHERE id='00000000-0000-0000-0000-000000000004') <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'RC428 downgraded a successful payment intent';
  END IF;
END;
$test$;

-- RC429: subscription failure is correlated, replay-safe, and atomic.
INSERT INTO public.subscription_payment_intents
  (id,business_id,amount,currency,status,provider,provider_order_id)
VALUES
 ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000130',30.00,'EGP','PENDING','PAYMOB','sub-order-1'),
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000131',55.00,'EGP','PENDING','PAYMOB','sub-order-2'),
 ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000132',60.00,'EGP','PENDING','PAYMOB','sub-order-3'),
 ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000133',90.00,'EGP','SUCCEEDED','PAYMOB','sub-order-4');

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_failure(
    'event-sub-failure','paymob:TX-SUB-FAIL','00000000-0000-0000-0000-000000000030',
    'TX-SUB-FAIL',30.00,'EGP','sub-order-1',true,'{"case":"sub-failure"}'::jsonb
  );
  IF result->>'status' <> 'FAILED' OR result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'RC429 first failure result incorrect: %',result;
  END IF;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000030') <> 'FAILED' THEN
    RAISE EXCEPTION 'RC429 did not fail subscription intent';
  END IF;
  IF (SELECT count(*) FROM public.payment_provider_events WHERE external_event_id='paymob:TX-SUB-FAIL') <> 1 THEN
    RAISE EXCEPTION 'RC429 event not recorded exactly once';
  END IF;
END;
$test$;

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_failure(
    'event-sub-failure-retry','paymob:TX-SUB-FAIL','00000000-0000-0000-0000-000000000030',
    'TX-SUB-FAIL',30.00,'EGP','sub-order-1',true,'{"case":"retry"}'::jsonb
  );
  IF result->>'idempotent' <> 'true' OR result->>'status' <> 'FAILED' THEN
    RAISE EXCEPTION 'RC429 duplicate replay incorrect: %',result;
  END IF;
END;
$test$;

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_subscription_payment_failure(
      'event-sub-cross-intent','paymob:TX-SUB-FAIL','00000000-0000-0000-0000-000000000031',
      'TX-SUB-FAIL',55.00,'EGP','sub-order-2',true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_RC429_EVENT_REPLAY_MISMATCH_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='EXPECTED_RC429_EVENT_REPLAY_MISMATCH_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH%' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000031') <> 'PENDING' THEN
    RAISE EXCEPTION 'RC429 cross-intent conflict changed another intent';
  END IF;
END;
$test$;

CREATE OR REPLACE FUNCTION public.test_fail_subscription_update()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.id='00000000-0000-0000-0000-000000000032'::uuid THEN RAISE EXCEPTION 'TEST_RC429_WRITE_FAILURE'; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER test_fail_subscription_update BEFORE UPDATE ON public.subscription_payment_intents
FOR EACH ROW EXECUTE FUNCTION public.test_fail_subscription_update();

DO $test$
BEGIN
  BEGIN
    PERFORM public.process_verified_subscription_payment_failure(
      'event-sub-rollback','paymob:TX-SUB-ROLLBACK','00000000-0000-0000-0000-000000000032',
      'TX-SUB-ROLLBACK',60.00,'EGP','sub-order-3',true,'{}'::jsonb
    );
    RAISE EXCEPTION 'EXPECTED_RC429_WRITE_FAILURE_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='EXPECTED_RC429_WRITE_FAILURE_NOT_RAISED' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%TEST_RC429_WRITE_FAILURE%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.payment_provider_events WHERE external_event_id='paymob:TX-SUB-ROLLBACK') THEN
    RAISE EXCEPTION 'RC429 event was not rolled back with failed subscription update';
  END IF;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000032') <> 'PENDING' THEN
    RAISE EXCEPTION 'RC429 failed write changed subscription status';
  END IF;
END;
$test$;
DROP TRIGGER test_fail_subscription_update ON public.subscription_payment_intents;
DROP FUNCTION public.test_fail_subscription_update();

-- RC430: success is bound to the subscription intent/order and replay does not duplicate activation.
INSERT INTO public.subscription_payment_intents
  (id,business_id,amount,currency,status,provider,provider_order_id,tier_code,billing_cycle,sector,created_by)
VALUES
 ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000134',120.00,'EGP','PENDING','PAYMOB','sub-order-success','PRO','MONTHLY','FOOD','00000000-0000-0000-0000-000000000001');

INSERT INTO public.user_memberships(business_id,user_id,status,role)
VALUES ('00000000-0000-0000-0000-000000000134','00000000-0000-0000-0000-000000000001','ACTIVE','OWNER');

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_backend(
    'event-sub-success','paymob:TX-SUB-SUCCESS','00000000-0000-0000-0000-000000000040',
    'TX-SUB-SUCCESS',120.00,'EGP','sub-order-success',true,'{"case":"sub-success"}'::jsonb
  );
  IF result->>'ok' <> 'true' OR result->>'status' <> 'ACTIVE' THEN
    RAISE EXCEPTION 'RC430 subscription success incorrect: %',result;
  END IF;
  IF (SELECT status FROM public.subscription_payment_intents WHERE id='00000000-0000-0000-0000-000000000040') <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'RC430 did not mark payment intent SUCCEEDED';
  END IF;
  IF (SELECT count(*) FROM public.business_subscriptions WHERE business_id='00000000-0000-0000-0000-000000000134' AND status='ACTIVE') <> 1 THEN
    RAISE EXCEPTION 'RC430 did not create exactly one active subscription';
  END IF;
END;
$test$;

DO $test$
DECLARE result jsonb;
BEGIN
  result := public.process_verified_subscription_payment_backend(
    'event-sub-success-retry','paymob:TX-SUB-SUCCESS','00000000-0000-0000-0000-000000000040',
    'TX-SUB-SUCCESS',120.00,'EGP','sub-order-success',true,'{"case":"sub-success-retry"}'::jsonb
  );
  IF result->>'idempotent' <> 'true' OR result->>'status' <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'RC430 duplicate replay incorrect: %',result;
  END IF;
  IF (SELECT count(*) FROM public.business_subscriptions WHERE business_id='00000000-0000-0000-0000-000000000134' AND status='ACTIVE') <> 1 THEN
    RAISE EXCEPTION 'RC430 duplicate replay created another active subscription';
  END IF;
END;
$test$;

DO $privileges$
BEGIN
  IF has_function_privilege('anon','public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RC428 failure RPC grants are incorrect';
  END IF;
  IF has_function_privilege('anon','public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RC429 failure RPC grants are incorrect';
  END IF;
  IF has_function_privilege('anon','public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RC430 success RPC grants are incorrect';
  END IF;
END;
$privileges$;

SELECT 'RC428/RC429/RC430 Paymob callback integration: PASS' AS result;
ROLLBACK;
