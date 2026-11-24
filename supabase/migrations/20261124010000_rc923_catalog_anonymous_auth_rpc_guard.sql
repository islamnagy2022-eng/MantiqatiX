-- RC923: block Supabase Anonymous Auth sessions from the remaining catalog write RPCs.
-- RC485 remains immutable. Existing confirmed-user tenant/business/branch authorization is preserved.
-- Apply only after RC485 (the chronological replay applies this after RC922).
BEGIN;

DO $preflight$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(x.signature, ', ' ORDER BY x.signature)
    INTO v_missing
  FROM (VALUES
    ('public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)'),
    ('public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'),
    ('public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)')
  ) AS x(signature)
  WHERE pg_catalog.to_regprocedure(x.signature) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC923_REQUIRED_CATALOG_RPC_MISSING:%',v_missing;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid IN (
      'public.upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)'::regprocedure,
      'public.upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)'::regprocedure,
      'public.update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)'::regprocedure
    )
      AND (
        NOT p.prosecdef
        OR coalesce(pg_catalog.array_to_string(p.proconfig,','),'') NOT ILIKE '%search_path=""%'
      )
  ) THEN
    RAISE EXCEPTION 'RC923_CATALOG_RPC_SECURITY_DEFINER_CONTRACT_MISMATCH';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_item_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_legacy_ref character varying,
  p_item_type character varying,
  p_name_ar text,
  p_name_en text,
  p_description text,
  p_sku character varying,
  p_tax_rate numeric,
  p_metadata jsonb,
  p_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_public jsonb;
  v_image_url text;
  v_compare_price numeric;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = p_business_id
      AND b.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'BUSINESS_TENANT_MISMATCH';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_name_ar IS NULL OR nullif(trim(p_name_ar), '') IS NULL
     OR p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 100
     OR p_tax_rate::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM';
  END IF;

  IF upper(coalesce(p_item_type, 'PRODUCT')) NOT IN ('PRODUCT', 'SERVICE') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_ITEM_TYPE';
  END IF;

  v_image_url := nullif(trim(coalesce(p_metadata->'catalog_public'->>'image_url', '')), '');
  IF length(coalesce(v_image_url, '')) > 1500
     OR (v_image_url IS NOT NULL AND v_image_url !~* '^https://') THEN
    RAISE EXCEPTION 'INVALID_CATALOG_IMAGE_URL';
  END IF;

  BEGIN
    v_compare_price := nullif(trim(coalesce(p_metadata->'catalog_public'->>'compare_price', '')), '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END;

  IF v_compare_price IS NOT NULL AND
     (v_compare_price < 0 OR v_compare_price::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'INVALID_COMPARE_PRICE';
  END IF;

  IF length(coalesce(p_metadata->'catalog_public'->>'category', '')) > 100
     OR length(coalesce(p_metadata->'catalog_public'->>'unit', '')) > 40 THEN
    RAISE EXCEPTION 'INVALID_CATALOG_METADATA';
  END IF;

  v_public := jsonb_strip_nulls(jsonb_build_object(
    'category', nullif(trim(coalesce(p_metadata->'catalog_public'->>'category', '')), ''),
    'unit', nullif(trim(coalesce(p_metadata->'catalog_public'->>'unit', '')), ''),
    'image_url', v_image_url,
    'compare_price', v_compare_price,
    'track_stock', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'track_stock') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'track_stock')::boolean
      ELSE false
    END,
    'is_available', CASE
      WHEN jsonb_typeof(p_metadata->'catalog_public'->'is_available') = 'boolean'
      THEN (p_metadata->'catalog_public'->>'is_available')::boolean
      ELSE true
    END
  ));

  IF p_id IS NULL THEN
    -- Serialize item creation per business to prevent concurrent requests from
    -- exceeding the published module limit of 150 active products/services.
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    SELECT count(*)::integer INTO v_active_count
      FROM public.catalog_items
     WHERE business_id = p_business_id AND status = 'ACTIVE';
    IF v_active_count >= 150 THEN
      RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
    END IF;

    INSERT INTO public.catalog_items(
      tenant_id, business_id, branch_id, legacy_ref, item_type,
      name_ar, name_en, description, sku, tax_rate, metadata
    ) VALUES (
      p_tenant_id, p_business_id, p_branch_id,
      nullif(trim(p_legacy_ref), ''), upper(coalesce(p_item_type, 'PRODUCT')),
      trim(p_name_ar), nullif(trim(p_name_en), ''), p_description, nullif(trim(p_sku), ''),
      p_tax_rate, jsonb_strip_nulls(jsonb_build_object('source', left(coalesce(nullif(trim(p_metadata->>'source'), ''), 'MNTY_CATALOG_MANAGER'), 80), 'provider_kind', nullif(trim(coalesce(p_metadata->>'provider_kind', '')), ''), 'catalog_public', v_public))
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.catalog_items
       SET branch_id = p_branch_id,
           legacy_ref = nullif(trim(p_legacy_ref), ''),
           item_type = upper(coalesce(p_item_type, item_type)),
           name_ar = trim(p_name_ar),
           name_en = nullif(trim(p_name_en), ''),
           description = p_description,
           sku = nullif(trim(p_sku), ''),
           tax_rate = p_tax_rate,
           metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{catalog_public}', v_public, true),
           updated_at = now()
     WHERE id = p_id
       AND tenant_id = p_tenant_id
       AND business_id = p_business_id
       AND (
         branch_id = p_branch_id
         OR (
           branch_id IS NULL
           AND EXISTS (
             SELECT 1 FROM public.user_memberships m
              WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
                AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
                AND m.branch_id IS NULL
                AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
           )
         )
         OR EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
              AND m.business_id IS NULL
         )
       )
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.upsert_catalog_price_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_currency character varying,
  p_unit_price numeric,
  p_effective_from timestamp with time zone DEFAULT now(),
  p_effective_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_version bigint;
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
      AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
      AND (
        (
          upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)))
        )
      )
  ) THEN
    RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_items ci
    WHERE ci.id = p_catalog_item_id
      AND ci.tenant_id = p_tenant_id
      AND ci.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches br
    WHERE br.id = p_branch_id
      AND br.tenant_id = p_tenant_id
      AND br.business_id = p_business_id
      AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0
     OR p_unit_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_PRICE';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  SELECT coalesce(max(version), 0) + 1
    INTO v_version
    FROM public.catalog_item_prices
   WHERE catalog_item_id = p_catalog_item_id
     AND coalesce(branch_id, '') = coalesce(p_branch_id, '');

  INSERT INTO public.catalog_item_prices(
    tenant_id, catalog_item_id, branch_id, currency, unit_price,
    version, effective_from, effective_to
  ) VALUES (
    p_tenant_id, p_catalog_item_id, p_branch_id, upper(trim(p_currency)),
    p_unit_price, v_version, coalesce(p_effective_from, now()), p_effective_to
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'version', v_version);
END
$function$;

