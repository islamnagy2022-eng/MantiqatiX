-- RC463 behavioral tests; disposable PostgreSQL only.
BEGIN;

INSERT INTO public.subscription_payment_intents
  (id,business_id,amount,currency,status,provider,provider_order_id)
VALUES
  ('10000000-0000-4000-8000-000000004631','20000000-0000-4000-8000-000000004631',100,'EGP','CREATED','PAYMOB','sub-order-unique'),
  ('10000000-0000-4000-8000-000000004632','20000000-0000-4000-8000-000000004632',150,'EGP','CREATED','PAYMOB','shared-order-sub');

INSERT INTO public.digital_page_orders
  (id,user_id,amount,currency,payment_status,provider_order_id,metadata,provider)
VALUES
  ('10000000-0000-4000-8000-000000004633','30000000-0000-4000-8000-000000004633',25,'EGP','PENDING','digital-order-unique','{"payment_intent_claim":true}'::jsonb,'PAYMOB');

INSERT INTO public.mantigo_financial_ledger
  (id,ride_id,customer_id,currency,gross_amount,payment_status,settlement_status,provider,metadata)
VALUES
  ('ledger-rc463','ride-rc463','30000000-0000-4000-8000-000000004634','EGP',75,'REQUIRED','NOT_READY','PAYMOB','{"paymob_intention_order_id":"mantigo-order-unique"}'::jsonb);

INSERT INTO public.payment_intents
  (id,tenant_id,order_id,amount,currency,status,pricing_version,pricing_hash,provider_order_id,provider)
VALUES
  ('10000000-0000-4000-8000-000000004632','tenant-test','40000000-0000-4000-8000-000000004632',150,'EGP','CREATED',1,'hash-shared','shared-order-payment','PAYMOB'),
  ('pi-dup-one','tenant-test','40000000-0000-4000-8000-000000004635',10,'EGP','CREATED',1,'hash-one','duplicate-provider-order','PAYMOB'),
  ('pi-dup-two','tenant-test','40000000-0000-4000-8000-000000004636',10,'EGP','CREATED',1,'hash-two','duplicate-provider-order','PAYMOB'),
  ('pi-unique','tenant-test','40000000-0000-4000-8000-000000004637',20,'EGP','CREATED',1,'hash-unique','payment-order-unique','PAYMOB');

DO $test$
DECLARE
  v jsonb;
  v_rejected boolean;
BEGIN
  IF has_function_privilege('anon','public.resolve_paymob_webhook_target(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute Paymob target lookup';
  END IF;
  IF has_function_privilege('authenticated','public.resolve_paymob_webhook_target(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute Paymob target lookup';
  END IF;
  IF has_function_privilege('service_role','public.resolve_paymob_webhook_target(text,text)','EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role must execute Paymob target lookup';
  END IF;

  v := public.resolve_paymob_webhook_target('MANTIQATIX-SUB-10000000-0000-4000-8000-000000004631','sub-order-unique');
  IF v->>'kind' <> 'subscription' OR v->>'id' <> '10000000-0000-4000-8000-000000004631' THEN
    RAISE EXCEPTION 'subscription alias resolution failed: %',v;
  END IF;

  v := public.resolve_paymob_webhook_target('','digital-order-unique');
  IF v->>'kind' <> 'digital_page' OR v->>'id' <> '10000000-0000-4000-8000-000000004633' THEN
    RAISE EXCEPTION 'digital-page provider-order resolution failed: %',v;
  END IF;

  v := public.resolve_paymob_webhook_target('ledger-rc463','mantigo-order-unique');
  IF v->>'kind' <> 'mantigo' OR v->>'id' <> 'ledger-rc463' THEN
    RAISE EXCEPTION 'MantiGO merchant-reference resolution failed: %',v;
  END IF;

  v := public.resolve_paymob_webhook_target('','payment-order-unique');
  IF v->>'kind' <> 'payment_intent' OR v->>'id' <> 'pi-unique' THEN
    RAISE EXCEPTION 'payment-intent provider-order resolution failed: %',v;
  END IF;

  v := public.resolve_paymob_webhook_target('','not-a-known-provider-order');
  IF v IS NOT NULL THEN RAISE EXCEPTION 'unknown provider order must return NULL, got %',v; END IF;

  -- Same merchant reference across two target tables must never select by dispatch precedence.
  v_rejected := false;
  BEGIN
    PERFORM public.resolve_paymob_webhook_target('10000000-0000-4000-8000-000000004632','shared-order-sub');
    RAISE EXCEPTION 'TEST_FAILED: ambiguous merchant reference unexpectedly resolved';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PAYMENT_TARGET_AMBIGUOUS_MERCHANT_REFERENCE' THEN RAISE; END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'ambiguous merchant reference was not rejected'; END IF;

  -- Provider order IDs are not assumed globally unique across rows or target tables.
  v_rejected := false;
  BEGIN
    PERFORM public.resolve_paymob_webhook_target('','duplicate-provider-order');
    RAISE EXCEPTION 'TEST_FAILED: ambiguous provider order unexpectedly resolved';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PAYMENT_TARGET_AMBIGUOUS_PROVIDER_ORDER' THEN RAISE; END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'ambiguous provider order was not rejected'; END IF;
END
$test$;

ROLLBACK;
