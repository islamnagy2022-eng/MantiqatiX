\set ON_ERROR_STOP on

-- Read-only post-replay contract. Run only against the disposable database restored
-- from the reviewed schema-only checkpoint and replayed through all candidate migrations.
DO $post_replay$
DECLARE
  v_four regprocedure := to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)');
  v_five regprocedure := to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)');
  v_def text;
  v_config text;
BEGIN
  IF v_four IS NULL OR v_five IS NULL THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_FINALIZER_OVERLOAD_MISSING_AFTER_REPLAY';
  END IF;

  IF has_function_privilege('anon', v_four, 'EXECUTE')
     OR has_function_privilege('authenticated', v_four, 'EXECUTE')
     OR has_function_privilege('service_role', v_four, 'EXECUTE') THEN
    RAISE EXCEPTION 'LEGACY_FOUR_ARGUMENT_FINALIZER_MUST_BE_DISABLED';
  END IF;

  IF has_function_privilege('anon', v_five, 'EXECUTE')
     OR has_function_privilege('authenticated', v_five, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_five, 'EXECUTE') THEN
    RAISE EXCEPTION 'FIVE_ARGUMENT_FINALIZER_GRANTS_INVALID';
  END IF;

  SELECT pg_get_functiondef(p.oid), coalesce(array_to_string(p.proconfig, ','), '')
    INTO v_def, v_config
  FROM pg_proc p
  WHERE p.oid = v_five;

  IF v_def IS NULL OR v_def NOT LIKE '%TRUSTED_PAYMENT_FINALIZATION_REQUIRED%'
     OR v_def NOT LIKE '%provider_order_id = p_provider_order_id%'
     OR v_def NOT LIKE '%p_claim_token%' THEN
    RAISE EXCEPTION 'FIVE_ARGUMENT_FINALIZER_BODY_CONTRACT_INVALID';
  END IF;

  IF v_config NOT LIKE '%search_path=""%' THEN
    RAISE EXCEPTION 'FIVE_ARGUMENT_FINALIZER_SEARCH_PATH_NOT_EMPTY';
  END IF;

  RAISE NOTICE 'PASS: post-replay digital-page finalizer overloads, effective grants, trusted role guard, provider-order binding, claim binding, and empty search_path';
END
$post_replay$;
