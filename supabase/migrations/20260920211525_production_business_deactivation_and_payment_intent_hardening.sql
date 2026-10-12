CREATE OR REPLACE FUNCTION public.deactivate_business(p_business_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  b public.businesses%rowtype;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO b
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'business_not_found';
  END IF;

  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = uid
      AND m.tenant_id = b.tenant_id
      AND m.status = 'ACTIVE'
      AND (m.business_id = b.id OR m.business_id IS NULL)
      AND m.role IN ('OWNER','ADMIN','MANAGER')
  ) THEN
    RAISE EXCEPTION 'business_deactivation_forbidden';
  END IF;

  UPDATE public.businesses
  SET status = 'SUSPENDED',
      settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{lifecycle}',
        jsonb_build_object(
          'status', 'SUSPENDED',
          'reason', NULLIF(trim(COALESCE(p_reason,'')), ''),
          'changed_by', uid,
          'changed_at', now()
        ),
        true
      ),
      updated_at = now()
  WHERE id = b.id;

  RETURN jsonb_build_object(
    'business_id', b.id,
    'status', 'SUSPENDED',
    'changed_at', now()
  );
END
$function$;

REVOKE ALL ON FUNCTION public.deactivate_business(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_business(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.deactivate_business(uuid,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_business(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_payment_intent_backend(
  p_tenant_id character varying,
  p_order_id uuid,
  p_amount numeric,
  p_currency character varying,
  p_provider character varying,
  p_payment_method character varying,
  p_idempotency_key character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id varchar;
  v_order public.orders%rowtype;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.tenant_id <> p_tenant_id THEN RAISE EXCEPTION 'TENANT_MISMATCH'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id = v_uid
      AND tenant_id = p_tenant_id
      AND status = 'ACTIVE'
      AND (business_id = v_order.business_id OR business_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'TENANT_ACCESS_DENIED';
  END IF;

  IF v_order.customer_id IS NOT NULL AND v_order.customer_id <> v_uid
     AND NOT EXISTS (
       SELECT 1 FROM public.user_memberships
       WHERE user_id=v_uid AND tenant_id=p_tenant_id AND status='ACTIVE'
         AND role IN ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
     )
  THEN
    RAISE EXCEPTION 'ORDER_ACCESS_DENIED';
  END IF;

  IF p_amount <= 0 OR abs(p_amount - v_order.total) > 0.01 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF upper(coalesce(p_currency,'')) <> upper(v_order.currency) THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;

  IF p_provider IS NULL OR length(trim(p_provider)) = 0 THEN RAISE EXCEPTION 'INVALID_PROVIDER'; END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_METHOD'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 OR length(p_idempotency_key) > 200 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;

  INSERT INTO public.payment_intents(
    id,tenant_id,order_id,amount,currency,status,provider,payment_method,idempotency_key
  )
  VALUES(
    gen_random_uuid()::text,p_tenant_id,p_order_id,v_order.total,v_order.currency,
    'CREATED',p_provider,p_payment_method,p_idempotency_key
  )
  ON CONFLICT(tenant_id,idempotency_key) DO UPDATE SET updated_at=now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id',v_id,'status','CREATED','amount',v_order.total,'currency',v_order.currency);
END
$function$;

REVOKE ALL ON FUNCTION public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying) FROM anon;
REVOKE ALL ON FUNCTION public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying) TO authenticated;
