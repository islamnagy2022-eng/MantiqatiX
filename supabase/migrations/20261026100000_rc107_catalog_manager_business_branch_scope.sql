-- Production catalog manager: enforce business/branch scope for writes.
-- This preserves the existing API and Google OAuth; it tightens only the
-- database authority used by catalog-admin.

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
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_public jsonb;
  v_image_url text;
  v_compare_price numeric;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
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
          upper(m.role) = 'SUPER_ADMIN'
          AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
          AND coalesce((m.permissions->>'full_control')::boolean, false) = true
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)
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
                AND upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
           )
         )
         OR EXISTS (
           SELECT 1 FROM public.user_memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
              AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN'
              AND m.business_id IS NULL
              AND coalesce(m.permissions->>'scope','') = 'PLATFORM'
              AND coalesce((m.permissions->>'full_control')::boolean,false) = true
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
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_version bigint;
BEGIN
  IF auth.uid() IS NULL THEN
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
          upper(m.role) = 'SUPER_ADMIN'
          AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
          AND coalesce((m.permissions->>'full_control')::boolean, false) = true
        )
        OR (
          upper(m.role) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND (m.branch_id IS NULL OR m.branch_id = p_branch_id)
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


CREATE OR REPLACE FUNCTION public.upsert_catalog_settings_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_currency character varying DEFAULT 'EGP'::character varying,
  p_delivery_fee numeric DEFAULT 0,
  p_tax_inclusive boolean DEFAULT false,
  p_allow_discounts boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row public.catalog_business_settings%rowtype;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_currency IS NULL OR upper(trim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  IF p_delivery_fee IS NULL OR p_delivery_fee < 0
     OR p_delivery_fee::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_FEE';
  END IF;

  SELECT upper(m.role::text)
    INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid
     AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (
         upper(m.role::text) = 'SUPER_ADMIN'
         AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
         AND coalesce((m.permissions->>'full_control')::boolean, false) = true
       )
       OR (
         upper(m.role::text) IN ('OWNER', 'ADMIN', 'MANAGER', 'BUSINESS_OWNER')
         AND ((m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL)) OR m.business_id IS NULL)
         AND m.branch_id IS NULL
       )
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0
     WHEN 'OWNER' THEN 1
     WHEN 'ADMIN' THEN 2
     WHEN 'BUSINESS_OWNER' THEN 3
     WHEN 'MANAGER' THEN 4
     ELSE 99
   END
   LIMIT 1;

  IF v_role IS NULL THEN
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

  INSERT INTO public.catalog_business_settings(
    business_id, tenant_id, currency, delivery_fee,
    tax_inclusive, allow_discounts, updated_at
  ) VALUES (
    p_business_id, p_tenant_id, upper(trim(p_currency)), p_delivery_fee,
    coalesce(p_tax_inclusive, false), coalesce(p_allow_discounts, false), now()
  )
  ON CONFLICT (business_id) DO UPDATE
    SET tenant_id = excluded.tenant_id,
        currency = excluded.currency,
        delivery_fee = excluded.delivery_fee,
        tax_inclusive = excluded.tax_inclusive,
        allow_discounts = excluded.allow_discounts,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END
$function$;


-- Keep item fields and the first/new price in one transaction so the UI cannot
-- leave an item created without its intended price if the second write fails.
CREATE OR REPLACE FUNCTION public.upsert_catalog_item_and_price_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_item_branch_id character varying,
  p_price_branch_id character varying,
  p_legacy_ref character varying,
  p_item_type character varying,
  p_name_ar text,
  p_name_en text,
  p_description text,
  p_sku character varying,
  p_tax_rate numeric,
  p_metadata jsonb,
  p_id uuid,
  p_currency character varying,
  p_unit_price numeric,
  p_effective_from timestamp with time zone DEFAULT now(),
  p_effective_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_price jsonb;
  v_item_id uuid;
BEGIN
  v_item := public.upsert_catalog_item_backend(
    p_tenant_id, p_business_id, p_item_branch_id, p_legacy_ref, p_item_type,
    p_name_ar, p_name_en, p_description, p_sku, p_tax_rate, p_metadata, p_id
  );
  v_item_id := (v_item->>'id')::uuid;

  v_price := public.upsert_catalog_price_backend(
    p_tenant_id, p_business_id, v_item_id, p_price_branch_id, p_currency,
    p_unit_price, p_effective_from, p_effective_to
  );

  RETURN jsonb_build_object(
    'itemId', v_item_id,
    'item', v_item,
    'price', v_price
  );
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
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text := upper(trim(coalesce(p_status, '')));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_status NOT IN ('ACTIVE', 'INACTIVE') THEN RAISE EXCEPTION 'INVALID_CATALOG_ITEM_STATUS'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships m
     WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
       AND coalesce(m.status, 'ACTIVE') = 'ACTIVE'
       AND (
         (upper(m.role) = 'SUPER_ADMIN'
           AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
           AND coalesce((m.permissions->>'full_control')::boolean, false) = true)
         OR (upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
           AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
           AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))
       )
  ) THEN RAISE EXCEPTION 'CATALOG_WRITE_FORBIDDEN'; END IF;

  IF p_branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status,'')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

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
              AND upper(m.role) IN ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
         )
       )
       OR EXISTS (
         SELECT 1 FROM public.user_memberships m
          WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant_id
            AND m.status = 'ACTIVE' AND upper(m.role) = 'SUPER_ADMIN'
            AND coalesce(m.permissions->>'scope','') = 'PLATFORM'
            AND coalesce((m.permissions->>'full_control')::boolean,false) = true
       )
     )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'CATALOG_ITEM_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
