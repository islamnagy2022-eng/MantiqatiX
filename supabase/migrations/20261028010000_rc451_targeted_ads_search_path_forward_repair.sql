-- Forward-only RC451 repair for production instances where the function exists
-- but still has search_path=public,pg_temp. This is configuration-only:
-- no table data, function body, or execute grants are changed.
DO $rc451_preflight$
DECLARE
  v_oid regprocedure := to_regprocedure(
    'public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)'
  );
  v_definition text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'RC451_FORWARD_REPAIR_FUNCTION_MISSING';
  END IF;

  v_definition := lower(pg_get_functiondef(v_oid));
  -- Only reject unqualified references to known application tables. A minimal
  -- disposable fixture may use no tables; the live function is separately
  -- inspected before rollout and its actual references are all schema-qualified.
  IF v_definition ~* '\m(from|join)\s+advertisements\M'
     OR v_definition ~* '\m(from|join)\s+advertisement_target_locations\M'
     OR v_definition ~* '\m(from|join)\s+platform_geo_areas\M'
     OR v_definition ~* '\m(from|join)\s+platform_global_advertisements\M' THEN
    RAISE EXCEPTION 'RC451_FORWARD_REPAIR_SCHEMA_QUALIFICATION_CONTRACT_DRIFT';
  END IF;

  IF NOT has_function_privilege('anon', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC451_FORWARD_REPAIR_INTENDED_DISCOVERY_GRANTS_MISSING';
  END IF;
END;
$rc451_preflight$;

ALTER FUNCTION public.get_mnty_targeted_advertisements(
  character varying,
  character varying,
  character varying,
  double precision,
  double precision,
  character varying,
  integer
) SET search_path = '';

DO $rc451_postflight$
DECLARE
  v_oid regprocedure := to_regprocedure(
    'public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)'
  );
  v_config text;
BEGIN
  SELECT coalesce(array_to_string(p.proconfig, ','), '')
    INTO v_config
    FROM pg_proc p
   WHERE p.oid = v_oid;

  IF v_config NOT IN ('search_path=""', 'search_path=') THEN
    RAISE EXCEPTION 'RC451_FORWARD_REPAIR_EMPTY_SEARCH_PATH_NOT_APPLIED:%', v_config;
  END IF;

  IF NOT has_function_privilege('anon', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC451_FORWARD_REPAIR_EXECUTE_GRANTS_CHANGED';
  END IF;
END;
$rc451_postflight$;
