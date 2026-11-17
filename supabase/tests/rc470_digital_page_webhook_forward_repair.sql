-- RC470: after applying the legacy RC424 fixture and guarded forward repair,
-- exercise the exact RC431 payment callback contract in disposable PostgreSQL only.
DO $contract$
DECLARE
  v_proc pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT p.* INTO v_proc
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.process_verified_digital_page_payment_backend(uuid,text,text,boolean,numeric,text,text,text,jsonb)'
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'RC470_FUNCTION_MISSING'; END IF;
  IF NOT (coalesce(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'RC470_SEARCH_PATH_NOT_EMPTY';
  END IF;
  IF NOT has_function_privilege('service_role',v_proc.oid,'EXECUTE')
     OR has_function_privilege('anon',v_proc.oid,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'RC470_ACL_CONTRACT_FAILED';
  END IF;
  IF v_proc.prosrc NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH%'
     OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH%'
     OR v_proc.prosrc NOT ILIKE '%DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH%' THEN
    RAISE EXCEPTION 'RC470_REQUIRED_BEHAVIOR_MISSING';
  END IF;
END;
$contract$;

\echo 'RC470 source repair verified; running RC431 behavioral contract'
