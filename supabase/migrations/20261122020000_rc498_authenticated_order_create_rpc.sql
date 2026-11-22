-- RC498 — authenticated invocation contract for canonical marketplace order creation.
-- Keep pricing and tenant/business checks inside the SECURITY DEFINER backend RPC.
-- This migration enables the user-scoped JWT call required for auth.uid() to be present.

BEGIN;

DO $preflight$
DECLARE
  v_oid oid := to_regprocedure(
    'public.create_order_backend(uuid, character varying, uuid, character varying, uuid, character varying, numeric, numeric, numeric, numeric, numeric, character varying, text, text, text, jsonb, text, jsonb)'
  );
  v_def text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'RC498_CREATE_ORDER_BACKEND_MISSING';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'RC498_CREATE_ORDER_BACKEND_MUST_REMAIN_SECURITY_DEFINER';
  END IF;
  v_def := pg_get_functiondef(v_oid);
  IF position('auth.uid()' IN v_def) = 0
     OR position('p_customer_id' IN v_def) = 0
     OR position('catalog_item_prices' IN v_def) = 0
     OR position('CUSTOMER_REQUIRED' IN v_def) = 0 THEN
    RAISE EXCEPTION 'RC498_CREATE_ORDER_BACKEND_IDENTITY_OR_PRICING_GUARD_MISSING';
  END IF;
END
$preflight$;

ALTER FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) SET search_path = pg_catalog, public, extensions, pg_temp;

-- The RPC itself binds p_customer_id to auth.uid(), checks customer membership,
-- tenant/business/provider/branch scope, and recalculates catalog prices server-side.
-- Grant only to authenticated callers; preserve the existing service_role path for
-- controlled legacy server integrations. PUBLIC and anon remain denied.
REVOKE ALL ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) IS 'RC498: authenticated JWT invocation only; auth.uid must match p_customer_id; server validates membership, business, provider, catalog and authoritative pricing.';

COMMIT;
