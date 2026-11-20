-- RC486 post-migration contract. Disposable replay only.
DO $rc486$
DECLARE
  v_function oid := pg_catalog.to_regprocedure(
    'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'
  );
  v_index oid := pg_catalog.to_regclass('public.catalog_item_prices_item_branch_version_uidx');
  v_definition text;
  v_index_definition text;
  v_compact text;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'RC486_PRICE_RPC_MISSING';
  END IF;
  IF v_index IS NULL THEN
    RAISE EXCEPTION 'RC486_PRICE_VERSION_UNIQUE_INDEX_MISSING';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(v_function) INTO v_definition;
  v_compact := pg_catalog.regexp_replace(v_definition, '[[:space:]]+', '', 'g');
  IF v_compact NOT LIKE '%pg_catalog.pg_advisory_xact_lock(%' THEN
    RAISE EXCEPTION 'RC486_PRICE_RPC_ADVISORY_LOCK_MISSING';
  END IF;
  IF position('pg_catalog.pg_advisory_xact_lock' IN v_definition)
       >= position('SELECT coalesce(max(version)' IN v_definition) THEN
    RAISE EXCEPTION 'RC486_PRICE_RPC_LOCK_MUST_PRECEDE_MAX_VERSION';
  END IF;
  IF v_definition NOT ILIKE '%SET search_path TO ''''' THEN
    RAISE EXCEPTION 'RC486_PRICE_RPC_SEARCH_PATH_NOT_EMPTY';
  END IF;

  SELECT pg_catalog.pg_get_indexdef(v_index) INTO v_index_definition;
  IF v_index_definition NOT ILIKE '%UNIQUE INDEX%'
     OR v_index_definition NOT ILIKE '%coalesce(branch_id%'
     OR v_index_definition NOT ILIKE '%catalog_item_id%'
     OR v_index_definition NOT ILIKE '%version%' THEN
    RAISE EXCEPTION 'RC486_PRICE_VERSION_INDEX_DEFINITION_MISMATCH:%', v_index_definition;
  END IF;
END;
$rc486$;

SELECT 'RC486 catalog price version lock + unique index contract: PASS' AS result;
