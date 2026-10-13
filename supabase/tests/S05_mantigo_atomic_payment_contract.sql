-- S05 MantiGO Paymob atomic payment contract.
-- Static catalog contract only. This is not a behavioral or concurrency test.
-- Run only against an isolated disposable database; never use this to mutate production.
DO $s05$
DECLARE
  v_oid oid;
  v_def text;
  v_cfg text;
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

  RAISE NOTICE 'S05 MantiGO static function contract passed; behavioral transaction tests remain required.';
END
$s05$;
