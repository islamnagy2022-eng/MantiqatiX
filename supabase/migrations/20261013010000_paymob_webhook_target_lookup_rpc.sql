BEGIN;

-- Server-only, read-minimized lookup for the Paymob webhook.
-- The webhook runtime must not need direct table grants for protected financial rows.
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
  v_row record;
BEGIN
  IF nullif(trim(coalesce(p_merchant_ref, '')), '') IS NULL
     AND nullif(trim(coalesce(p_provider_order_id, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  -- Preserve the existing dispatch precedence: subscriptions, digital pages,
  -- MantiGO rides, then standard payment intents. Prefer exact merchant reference.
  SELECT id, business_id, amount, currency, status, provider_order_id
    INTO v_row
    FROM public.subscription_payment_intents
   WHERE provider = 'PAYMOB'
     AND (
       (nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL AND id::text = p_merchant_ref)
       OR (nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
           AND provider_order_id = p_provider_order_id)
     )
   ORDER BY CASE WHEN id::text = p_merchant_ref THEN 0 ELSE 1 END
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('kind','subscription','id',v_row.id,'business_id',v_row.business_id,
      'amount',v_row.amount,'currency',v_row.currency,'status',v_row.status,
      'provider_order_id',v_row.provider_order_id);
  END IF;

  SELECT id, user_id, amount, currency, payment_status, provider_order_id, metadata
    INTO v_row
    FROM public.digital_page_orders
   WHERE provider = 'PAYMOB'
     AND (
       (nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL AND id::text = p_merchant_ref)
       OR (nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
           AND provider_order_id = p_provider_order_id)
     )
   ORDER BY CASE WHEN id::text = p_merchant_ref THEN 0 ELSE 1 END
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('kind','digital_page','id',v_row.id,'user_id',v_row.user_id,
      'amount',v_row.amount,'currency',v_row.currency,'payment_status',v_row.payment_status,
      'provider_order_id',v_row.provider_order_id,'metadata',v_row.metadata);
  END IF;

  SELECT id, ride_id, customer_id, currency, gross_amount, payment_status, settlement_status
    INTO v_row
    FROM public.mantigo_financial_ledger
   WHERE nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL
     AND id::text = p_merchant_ref
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('kind','mantigo','id',v_row.id,'ride_id',v_row.ride_id,
      'customer_id',v_row.customer_id,'currency',v_row.currency,'gross_amount',v_row.gross_amount,
      'payment_status',v_row.payment_status,'settlement_status',v_row.settlement_status);
  END IF;

  SELECT id, tenant_id, order_id, amount, currency, status, pricing_version, pricing_hash,
         provider_order_id, provider
    INTO v_row
    FROM public.payment_intents
   WHERE provider = 'PAYMOB'
     AND (
       (nullif(trim(coalesce(p_merchant_ref, '')), '') IS NOT NULL AND id::text = p_merchant_ref)
       OR (nullif(trim(coalesce(p_provider_order_id, '')), '') IS NOT NULL
           AND provider_order_id = p_provider_order_id)
     )
   ORDER BY CASE WHEN id::text = p_merchant_ref THEN 0 ELSE 1 END
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('kind','payment_intent','id',v_row.id,'tenant_id',v_row.tenant_id,
      'order_id',v_row.order_id,'amount',v_row.amount,'currency',v_row.currency,'status',v_row.status,
      'pricing_version',v_row.pricing_version,'pricing_hash',v_row.pricing_hash,
      'provider_order_id',v_row.provider_order_id,'provider',v_row.provider);
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_paymob_webhook_target(text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_paymob_webhook_target(text,text) TO service_role;

COMMIT;
