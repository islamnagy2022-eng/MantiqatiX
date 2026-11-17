-- RC470: forward-only restoration of the hardened digital-page Paymob webhook processor.
-- Live preflight on 2026-11-17 found the deployed RC424 body where the hardened RC431
-- contract is already present on main. The old-body fingerprint prevents overwriting an
-- unexpected live implementation; an already-hardened RC431 body is accepted for replay.
BEGIN;

DO $preflight$
DECLARE
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_path_is_legacy boolean;
  v_path_is_hardened boolean;
BEGIN
  SELECT p.* INTO v_proc
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)'
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RC470_PROCESSOR_SIGNATURE_MISSING';
  END IF;

  IF v_proc.prosecdef IS NOT TRUE THEN
    RAISE EXCEPTION 'RC470_PROCESSOR_MUST_REMAIN_SECURITY_DEFINER';
  END IF;

  IF to_regclass('public.digital_page_orders') IS NULL
     OR to_regclass('public.digital_page_payment_events') IS NULL THEN
    RAISE EXCEPTION 'RC470_REQUIRED_PAYMENT_TABLE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.digital_page_orders'::regclass
      AND attname IN ('provider_order_id','provider','payment_status','amount','currency','provider_transaction_id')
      AND NOT attisdropped
    GROUP BY attrelid
    HAVING count(*) = 6
  ) THEN
    RAISE EXCEPTION 'RC470_DIGITAL_PAGE_ORDER_CONTRACT_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.digital_page_payment_events'::regclass
      AND attname IN ('digital_page_order_id','external_event_id','event_type','status','signature_verified','raw_payload')
      AND NOT attisdropped
    GROUP BY attrelid
    HAVING count(*) = 6
  ) THEN
    RAISE EXCEPTION 'RC470_PAYMENT_EVENT_CONTRACT_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attname = 'external_event_id'
    WHERE i.indrelid = 'public.digital_page_payment_events'::regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indnkeyatts = 1
      AND a.attnum = ANY(i.indkey)
  ) THEN
    RAISE EXCEPTION 'RC470_UNIQUE_PROVIDER_EVENT_ID_CONSTRAINT_MISSING';
  END IF;

  IF NOT has_function_privilege(
       'service_role',
       'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'RC470_EXPECTED_SERVICE_ROLE_ONLY_EXECUTE_CONTRACT';
  END IF;

  v_path_is_legacy := coalesce(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public, pg_temp'];
  v_path_is_hardened := coalesce(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""'];

  IF v_path_is_legacy THEN
    -- Exact body fingerprint captured from the live Production function on 2026-11-17.
    -- Fail closed if the deployed RC424 implementation has changed since the audit.
    IF md5(v_proc.prosrc) <> 'a5e65a21d159846e2814c82bb89925ce'
       OR length(v_proc.prosrc) <> 2997 THEN
      RAISE EXCEPTION 'RC470_UNEXPECTED_LEGACY_PROCESSOR_BODY';
    END IF;
  ELSIF v_path_is_hardened THEN
    -- Forward replay has already applied RC431; validate that it is the exact hardened
    -- behavior expected by the application before applying this idempotent repair.
    IF v_proc.prosrc NOT ILIKE '%pg_advisory_xact_lock%'
       OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH%'
       OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH%'
       OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH%'
       OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_PAYMENT_STATE_CHANGED%' THEN
      RAISE EXCEPTION 'RC470_UNEXPECTED_HARDENED_PROCESSOR_BODY';
    END IF;
  ELSE
    RAISE EXCEPTION 'RC470_UNEXPECTED_PROCESSOR_SEARCH_PATH';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.process_verified_digital_page_payment_backend(
  p_order_id uuid,
  p_external_event_id text,
  p_event_type text,
  p_status text,
  p_signature_verified boolean,
  p_amount numeric,
  p_currency text,
  p_provider_transaction_id text,
  p_provider_order_id text,
  p_raw_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order public.digital_page_orders%rowtype;
  v_event public.digital_page_payment_events%rowtype;
  v_next_payment_status text;
  v_next_fulfillment_status text;
BEGIN
  IF coalesce(p_signature_verified, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_SIGNATURE_REQUIRED';
  END IF;
  IF nullif(trim(p_external_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_EVENT_ID_REQUIRED';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('SUCCEEDED', 'FAILED') THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_EVENT_STATUS_INVALID';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0
     OR nullif(trim(p_currency), '') IS NULL
     OR nullif(trim(p_provider_transaction_id), '') IS NULL
     OR nullif(trim(p_provider_order_id), '') IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_AMOUNT_CURRENCY_INVALID';
  END IF;
  IF p_external_event_id IS DISTINCT FROM ('paymob:' || p_provider_transaction_id) THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH';
  END IF;

  -- Serialize callbacks sharing a provider event ID before locking the target order.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_external_event_id, 0));

  SELECT * INTO v_order
  FROM public.digital_page_orders
  WHERE id = p_order_id AND provider = 'PAYMOB'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_ORDER_NOT_FOUND';
  END IF;
  IF v_order.provider_order_id IS NULL
     OR v_order.provider_order_id <> p_provider_order_id THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH';
  END IF;
  IF abs(v_order.amount - p_amount) > 0.01
     OR upper(v_order.currency) <> upper(p_currency) THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH';
  END IF;

  SELECT * INTO v_event
  FROM public.digital_page_payment_events
  WHERE external_event_id = p_external_event_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_event.digital_page_order_id <> v_order.id THEN
      RAISE EXCEPTION 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH';
    END IF;
    IF v_event.status IS DISTINCT FROM p_status THEN
      RAISE EXCEPTION 'DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH';
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  END IF;

  INSERT INTO public.digital_page_payment_events(
    digital_page_order_id, provider, external_event_id, event_type,
    status, signature_verified, raw_payload
  ) VALUES (
    v_order.id, 'PAYMOB', p_external_event_id, p_event_type,
    p_status, true, coalesce(p_raw_payload, '{}'::jsonb)
  );

  IF v_order.payment_status <> 'PENDING' THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent', false, 'already_final', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  END IF;

  v_next_payment_status := CASE WHEN p_status = 'SUCCEEDED' THEN 'PAID' ELSE 'FAILED' END;
  v_next_fulfillment_status := CASE WHEN p_status = 'SUCCEEDED' THEN 'IN_REVIEW' ELSE v_order.fulfillment_status END;

  UPDATE public.digital_page_orders
  SET payment_status = v_next_payment_status,
      fulfillment_status = v_next_fulfillment_status,
      provider_transaction_id = p_provider_transaction_id,
      updated_at = now()
  WHERE id = v_order.id AND payment_status = 'PENDING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_PAYMENT_STATE_CHANGED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'already_final', false,
    'payment_status', v_next_payment_status,
    'fulfillment_status', v_next_fulfillment_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) TO service_role;

DO $postcondition$
DECLARE
  v_proc pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT p.* INTO v_proc
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)'
  );

  IF NOT FOUND
     OR v_proc.prosecdef IS NOT TRUE
     OR NOT (coalesce(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""'])
     OR v_proc.prosrc NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH%'
     OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH%'
     OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH%' THEN
    RAISE EXCEPTION 'RC470_HARDENED_PROCESSOR_POSTCONDITION_FAILED';
  END IF;

  IF NOT has_function_privilege(
       'service_role',
       'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'RC470_PROCESSOR_ACL_POSTCONDITION_FAILED';
  END IF;
END;
$postcondition$;

COMMIT;
