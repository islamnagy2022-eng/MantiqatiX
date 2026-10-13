-- Atomic persistence for verified Paymob failure callbacks on ordinary order payments.
-- Candidate migration only. Do not apply to production without separate approval.
-- The old Edge Function inserted the event and updated payment_intents in separate requests,
-- and ignored the update result. A persisted event could therefore suppress retries while
-- the payment intent remained CREATED/PENDING.

ALTER TABLE public.payment_provider_events
  ADD COLUMN IF NOT EXISTS subscription_payment_intent_id uuid;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'payment_provider_events_subscription_payment_intent_id_fkey'
       AND conrelid = 'public.payment_provider_events'::regclass
  ) THEN
    ALTER TABLE public.payment_provider_events
      ADD CONSTRAINT payment_provider_events_subscription_payment_intent_id_fkey
      FOREIGN KEY (subscription_payment_intent_id)
      REFERENCES public.subscription_payment_intents(id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS idx_payment_provider_events_subscription_payment_intent_id
  ON public.payment_provider_events(subscription_payment_intent_id)
  WHERE subscription_payment_intent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_verified_payment_failure_backend(
  p_event_id text,
  p_tenant_id text,
  p_provider text,
  p_external_event_id text,
  p_payment_intent_id text,
  p_event_type text,
  p_signature_verified boolean,
  p_provider_confirmed_amount numeric,
  p_provider_confirmed_currency text,
  p_raw_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_event public.payment_provider_events%ROWTYPE;
  v_event_id text;
  v_status text;
  v_reconciled boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF p_signature_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'WEBHOOK_SIGNATURE_NOT_VERIFIED';
  END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = ''
     OR p_tenant_id IS NULL OR btrim(p_tenant_id) = ''
     OR p_provider IS NULL OR upper(p_provider) <> 'PAYMOB'
     OR p_external_event_id IS NULL OR p_external_event_id !~ '^paymob:.+'
     OR p_payment_intent_id IS NULL OR btrim(p_payment_intent_id) = ''
     OR p_event_type IS DISTINCT FROM 'TRANSACTION'
     OR p_provider_confirmed_amount IS NULL OR p_provider_confirmed_amount <= 0
     OR p_provider_confirmed_currency IS NULL OR btrim(p_provider_confirmed_currency) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PROVIDER_FAILURE_EVENT';
  END IF;

  SELECT * INTO v_intent
    FROM public.payment_intents
   WHERE id = p_payment_intent_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PAYMENT_INTENT_NOT_FOUND';
  END IF;

  SELECT * INTO v_order
    FROM public.orders
   WHERE id = v_intent.order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ORDER_NOT_FOUND';
  END IF;

  IF v_intent.tenant_id::text <> p_tenant_id
     OR v_order.tenant_id::text <> p_tenant_id
     OR v_intent.provider <> p_provider THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'TENANT_OR_PROVIDER_MISMATCH';
  END IF;
  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL
     OR v_intent.pricing_hash <> v_order.pricing_hash
     OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version
     OR v_order.pricing_authority IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PRICING_BINDING_MISMATCH';
  END IF;
  IF v_order.total IS NULL
     OR v_intent.amount <> v_order.total
     OR v_intent.currency <> v_order.currency
     OR p_provider_confirmed_amount <> v_order.total
     OR upper(p_provider_confirmed_currency) <> upper(v_order.currency) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PROVIDER_FINANCIAL_MISMATCH';
  END IF;

  INSERT INTO public.payment_provider_events (
    id, tenant_id, provider, event_type, payment_intent_id, external_event_id,
    status, signature_verified, raw_payload, processed_at
  )
  VALUES (
    p_event_id, p_tenant_id, p_provider, p_event_type, p_payment_intent_id,
    p_external_event_id,
    CASE WHEN v_intent.status IN ('CREATED', 'PENDING') THEN 'FAILED' ELSE 'IGNORED_FINAL' END,
    true, coalesce(p_raw_payload, '{}'::jsonb), now()
  )
  ON CONFLICT (provider, external_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT * INTO v_event
      FROM public.payment_provider_events
     WHERE provider = p_provider
       AND external_event_id = p_external_event_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PAYMENT_EVENT_RETRY_REQUIRED';
    END IF;
    IF v_event.payment_intent_id::text IS DISTINCT FROM p_payment_intent_id
       OR v_event.event_type <> p_event_type
       OR v_event.signature_verified IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'EXTERNAL_EVENT_REPLAY_MISMATCH';
    END IF;

    IF v_event.status = 'FAILED' AND v_intent.status IN ('CREATED', 'PENDING') THEN
      UPDATE public.payment_intents
         SET status = 'FAILED', updated_at = now()
       WHERE id = v_intent.id
         AND status IN ('CREATED', 'PENDING')
      RETURNING status INTO v_status;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PAYMENT_FAILURE_RECONCILIATION_RETRY_REQUIRED';
      END IF;
      v_reconciled := true;
    ELSIF v_event.status = 'FAILED' AND v_intent.status = 'FAILED' THEN
      v_status := v_intent.status;
    ELSIF v_event.status = 'IGNORED_FINAL' AND v_intent.status NOT IN ('CREATED', 'PENDING') THEN
      v_status := v_intent.status;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYMENT_EVENT_STATE_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'ok', true, 'idempotent', true, 'reconciled', v_reconciled,
      'status', v_status, 'payment_intent_id', v_intent.id
    );
  END IF;

  IF v_intent.status NOT IN ('CREATED', 'PENDING') THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', false, 'already_final', true,
      'status', v_intent.status, 'payment_intent_id', v_intent.id
    );
  END IF;

  UPDATE public.payment_intents
     SET status = 'FAILED', updated_at = now()
   WHERE id = v_intent.id
     AND status IN ('CREATED', 'PENDING')
  RETURNING status INTO v_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PAYMENT_FAILURE_STATE_CHANGED_RETRY_REQUIRED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'already_final', false,
    'status', v_status, 'payment_intent_id', v_intent.id, 'event_id', v_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_verified_payment_failure_backend(text, text, text, text, text, text, boolean, numeric, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_payment_failure_backend(text, text, text, text, text, text, boolean, numeric, text, jsonb)
  TO service_role;


CREATE OR REPLACE FUNCTION public.process_verified_subscription_payment_failure_backend(
  p_event_id text,
  p_external_event_id text,
  p_subscription_payment_intent_id uuid,
  p_provider_transaction_id text,
  p_provider_confirmed_amount numeric,
  p_provider_confirmed_currency text,
  p_signature_verified boolean,
  p_raw_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub public.subscription_payment_intents%ROWTYPE;
  v_event public.payment_provider_events%ROWTYPE;
  v_tenant_id text;
  v_event_id text;
  v_status text;
  v_reconciled boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF p_signature_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SUBSCRIPTION_PROVIDER_SIGNATURE_REQUIRED';
  END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = ''
     OR p_external_event_id IS NULL OR p_external_event_id !~ '^paymob:.+'
     OR p_subscription_payment_intent_id IS NULL
     OR p_provider_transaction_id IS NULL OR btrim(p_provider_transaction_id) = ''
     OR p_provider_confirmed_amount IS NULL OR p_provider_confirmed_amount <= 0
     OR p_provider_confirmed_currency IS NULL OR btrim(p_provider_confirmed_currency) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SUBSCRIPTION_FAILURE_EVENT';
  END IF;

  SELECT * INTO v_sub
    FROM public.subscription_payment_intents
   WHERE id = p_subscription_payment_intent_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND';
  END IF;
  IF v_sub.provider <> 'PAYMOB'
     OR abs(v_sub.amount - p_provider_confirmed_amount) > 0.01
     OR upper(v_sub.currency) <> upper(p_provider_confirmed_currency) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH';
  END IF;

  SELECT b.tenant_id::text INTO v_tenant_id
    FROM public.businesses b
   WHERE b.id = v_sub.business_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'SUBSCRIPTION_BUSINESS_NOT_FOUND';
  END IF;

  INSERT INTO public.payment_provider_events (
    id, tenant_id, provider, event_type, payment_intent_id,
    subscription_payment_intent_id, external_event_id, status,
    signature_verified, raw_payload, processed_at
  )
  VALUES (
    p_event_id, v_tenant_id, 'PAYMOB', 'SUBSCRIPTION', NULL,
    v_sub.id, p_external_event_id,
    CASE WHEN v_sub.status = 'PENDING' THEN 'FAILED' ELSE 'IGNORED_FINAL' END,
    true, coalesce(p_raw_payload, '{}'::jsonb), now()
  )
  ON CONFLICT (provider, external_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT * INTO v_event
      FROM public.payment_provider_events
     WHERE provider = 'PAYMOB'
       AND external_event_id = p_external_event_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'SUBSCRIPTION_EVENT_RETRY_REQUIRED';
    END IF;

    -- Successful subscription callbacks from the pre-migration RPC have no explicit
    -- subscription FK. Accept only a verified PROCESSED event when the intent is final.
    IF v_event.subscription_payment_intent_id IS NULL
       AND v_event.event_type = 'SUBSCRIPTION'
       AND v_event.status = 'PROCESSED'
       AND v_event.signature_verified IS TRUE
       AND v_sub.status IN ('SUCCEEDED', 'PAID_PENDING_LEGAL') THEN
      RETURN jsonb_build_object(
        'ok', true, 'idempotent', true, 'already_final', true,
        'status', v_sub.status, 'subscription_payment_intent_id', v_sub.id
      );
    END IF;

    IF v_event.subscription_payment_intent_id IS DISTINCT FROM v_sub.id
       OR v_event.event_type <> 'SUBSCRIPTION'
       OR v_event.signature_verified IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'SUBSCRIPTION_EVENT_REPLAY_MISMATCH';
    END IF;

    IF v_event.status = 'FAILED' AND v_sub.status = 'PENDING' THEN
      UPDATE public.subscription_payment_intents
         SET status = 'FAILED',
             provider_transaction_id = p_provider_transaction_id,
             updated_at = now()
       WHERE id = v_sub.id
         AND status = 'PENDING'
      RETURNING status INTO v_status;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'SUBSCRIPTION_FAILURE_RECONCILIATION_RETRY_REQUIRED';
      END IF;
      v_reconciled := true;
    ELSIF v_event.status = 'FAILED' AND v_sub.status = 'FAILED' THEN
      v_status := v_sub.status;
    ELSIF v_event.status = 'IGNORED_FINAL' AND v_sub.status <> 'PENDING' THEN
      v_status := v_sub.status;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SUBSCRIPTION_EVENT_STATE_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'ok', true, 'idempotent', true, 'reconciled', v_reconciled,
      'status', v_status, 'subscription_payment_intent_id', v_sub.id
    );
  END IF;

  IF v_sub.status <> 'PENDING' THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', false, 'already_final', true,
      'status', v_sub.status, 'subscription_payment_intent_id', v_sub.id
    );
  END IF;

  UPDATE public.subscription_payment_intents
     SET status = 'FAILED',
         provider_transaction_id = p_provider_transaction_id,
         updated_at = now()
   WHERE id = v_sub.id
     AND status = 'PENDING'
  RETURNING status INTO v_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'SUBSCRIPTION_FAILURE_STATE_CHANGED_RETRY_REQUIRED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'already_final', false,
    'status', v_status, 'subscription_payment_intent_id', v_sub.id, 'event_id', v_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_verified_subscription_payment_failure_backend(text, text, uuid, text, numeric, text, boolean, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_subscription_payment_failure_backend(text, text, uuid, text, numeric, text, boolean, jsonb)
  TO service_role;
