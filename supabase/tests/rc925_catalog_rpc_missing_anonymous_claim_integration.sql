-- Disposable-only RC925 regression: a missing is_anonymous claim is not a confirmed identity.
-- Run after RC484 -> RC485 -> RC486 -> RC923 -> RC925 on PostgreSQL 17.
SET ROLE authenticated;

DO $rc925_missing_anonymous_claim$
DECLARE
  v_actor uuid := '10000000-0000-4000-8000-000000000925';
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub',v_actor::text,
      'role','authenticated'
    )::text,
    true
  );

  IF auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'RC925_TEST_AUTH_UID_NOT_SET';
  END IF;
  IF (auth.jwt() ->> 'is_anonymous') IS NOT NULL THEN
    RAISE EXCEPTION 'RC925_TEST_ANONYMOUS_CLAIM_WAS_NOT_MISSING';
  END IF;

  BEGIN
    PERFORM public.adjust_catalog_stock_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::uuid,NULL::numeric,NULL::numeric,
      NULL::character varying,NULL::text
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_ADJUST_STOCK_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_catalog_warehouse_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::character varying
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_CREATE_WAREHOUSE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_item_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::character varying,NULL::text,NULL::text,
      NULL::text,NULL::character varying,NULL::numeric,NULL::jsonb,NULL::uuid
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_UPSERT_ITEM_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_price_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::numeric,NULL::timestamptz,NULL::timestamptz
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_UPSERT_PRICE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_settings_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::numeric,NULL::boolean,NULL::boolean
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_UPSERT_SETTINGS_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.update_catalog_item_status_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,
      NULL::character varying,NULL::character varying
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_UPDATE_ITEM_STATUS_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_business_profile_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,
      NULL::text,NULL::text,NULL::text,NULL::text,NULL::boolean
    );
    RAISE EXCEPTION 'RC925_MISSING_CLAIM_UPSERT_BUSINESS_PROFILE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;
END;
$rc925_missing_anonymous_claim$;

RESET ROLE;
SELECT 'RC925 missing is_anonymous claim denied by all seven catalog RPCs: PASS' AS result;
