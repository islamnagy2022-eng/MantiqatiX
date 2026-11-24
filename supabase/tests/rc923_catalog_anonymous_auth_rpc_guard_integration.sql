-- RC923 disposable integration test. Run after the full chronological migration replay.
-- Covers direct authenticated-role RPC calls carrying Anonymous Auth JWTs.
SET ROLE authenticated;
DO $anonymous$
DECLARE
  v_actor uuid := '10000000-0000-4000-8000-000000000923';
  v_claims jsonb := pg_catalog.jsonb_build_object(
    'sub','10000000-0000-4000-8000-000000000923',
    'role','authenticated',
    'is_anonymous',true
  );
BEGIN
  -- auth.jwt() in Supabase prioritizes request.jwt.claim (singular) when present.
  -- Set both supported claim settings so no stale singular claim can mask the test JWT.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claim',v_claims::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',v_claims::text,true);

  IF coalesce((auth.jwt()->>'is_anonymous')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RC923_TEST_FIXTURE_DID_NOT_SET_ANONYMOUS_AUTH_JWT';
  END IF;

  BEGIN
    PERFORM public.adjust_catalog_stock_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::uuid,NULL::numeric,NULL::numeric,
      NULL::character varying,NULL::text
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_ADJUST_STOCK_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_catalog_warehouse_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::character varying
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_CREATE_WAREHOUSE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_item_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::character varying,NULL::text,NULL::text,
      NULL::text,NULL::character varying,NULL::numeric,NULL::jsonb,NULL::uuid
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_UPSERT_ITEM_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_price_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::numeric,NULL::timestamptz,NULL::timestamptz
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_UPSERT_PRICE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_settings_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::numeric,NULL::boolean,NULL::boolean
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_UPSERT_SETTINGS_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.update_catalog_item_status_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,
      NULL::character varying,NULL::character varying
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_UPDATE_ITEM_STATUS_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_business_profile_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,
      NULL::text,NULL::text,NULL::text,NULL::text,NULL::boolean
    );
    RAISE EXCEPTION 'RC923_ANONYMOUS_UPSERT_BUSINESS_PROFILE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;
END;
$anonymous$;
RESET ROLE;

-- A confirmed Auth user must pass the identity gate and reach ordinary tenant RBAC.
SET ROLE authenticated;
DO $confirmed$
DECLARE
  v_actor uuid := '10000000-0000-4000-8000-000000000924';
  v_claims jsonb := pg_catalog.jsonb_build_object(
    'sub','10000000-0000-4000-8000-000000000924',
    'role','authenticated',
    'is_anonymous',false
  );
  v_rejected boolean := false;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claim',v_claims::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',v_claims::text,true);

  IF coalesce((auth.jwt()->>'is_anonymous')::boolean,true) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'RC923_CONFIRMED_AUTH_JWT_FIXTURE_INVALID';
  END IF;

  BEGIN
    PERFORM public.upsert_catalog_price_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::numeric,NULL::timestamptz,NULL::timestamptz
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='CATALOG_WRITE_FORBIDDEN' THEN
      v_rejected:=true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'RC923_CONFIRMED_USER_DID_NOT_REACH_TENANT_RBAC';
  END IF;
END;
$confirmed$;
RESET ROLE;

SELECT 'RC923 anonymous Auth catalog RPC guard: PASS (7 RPCs; confirmed-user RBAC preserved)' AS result;
