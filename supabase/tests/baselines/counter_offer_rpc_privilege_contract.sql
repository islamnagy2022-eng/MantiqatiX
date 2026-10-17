\set ON_ERROR_STOP on

-- Disposable baseline replay regression only. Never run against production.
DO $contract$
DECLARE
  v_oid oid := to_regprocedure('public.counter_offer_indrive_bid(uuid,uuid,numeric)');
  v_owner text;
  v_security_definer boolean;
  v_config text[];
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'COUNTER_OFFER_RPC_MISSING_AFTER_FORWARD_REPLAY';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
    INTO v_owner, v_security_definer, v_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_oid;

  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'COUNTER_OFFER_RPC_OWNER_MISMATCH: %', v_owner;
  END IF;
  IF v_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'COUNTER_OFFER_RPC_SECURITY_DEFINER_FLAG_MISMATCH';
  END IF;
  IF NOT coalesce(v_config @> ARRAY['search_path=public'], false) THEN
    RAISE EXCEPTION 'COUNTER_OFFER_RPC_SEARCH_PATH_MISMATCH: %', v_config;
  END IF;
  IF pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'COUNTER_OFFER_RPC_MUST_NOT_BE_EXECUTABLE_BY_ANON';
  END IF;
  IF pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'COUNTER_OFFER_RPC_MUST_NOT_BE_EXECUTABLE_BY_AUTHENTICATED';
  END IF;
  IF pg_catalog.has_schema_privilege('anon', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'ANON_MUST_NOT_CREATE_OBJECTS_IN_PUBLIC_SCHEMA';
  END IF;
  IF pg_catalog.has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'AUTHENTICATED_MUST_NOT_CREATE_OBJECTS_IN_PUBLIC_SCHEMA';
  END IF;

  RAISE NOTICE 'COUNTER_OFFER_RPC_PRIVILEGE_CONTRACT=PASS';
END;
$contract$;
