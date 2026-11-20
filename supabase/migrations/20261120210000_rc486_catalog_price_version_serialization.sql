-- RC486: serialize catalog price-version allocation per item/branch.
-- The null-safe key matches the RPC's existing coalesce(branch_id, '') scope.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.catalog_item_prices
     GROUP BY catalog_item_id, coalesce(branch_id, ''), version
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'RC486_DUPLICATE_CATALOG_PRICE_VERSIONS_REQUIRE_RECONCILIATION';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_item_prices WHERE version IS NULL
  ) THEN
    RAISE EXCEPTION 'RC486_NULL_CATALOG_PRICE_VERSION_REQUIRES_RECONCILIATION';
  END IF;
END;
$preflight$;

-- Enforce the same item/branch/version uniqueness that the allocator expects.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_item_prices_item_branch_version_uidx
  ON public.catalog_item_prices (
    catalog_item_id,
    (coalesce(branch_id, ''::character varying)),
    version
  );

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

  -- Serialize writers for this item/branch before reading MAX(version).
  -- Hash collisions only cause harmless extra serialization.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_catalog_item_id::text || ':' || coalesce(p_branch_id, ''))::bigint
  );

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

COMMIT;
