-- Atomic Paymob processing for MantiGO financial-ledger callbacks.
-- Candidate migration only. Do not apply to production without separate approval.
-- The old Edge Function inserted payment_provider_events and updated the ledger in
-- separate requests, which could leave an event recorded while the ledger stayed PENDING.
-- It also wrote a ledger id into payment_intent_id, whose FK targets payment_intents.

ALTER TABLE public.payment_provider_events
  ADD COLUMN IF NOT EXISTS financial_ledger_id text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_provider_events_financial_ledger_id_fkey'
      AND conrelid = 'public.payment_provider_events'::regclass
  ) THEN
    ALTER TABLE public.payment_provider_events
      ADD CONSTRAINT payment_provider_events_financial_ledger_id_fkey
      FOREIGN KEY (financial_ledger_id)
      REFERENCES public.mantigo_financial_ledger(id)
      ON DELETE RESTRICT;
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS idx_payment_provider_events_financial_ledger_id
  ON public.payment_provider_events(financial_ledger_id)
  WHERE financial_ledger_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_verified_mantigo_payment_backend(
  p_ledger_id text,
  p_external_event_id text,
  p_provider_transaction_id text,
  p_amount numeric,
  p_currency text,
  p_success boolean,
  p_signature_verified boolean,
  p_raw_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ledger public.mantigo_financial_ledger%ROWTYPE;
  v_event public.payment_provider_events%ROWTYPE;
  v_event_id text;
  v_next_status text;
  v_event_status text;
  v_current_status text;
  v_reconciled boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_signature_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PROVIDER_SIGNATURE_NOT_VERIFIED';
  END IF;
  IF p_ledger_id IS NULL OR btrim(p_ledger_id) = ''
     OR p_external_event_id IS NULL OR p_external_event_id !~ '^paymob:.+'
     OR p_provider_transaction_id IS NULL OR btrim(p_provider_transaction_id) = ''
     OR p_amount IS NULL OR p_amount <= 0
     OR p_currency IS NULL OR btrim(p_currency) = ''
     OR p_success IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_MANTIGO_PROVIDER_EVENT';
  END IF;

  SELECT *
    INTO v_ledger
    FROM public.mantigo_financial_ledger
   WHERE id = p_ledger_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MANTIGO_LEDGER_NOT_FOUND';
  END IF;
  IF abs(v_ledger.gross_amount - p_amount) > 0.01
     OR upper(v_ledger.currency) <> upper(p_currency) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MANTIGO_AMOUNT_CURRENCY_MISMATCH';
  END IF;

  v_next_status := CASE WHEN p_success THEN 'PAID' ELSE 'FAILED' END;

  INSERT INTO public.payment_provider_events (
    id, tenant_id, provider, event_type, payment_intent_id, financial_ledger_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  )
  VALUES (
    gen_random_uuid()::text, 'MNTY-PLATFORM', 'PAYMOB', 'MANTIGO_RIDE_PAYMENT',
    NULL, v_ledger.id, p_external_event_id,
    CASE WHEN v_ledger.payment_status = 'PENDING' THEN v_next_status ELSE 'IGNORED_FINAL' END,
    true, coalesce(p_raw_payload, '{}'::jsonb), now()
  )
  ON CONFLICT (provider, external_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT *
      INTO v_event
      FROM public.payment_provider_events
     WHERE provider = 'PAYMOB'
       AND external_event_id = p_external_event_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MANTIGO_EVENT_RETRY_REQUIRED';
    END IF;

    -- Repair only the known legacy shape: a verified MantiGO event whose ledger id
    -- was incorrectly stored in payment_intent_id by the old Edge Function.
    IF v_event.financial_ledger_id IS NULL
       AND v_event.event_type = 'MANTIGO_RIDE_PAYMENT'
       AND v_event.payment_intent_id = v_ledger.id
       AND v_event.signature_verified IS TRUE
       AND v_event.status IN ('PAID', 'FAILED') THEN
      UPDATE public.payment_provider_events
         SET financial_ledger_id = v_ledger.id,
             payment_intent_id = NULL
       WHERE id = v_event.id;

      IF v_ledger.payment_status = 'PENDING' THEN
        UPDATE public.mantigo_financial_ledger
           SET payment_status = v_event.status,
               payment_reference = p_external_event_id,
               provider_transaction_id = p_provider_transaction_id,
               payment_confirmed_at = CASE WHEN v_event.status = 'PAID' THEN coalesce(v_ledger.payment_confirmed_at, now()) ELSE NULL END,
               updated_at = now()
         WHERE id = v_ledger.id
           AND payment_status = 'PENDING'
        RETURNING payment_status INTO v_current_status;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MANTIGO_LEDGER_RECONCILIATION_RETRY_REQUIRED';
        END IF;
        v_reconciled := true;
      ELSIF v_ledger.payment_status <> v_event.status THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MANTIGO_EVENT_LEDGER_STATE_CONFLICT';
      ELSE
        v_current_status := v_ledger.payment_status;
      END IF;

      RETURN jsonb_build_object(
        'ok', true, 'idempotent', true, 'reconciled', v_reconciled,
        'payment_status', v_current_status, 'ledger_id', v_ledger.id
      );
    END IF;

    IF v_event.financial_ledger_id IS DISTINCT FROM v_ledger.id
       OR v_event.event_type <> 'MANTIGO_RIDE_PAYMENT'
       OR v_event.payment_intent_id IS NOT NULL
       OR v_event.signature_verified IS NOT TRUE
       OR v_event.status NOT IN ('PAID', 'FAILED', 'IGNORED_FINAL') THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PAYMOB_EVENT_IDEMPOTENCY_CONFLICT';
    END IF;

    IF v_event.status IN ('PAID', 'FAILED') AND v_ledger.payment_status = 'PENDING' THEN
      UPDATE public.mantigo_financial_ledger
         SET payment_status = v_event.status,
             payment_reference = p_external_event_id,
             provider_transaction_id = p_provider_transaction_id,
             payment_confirmed_at = CASE WHEN v_event.status = 'PAID' THEN coalesce(v_ledger.payment_confirmed_at, now()) ELSE NULL END,
             updated_at = now()
       WHERE id = v_ledger.id
         AND payment_status = 'PENDING'
      RETURNING payment_status INTO v_current_status;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MANTIGO_LEDGER_RECONCILIATION_RETRY_REQUIRED';
      END IF;
      v_reconciled := true;
    ELSE
      v_current_status := v_ledger.payment_status;
      IF v_event.status IN ('PAID', 'FAILED') AND v_current_status <> v_event.status THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MANTIGO_EVENT_LEDGER_STATE_CONFLICT';
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'ok', true, 'idempotent', true, 'reconciled', v_reconciled,
      'payment_status', v_current_status, 'ledger_id', v_ledger.id
    );
  END IF;

  IF v_ledger.payment_status <> 'PENDING' THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', false, 'already_final', true,
      'payment_status', v_ledger.payment_status, 'ledger_id', v_ledger.id
    );
  END IF;

  UPDATE public.mantigo_financial_ledger
     SET payment_status = v_next_status,
         payment_reference = p_external_event_id,
         provider_transaction_id = p_provider_transaction_id,
         payment_confirmed_at = CASE WHEN p_success THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = v_ledger.id
     AND payment_status = 'PENDING'
  RETURNING payment_status INTO v_current_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MANTIGO_LEDGER_STATE_CHANGED_RETRY_REQUIRED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'already_final', false,
    'payment_status', v_current_status, 'ledger_id', v_ledger.id, 'event_id', v_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_verified_mantigo_payment_backend(text, text, text, numeric, text, boolean, boolean, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_mantigo_payment_backend(text, text, text, numeric, text, boolean, boolean, jsonb)
  TO service_role;