END
$function$;


CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_backend(
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_name text,
  p_bio text,
  p_phone text,
  p_address text,
  p_governorate text,
  p_markaz text,
  p_village text,
  p_working_hours text,
  p_logo_url text,
  p_cover_url text,
  p_public_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_profile_id uuid;
  v_profile jsonb;
BEGIN
  IF v_uid IS NULL OR coalesce((auth.jwt()->>'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF nullif(trim(p_name), '') IS NULL OR length(trim(p_name)) > 200
     OR length(coalesce(p_bio, '')) > 3000
     OR length(coalesce(p_phone, '')) > 40
     OR length(coalesce(p_address, '')) > 500
     OR length(coalesce(p_governorate, '')) > 100
     OR length(coalesce(p_markaz, '')) > 100
     OR length(coalesce(p_village, '')) > 100
     OR length(coalesce(p_working_hours, '')) > 300
     OR length(coalesce(p_logo_url, '')) > 1500
     OR length(coalesce(p_cover_url, '')) > 1500 THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_PROFILE';
  END IF;

  IF nullif(trim(coalesce(p_logo_url, '')), '') IS NOT NULL
     AND trim(p_logo_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_LOGO_URL';
  END IF;
  IF nullif(trim(coalesce(p_cover_url, '')), '') IS NOT NULL
     AND trim(p_cover_url) !~* '^https://' THEN
    RAISE EXCEPTION 'INVALID_COVER_URL';
  END IF;

  SELECT upper(m.role::text) INTO v_role
    FROM public.user_memberships m
   WHERE m.user_id = v_uid AND m.tenant_id = p_tenant_id
     AND m.status = 'ACTIVE'
     AND (
       (upper(m.role::text) = 'SUPER_ADMIN'
          AND coalesce(m.permissions->>'scope', '') = 'PLATFORM'
          AND coalesce((m.permissions->>'full_control')::boolean, false) = true
          AND m.business_id IS NULL)
       OR (upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
          AND (m.business_id = p_business_id OR (upper(m.role::text) = 'OWNER' AND m.business_id IS NULL AND m.branch_id IS NULL))
          AND (m.branch_id IS NULL OR m.branch_id = p_branch_id))
     )
   ORDER BY CASE upper(m.role::text)
     WHEN 'SUPER_ADMIN' THEN 0 WHEN 'OWNER' THEN 1 WHEN 'BUSINESS_OWNER' THEN 2
     WHEN 'ADMIN' THEN 3 WHEN 'MANAGER' THEN 4 ELSE 99 END
   LIMIT 1;

  IF v_role IS NULL THEN RAISE EXCEPTION 'CATALOG_PROFILE_WRITE_FORBIDDEN'; END IF;
  IF coalesce(p_public_enabled, false) AND v_role = 'MANAGER' THEN
    RAISE EXCEPTION 'CATALOG_PUBLISH_REQUIRES_OWNER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
     WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id
       AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BUSINESS_NOT_ACTIVE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
       AND br.business_id = p_business_id AND upper(coalesce(br.status, '')) = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'BRANCH_BUSINESS_MISMATCH'; END IF;

  SELECT p.id INTO v_profile_id
    FROM public.marketing_provider_profiles p
   WHERE p.business_id = p_business_id AND upper(p.status) = 'ACTIVE'
   ORDER BY p.updated_at DESC NULLS LAST LIMIT 1;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_PROVIDER_PROFILE_REQUIRED'; END IF;

  v_profile := jsonb_build_object(
    'bio', trim(coalesce(p_bio, '')),
    'governorate', trim(coalesce(p_governorate, '')),
    'markaz', trim(coalesce(p_markaz, '')),
    'village', trim(coalesce(p_village, '')),
    'working_hours', trim(coalesce(p_working_hours, '')),
    'logo_url', trim(coalesce(p_logo_url, '')),
    'cover_url', trim(coalesce(p_cover_url, ''))
  );

  UPDATE public.businesses b
     SET name = trim(p_name),
         settings = jsonb_set(
           jsonb_set(coalesce(b.settings, '{}'::jsonb), '{catalog_profile}', v_profile, true),
           '{catalog_public_enabled}', to_jsonb(coalesce(p_public_enabled, false)), true
         ),
         updated_at = now()
   WHERE b.id = p_business_id AND b.tenant_id = p_tenant_id;

  UPDATE public.marketing_provider_profiles p
     SET name_ar = trim(p_name),
         description = nullif(trim(coalesce(p_bio, '')), ''),
         updated_at = now()
   WHERE p.id = v_profile_id;

  UPDATE public.branches br
     SET phone = nullif(trim(coalesce(p_phone, '')), ''),
         address = nullif(trim(coalesce(p_address, '')), ''),
         updated_at = now()
   WHERE br.id = p_branch_id AND br.tenant_id = p_tenant_id
     AND br.business_id = p_business_id;

  RETURN jsonb_build_object(
    'success', true, 'businessId', p_business_id, 'providerProfileId', v_profile_id,
    'branchId', p_branch_id, 'name', trim(p_name),
    'publicEnabled', coalesce(p_public_enabled, false)
  );
END
$function$;


GRANT EXECUTE ON FUNCTION public.update_catalog_item_status_backend(character varying, uuid, uuid, character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_business_profile_backend(character varying, uuid, character varying, text, text, text, text, text, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_item_and_price_backend(character varying, uuid, character varying, character varying, character varying, character varying, text, text, text, character varying, numeric, jsonb, uuid, character varying, numeric, timestamp with time zone, timestamp with time zone) TO authenticated;

-- Narrow privileged function execution to authenticated callers only.
REVOKE ALL ON FUNCTION public.upsert_catalog_item_backend(character varying, uuid, character varying, character varying, character varying, text, text, text, character varying, numeric, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_catalog_price_backend(character varying, uuid, uuid, character varying, character varying, numeric, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_catalog_item_status_backend(character varying, uuid, uuid, character varying, character varying) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_catalog_item_and_price_backend(character varying, uuid, character varying, character varying, character varying, character varying, text, text, text, character varying, numeric, jsonb, uuid, character varying, numeric, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_catalog_business_profile_backend(character varying, uuid, character varying, text, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_item_backend(character varying, uuid, character varying, character varying, character varying, text, text, text, character varying, numeric, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_price_backend(character varying, uuid, uuid, character varying, character varying, numeric, timestamp with time zone, timestamp with time zone) TO authenticated;
