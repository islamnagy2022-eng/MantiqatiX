BEGIN;

-- Service-role-only, read-minimized lookup for the Paymob webhook.
-- Exact merchant-reference matches win, but any ambiguous exact or provider-order
-- match fails closed. The caller and atomic processing RPCs revalidate the binding.
CREATE OR REPLACE FUNCTION public.resolve_paymob_webhook_target(
  p_merchant_ref text,
  p_provider_order_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_candidates jsonb := '[]'::jsonb;
  v_exact_targets jsonb := '[]'::jsonb;
  v_order_targets jsonb := '[]'::jsonb;
  v_exact_count integer := 0;
  v_order_count integer := 0;
BEGIN
  IF nullif(trim(coalesce(p_merchant_ref, '')), '') IS NULL
     AND nullif(trim(coalesce(p_provider_order_id, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'exact_match', c.exact_match,
      'order_match', c.order_match,
      'target', c.target
    )),
    '[]'::jsonb
  )
  INTO v_candidates
  FROM (
    SELECT
      (
        nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
        AND (s.id::text = p_merchant_ref OR ('MANTIQATIX-SUB-' || s.id::text) = p_merchant_ref)
      ) AS exact_match,
      (
        nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
        AND s.provider_order_id = p_provider_order_id
      ) AS order_match,
      jsonb_build_object(
        'kind','subscription','id',s.id,'business_id',s.business_id,
        'amount',s.amount,'currency',s.currency,'status',s.status,
        'provider_order_id',s.provider_order_id
      ) AS target
    FROM public.subscription_payment_intents s
    WHERE s.provider = 'PAYMOB'
      AND (
        (nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
          AND (s.id::text = p_merchant_ref OR ('MANTIQATIX-SUB-' || s.id::text) = p_merchant_ref))
        OR
        (nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
          AND s.provider_order_id = p_provider_order_id)
      )

    UNION ALL

    SELECT
      (
        nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
        AND d.id::text = p_merchant_ref
      ) AS exact_match,
      (
        nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
        AND d.provider_order_id = p_provider_order_id
      ) AS order_match,
      jsonb_build_object(
        'kind','digital_page','id',d.id,'user_id',d.user_id,
        'amount',d.amount,'currency',d.currency,'payment_status',d.payment_status,
        'provider_order_id',d.provider_order_id,'metadata',d.metadata
      ) AS target
    FROM public.digital_page_orders d
    WHERE d.provider = 'PAYMOB'
      AND (
        (nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL AND d.id::text = p_merchant_ref)
        OR
        (nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
          AND d.provider_order_id = p_provider_order_id)
      )

    UNION ALL

    SELECT
      (
        nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
        AND l.id::text = p_merchant_ref
      ) AS exact_match,
      false AS order_match,
      jsonb_build_object(
        'kind','mantigo','id',l.id,'ride_id',l.ride_id,
        'customer_id',l.customer_id,'currency',l.currency,'gross_amount',l.gross_amount,
        'payment_status',l.payment_status,'settlement_status',l.settlement_status
      ) AS target
    FROM public.mantigo_financial_ledger l
    WHERE nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
      AND l.id::text = p_merchant_ref

    UNION ALL

    SELECT
      (
        nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
        AND pi.id::text = p_merchant_ref
      ) AS exact_match,
      (
        nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
        AND pi.provider_order_id = p_provider_order_id
      ) AS order_match,
      jsonb_build_object(
        'kind','payment_intent','id',pi.id,'tenant_id',pi.tenant_id,
        'order_id',pi.order_id,'amount',pi.amount,'currency',pi.currency,'status',pi.status,
        'pricing_version',pi.pricing_version,'pricing_hash',pi.pricing_hash,
        'provider_order_id',pi.provider_order_id,'provider',pi.provider
      ) AS target
    FROM public.payment_intents pi
    WHERE pi.provider = 'PAYMOB'
      AND (
        (nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL AND pi.id::text = p_merchant_ref)
        OR
        (nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
          AND pi.provider_order_id = p_provider_order_id)
      )
  ) AS c;

  SELECT count(*) FILTER (WHERE r.exact_match),
         coalesce(jsonb_agg(r.target) FILTER (WHERE r.exact_match), '[]'::jsonb)
    INTO v_exact_count, v_exact_targets
    FROM jsonb_to_recordset(v_candidates) AS r(
      exact_match boolean,
      order_match boolean,
      target jsonb
    );

  IF v_exact_count > 1 THEN
    RAISE EXCEPTION 'PAYMENT_TARGET_AMBIGUOUS_MERCHANT_REFERENCE';
  END IF;
  IF v_exact_count = 1 THEN
    RETURN v_exact_targets -> 0;
  END IF;

  SELECT count(*) FILTER (WHERE r.order_match),
         coalesce(jsonb_agg(r.target) FILTER (WHERE r.order_match), '[]'::jsonb)
    INTO v_order_count, v_order_targets
    FROM jsonb_to_recordset(v_candidates) AS r(
      exact_match boolean,
      order_match boolean,
      target jsonb
    );

  IF v_order_count > 1 THEN
    RAISE EXCEPTION 'PAYMENT_TARGET_AMBIGUOUS_PROVIDER_ORDER';
  END IF;
  IF v_order_count = 1 THEN
    RETURN v_order_targets -> 0;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_paymob_webhook_target(text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_paymob_webhook_target(text,text) TO service_role;

COMMIT;
