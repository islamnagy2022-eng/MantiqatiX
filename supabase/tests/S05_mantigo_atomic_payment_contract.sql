-- S05 MantiGO Paymob atomic payment contract.
-- Static catalog contract only. This is not a behavioral or concurrency test.
-- Run only against an isolated disposable database; never use this to mutate production.
DO $s05$
DECLARE
  v_oid oid;
  v_def text;
  v_cfg text;
  v_missing text;
  v_payment_intent_type text;
BEGIN
  v_oid := to_regprocedure('public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,text,jsonb)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'S05 contract failed: atomic MantiGO payment RPC is missing';
  END IF;

  SELECT pg_get_functiondef(v_oid), p.proconfig
    INTO v_def, v_cfg
  FROM pg_proc p
  WHERE p.oid = v_oid;

  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'S05 contract failed: MantiGO payment RPC must be SECURITY DEFINER';
  END IF;
  IF coalesce(array_to_string(v_cfg, ','), '') NOT ILIKE '%search_path=public, pg_temp%' THEN
    RAISE EXCEPTION 'S05 contract failed: fixed safe search_path missing';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'S05 contract failed: MantiGO payment RPC must be service_role-only';
  END IF;

  IF v_def NOT ILIKE '%for update%'
     OR v_def NOT ILIKE '%insert into public.payment_provider_events%'
     OR v_def NOT ILIKE '%update public.mantigo_financial_ledger%'
     OR v_def NOT ILIKE '%paymob_intention_order_id%'
     OR v_def NOT ILIKE '%MANTIGO_EVENT_LEDGER_INCONSISTENT%'
     OR v_def NOT ILIKE '%MANTIGO_PAYMENT_STATE_TRANSITION_FAILED%' THEN
    RAISE EXCEPTION 'S05 contract failed: atomic lock/event/ledger/idempotency boundaries missing';
  END IF;

  -- Validate every payment-event column used by the new function before applying it.
  SELECT string_agg(required.column_name, ', ')
    INTO v_missing
  FROM (VALUES
    ('id'), ('tenant_id'), ('provider'), ('event_type'), ('payment_intent_id'),
    ('external_event_id'), ('status'), ('signature_verified'), ('raw_payload'), ('processed_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name='payment_provider_events'
      AND c.column_name=required.column_name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'S05 contract failed: payment_provider_events missing columns: %', v_missing;
  END IF;

  SELECT data_type INTO v_payment_intent_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='payment_provider_events'
    AND column_name='payment_intent_id';
  IF v_payment_intent_type NOT IN ('text', 'character varying') THEN
    RAISE EXCEPTION 'S05 review blocked: payment_provider_events.payment_intent_id must store MantiGO text ledger IDs; actual type=%', v_payment_intent_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='payment_provider_events'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(provider, external_event_id)%'
  ) THEN
    RAISE EXCEPTION 'S05 contract failed: unique (provider, external_event_id) constraint/index missing';
  END IF;

  RAISE NOTICE 'S05 MantiGO static function/schema contract passed; behavioral transaction tests remain required.';
END
$s05$;
