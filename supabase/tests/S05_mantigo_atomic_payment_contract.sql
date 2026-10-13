-- S05 MantiGO Paymob atomic payment contract.
-- Static catalog contract only. This is not a behavioral or concurrency test.
-- Run only against an isolated disposable database; never use this to mutate production.
-- MantiGO event records belong in mantigo_payment_provider_events (RC425), not the shared payment_provider_events table.
DO $s05$
DECLARE
  v_oid oid;
  v_def text;
  v_cfg text;
  v_missing text;
  v_id_type text;
  v_ledger_id_type text;
  v_rls boolean;
  v_force_rls boolean;
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
     OR v_def NOT ILIKE '%insert into public.mantigo_payment_provider_events%'
     OR v_def NOT ILIKE '%update public.mantigo_financial_ledger%'
     OR v_def NOT ILIKE '%paymob_intention_order_id%'
     OR v_def NOT ILIKE '%MANTIGO_EVENT_LEDGER_INCONSISTENT%'
     OR v_def NOT ILIKE '%MANTIGO_PAYMENT_STATE_TRANSITION_FAILED%'
     OR v_def ILIKE '%insert into public.payment_provider_events%' THEN
    RAISE EXCEPTION 'S05 contract failed: atomic lock/event/ledger boundaries or dedicated MantiGO event ledger are incorrect';
  END IF;

  SELECT string_agg(required.column_name, ', ')
    INTO v_missing
  FROM (VALUES
    ('id'), ('ledger_id'), ('provider'), ('event_type'), ('external_event_id'),
    ('status'), ('signature_verified'), ('raw_payload'), ('processed_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public'
      AND c.table_name='mantigo_payment_provider_events'
      AND c.column_name=required.column_name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'S05 contract failed: mantigo_payment_provider_events missing columns: %', v_missing;
  END IF;

  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='mantigo_payment_provider_events'
    AND column_name='id';
  SELECT data_type INTO v_ledger_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='mantigo_payment_provider_events'
    AND column_name='ledger_id';
  IF v_id_type NOT IN ('text', 'character varying')
     OR v_ledger_id_type NOT IN ('text', 'character varying') THEN
    RAISE EXCEPTION 'S05 review blocked: dedicated MantiGO event id and ledger_id must be text-like; actual id=%, ledger_id=%', v_id_type, v_ledger_id_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.mantigo_payment_provider_events'::regclass
      AND contype='u'
      AND conname='mantigo_payment_provider_events_provider_event_key'
  ) THEN
    RAISE EXCEPTION 'S05 contract failed: dedicated MantiGO provider/event unique constraint missing';
  END IF;

  SELECT c.relrowsecurity, c.relforcerowsecurity
    INTO v_rls, v_force_rls
  FROM pg_class c
  WHERE c.oid='public.mantigo_payment_provider_events'::regclass;
  IF NOT coalesce(v_rls, false) OR NOT coalesce(v_force_rls, false) THEN
    RAISE EXCEPTION 'S05 contract failed: dedicated MantiGO event ledger must have RLS and FORCE RLS enabled';
  END IF;

  IF has_table_privilege('anon','public.mantigo_payment_provider_events','SELECT')
     OR has_table_privilege('authenticated','public.mantigo_payment_provider_events','SELECT')
     OR has_table_privilege('service_role','public.mantigo_payment_provider_events','SELECT')
     OR has_table_privilege('anon','public.mantigo_payment_provider_events','INSERT')
     OR has_table_privilege('authenticated','public.mantigo_payment_provider_events','INSERT')
     OR has_table_privilege('service_role','public.mantigo_payment_provider_events','INSERT') THEN
    RAISE EXCEPTION 'S05 contract failed: direct API-role table access must remain revoked; writes occur through the SECURITY DEFINER RPC';
  END IF;

  RAISE NOTICE 'S05 MantiGO static function/schema contract passed; behavioral transaction tests remain required.';
END
$s05$;
