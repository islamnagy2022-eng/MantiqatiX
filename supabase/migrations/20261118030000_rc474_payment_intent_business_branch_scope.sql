-- RC474: bind non-customer payment authorization to the exact order business/branch.
-- Forward-only repair for the RC200 payment-intent authorization path.
-- Keep customer-owned cross-tenant payments; require all non-customer actors to
-- hold an allowed financial role in the same business and applicable branch.

BEGIN;

DO $preflight$
DECLARE
  v_proc oid;
BEGIN
  v_proc := to_regprocedure(
    'public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)'
  );
  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'RC474_PRECONDITION_FAILED: create_payment_intent_backend signature missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = v_proc AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'RC474_PRECONDITION_FAILED: payment intent RPC must remain SECURITY DEFINER';
  END IF;

  IF pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL THEN
    RAISE EXCEPTION 'RC474_PRECONDITION_FAILED: expected Supabase client roles are missing';
  END IF;

  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL
     OR pg_catalog.to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'RC474_PRECONDITION_FAILED: Supabase Auth helpers missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders'
      AND column_name='branch_id' AND data_type='character varying'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders'
      AND column_name='customer_id' AND data_type='uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_memberships'
      AND column_name='branch_id' AND data_type='character varying'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_memberships'
      AND column_name='business_id' AND data_type='uuid'
  ) THEN
    RAISE EXCEPTION 'RC474_PRECONDITION_FAILED: business/branch authorization columns do not match expected types';
  END IF;
END
$preflight$;

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
SET search_path = ''
AS $function$
DECLARE
  v_id varchar;
  v_order public.orders%rowtype;
  v_uid uuid := auth.uid();
  v_existing public.payment_intents%rowtype;
BEGIN
  IF v_uid IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id=p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id))=0 OR v_order.tenant_id<>p_tenant_id THEN
    RAISE EXCEPTION 'TENANT_MISMATCH';
  END IF;

  IF upper(coalesce(v_order.status,'')) NOT IN ('PENDING','CREATED') THEN
    RAISE EXCEPTION 'ORDER_NOT_PAYABLE';
  END IF;

  -- A customer may pay only their own order. Every other actor must have an
  -- authorized role in the same business and either the order branch or the
  -- business-wide scope. Tenant-wide roles require business_id and branch_id NULL.
  IF v_order.customer_id IS DISTINCT FROM v_uid THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id=v_uid
        AND m.tenant_id=p_tenant_id
        AND m.status='ACTIVE'
        AND (
          (
            m.business_id=v_order.business_id
            AND (m.branch_id IS NULL OR m.branch_id=v_order.branch_id)
          )
          OR (m.business_id IS NULL AND m.branch_id IS NULL)
        )
    ) THEN
      RAISE EXCEPTION 'TENANT_ACCESS_DENIED';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id=v_uid
        AND m.tenant_id=p_tenant_id
        AND m.status='ACTIVE'
        AND upper(m.role::text) IN ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
        AND (
          (
            m.business_id=v_order.business_id
            AND (m.branch_id IS NULL OR m.branch_id=v_order.branch_id)
          )
          OR (m.business_id IS NULL AND m.branch_id IS NULL)
        )
    ) THEN
      RAISE EXCEPTION 'ORDER_ACCESS_DENIED';
    END IF;
  END IF;

  IF v_order.pricing_hash IS NULL OR v_order.pricing_version IS NULL OR v_order.pricing_authority IS NULL THEN
    RAISE EXCEPTION 'PRICING_SNAPSHOT_REQUIRED';
  END IF;
  IF p_amount IS NULL OR p_amount<=0
     OR abs(p_amount-v_order.total_amount)>0.01
     OR abs(p_amount-v_order.total)>0.01 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  IF upper(coalesce(p_currency,''))<>upper(v_order.currency) THEN RAISE EXCEPTION 'INVALID_CURRENCY'; END IF;
  IF p_provider IS NULL OR length(trim(p_provider))=0 OR length(trim(p_provider))>40 THEN
    RAISE EXCEPTION 'INVALID_PROVIDER';
  END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method))=0 OR length(trim(p_payment_method))>40 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))=0 OR length(p_idempotency_key)>200 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  SELECT * INTO v_existing
  FROM public.payment_intents
  WHERE tenant_id=p_tenant_id AND idempotency_key=trim(p_idempotency_key)
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.order_id<>p_order_id
       OR abs(v_existing.amount-v_order.total_amount)>0.01
       OR upper(v_existing.currency)<>upper(v_order.currency)
       OR v_existing.pricing_hash<>v_order.pricing_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'id',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,
      'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,
      'pricing_hash',v_existing.pricing_hash,'idempotent',true
    );
  END IF;

  INSERT INTO public.payment_intents(
    id,tenant_id,order_id,amount,currency,status,provider,payment_method,
    idempotency_key,pricing_version,pricing_hash
  )
  VALUES(
    pg_catalog.gen_random_uuid()::text,p_tenant_id,p_order_id,v_order.total_amount,v_order.currency,
    'CREATED',p_provider,p_payment_method,trim(p_idempotency_key),
    v_order.pricing_version,v_order.pricing_hash
  )
  RETURNING id INTO v_id;

  RETURN pg_catalog.jsonb_build_object(
    'id',v_id,'status','CREATED','amount',v_order.total_amount,'currency',v_order.currency,
    'pricing_version',v_order.pricing_version,'pricing_hash',v_order.pricing_hash,'idempotent',false
  );
END
$function$;

REVOKE ALL ON FUNCTION public.create_payment_intent_backend(
  character varying,uuid,numeric,character varying,character varying,character varying,character varying
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_payment_intent_backend(
  character varying,uuid,numeric,character varying,character varying,character varying,character varying
) TO authenticated, service_role;

COMMIT;
