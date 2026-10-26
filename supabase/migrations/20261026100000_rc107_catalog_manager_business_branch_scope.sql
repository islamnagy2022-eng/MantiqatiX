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
          AND (m.business_id IS NULL OR m.business_id = p_business_id)
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

  IF p_id IS NULL THEN
    INSERT INTO public.catalog_items(
      tenant_id, business_id, branch_id, legacy_ref, item_type,
      name_ar, name_en, description, sku, tax_rate, metadata
    ) VALUES (
      p_tenant_id, p_business_id, p_branch_id,
      nullif(trim(p_legacy_ref), ''), upper(coalesce(p_item_type, 'PRODUCT')),
      trim(p_name_ar), nullif(trim(p_name_en), ''), p_description, nullif(trim(p_sku), ''),
      p_tax_rate, coalesce(p_metadata, '{}'::jsonb)
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
           metadata = coalesce(p_metadata, metadata),
           updated_at = now()
     WHERE id = p_id
       AND tenant_id = p_tenant_id
       AND business_id = p_business_id
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
          AND (m.business_id IS NULL OR m.business_id = p_business_id)
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
         AND (m.business_id = p_business_id OR m.business_id IS NULL)
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
