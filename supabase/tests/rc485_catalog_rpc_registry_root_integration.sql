-- Disposable-only post-migration contract for RC485 + RC923.
-- Run after the full chronological replay has applied RC484, RC485 and RC923.
DO $rc485$
DECLARE
  item record;
  v_oid oid;
  v_is_definer boolean;
  v_config text;
  v_definition text;
  v_definition_compact text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('public.adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text)'),
      ('public.create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying)'),
      ('public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)'),
      ('public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'),
      ('public.upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean)'),
      ('public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)'),
      ('public.upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean)')
    ) AS required(signature)
  LOOP
    v_oid := pg_catalog.to_regprocedure(item.signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'RC485_REQUIRED_CATALOG_RPC_MISSING:%', item.signature;
    END IF;

    SELECT p.prosecdef,
           pg_catalog.array_to_string(p.proconfig, ','),
           pg_catalog.pg_get_functiondef(p.oid)
      INTO v_is_definer, v_config, v_definition
      FROM pg_catalog.pg_proc p
     WHERE p.oid = v_oid;

    IF NOT v_is_definer THEN
      RAISE EXCEPTION 'RC485_CATALOG_RPC_NOT_SECURITY_DEFINER:%', item.signature;
    END IF;
    IF coalesce(v_config, '') NOT ILIKE '%search_path=""%' THEN
      RAISE EXCEPTION 'RC485_CATALOG_RPC_SEARCH_PATH_NOT_EMPTY:%:%', item.signature, v_config;
    END IF;
    IF v_definition NOT ILIKE '%public.is_platform_admin()%' THEN
      RAISE EXCEPTION 'RC485_REGISTRY_HELPER_CALL_MISSING:%', item.signature;
    END IF;
    v_definition_compact := pg_catalog.regexp_replace(v_definition, '[[:space:]]+', '', 'g');
    IF v_definition_compact NOT ILIKE '%auth.jwt()->>''is_anonymous''%' THEN
      RAISE EXCEPTION 'RC923_ANONYMOUS_AUTH_GUARD_MISSING:%',item.signature;
    END IF;
    IF NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'RC923_DIRECT_RPC_ACL_CHANGED:%',item.signature;
    END IF;
    IF v_definition_compact ILIKE '%permissions->>''scope''%'
       OR v_definition_compact ILIKE '%permissions->>''full_control''%' THEN
      RAISE EXCEPTION 'RC485_LEGACY_TENANT_METADATA_ROOT_BYPASS_REMAINS:%', item.signature;
    END IF;
    IF v_definition NOT ILIKE '%OWNER%'
       AND v_definition NOT ILIKE '%BUSINESS_OWNER%'
       AND v_definition NOT ILIKE '%ADMIN%' THEN
      RAISE EXCEPTION 'RC485_TENANT_LOCAL_ROLE_PATH_MISSING:%', item.signature;
    END IF;
  END LOOP;
END;
$rc485$;

-- Direct RPC calls are granted to authenticated, which also includes Supabase
-- Anonymous Auth sessions. A non-null auth.uid() alone is therefore insufficient.
SET ROLE authenticated;
DO $anonymous$
DECLARE
  v_actor uuid := '10000000-0000-4000-8000-000000000485';
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub',v_actor::text,'role','authenticated','is_anonymous',true
    )::text,
    true
  );

  BEGIN
    PERFORM public.adjust_catalog_stock_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::uuid,NULL::numeric,NULL::numeric,
      NULL::character varying,NULL::text
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_ADJUST_STOCK_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_catalog_warehouse_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::character varying
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_CREATE_WAREHOUSE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_item_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::character varying,NULL::text,NULL::text,
      NULL::text,NULL::character varying,NULL::numeric,NULL::jsonb,NULL::uuid
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_UPSERT_ITEM_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_price_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,NULL::character varying,
      NULL::character varying,NULL::numeric,NULL::timestamptz,NULL::timestamptz
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_UPSERT_PRICE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_settings_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::numeric,NULL::boolean,NULL::boolean
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_UPSERT_SETTINGS_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.update_catalog_item_status_backend(
      NULL::character varying,NULL::uuid,NULL::uuid,
      NULL::character varying,NULL::character varying
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_UPDATE_ITEM_STATUS_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AUTH_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upsert_catalog_business_profile_backend(
      NULL::character varying,NULL::uuid,NULL::character varying,
      NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,
      NULL::text,NULL::text,NULL::text,NULL::text,NULL::boolean
    );
    RAISE EXCEPTION 'RC485_ANONYMOUS_UPSERT_BUSINESS_PROFILE_BYPASS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'UNAUTHENTICATED' THEN RAISE; END IF;
  END;
END;
$anonymous$;
RESET ROLE;

SELECT 'RC485/RC923 registry-root, FORCE RLS and anonymous-session denial: PASS (7 functions)' AS result;
