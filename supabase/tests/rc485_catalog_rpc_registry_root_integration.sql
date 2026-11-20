-- Disposable-only post-migration contract for RC485.
-- Run after the full chronological replay has applied RC484 and RC485.
DO $rc485$
DECLARE
  item record;
  v_oid oid;
  v_is_definer boolean;
  v_config text;
  v_definition text;
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
    IF v_definition ILIKE '%permissions->>''scope''%'
       OR v_definition ILIKE '%permissions->>''full_control''%' THEN
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

SELECT 'RC485 catalog RPC registry-root + empty search_path integration: PASS (7 functions)' AS result;