CREATE OR REPLACE FUNCTION public.update_catalog_item_status_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_catalog_item_id uuid,
  p_branch_id character varying,
  p_status character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text := upper(trim(coalesce(p_status, '')));
  v_id uuid;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_CATALOG_ITEM_STATUS'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin())
         OR (upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
           AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
           AND ((upper(m.role::text) = 'MANAGER' AND m.branch_id IS NOT NULL AND m.branch_id = p_branch_id) OR (upper(m.role::text) <> 'MANAGER' AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))))
       )
  ) THEN RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN'; END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  -- Reactivation counts against the same per-business cap as item creation.
  -- Use the same transaction lock to prevent concurrent creates/reactivations
  -- from racing past the 150 active item limit.
  IF v_status = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text)::bigint);
    IF EXISTS (
      SELECT 1 FROM public.catalog_items ci
       WHERE ci.id = p_catalog_item_id
         AND ci.tenant_id = p_tenant_id
         AND ci.business_id = p_business_id
         AND ci.status <> 'ACTIVE'
    ) THEN
      SELECT count(*)::integer INTO v_active_count
        FROM public.catalog_items ci
       WHERE ci.business_id = p_business_id
         AND ci.tenant_id = p_tenant_id
         AND ci.status = 'ACTIVE';
      IF v_active_count >= 150 THEN
        RAISE EXCEPTION 'CATALOG_ITEM_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  UPDATE public.catalog_items
     SET status = v_status, updated_at = now()
   WHERE id = p_catalog_item_id
     AND tenant_id = p_tenant_id
     AND business_id = p_business_id
     AND (
       branch_id = p_branch_id
       OR (
         branch_id IS NULL
         AND EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
              AND m.branch_id IS NULL
              AND upper(m.role) IN ('OWNER','ADMIN','BUSINESS_OWNER')
         )
       )
       OR EXISTS (
         SELECT 1 FROM public.user_memberships m
          WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
            AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN' AND public.is_platform_admin()
       )
     )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
END
$function$;

COMMIT;
