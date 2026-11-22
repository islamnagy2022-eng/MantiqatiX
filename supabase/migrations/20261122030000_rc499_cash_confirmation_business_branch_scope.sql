-- RC499 — make cash confirmation membership selection deterministic and order-scoped.
-- The API pre-authorizes the actor; the service-only RPC repeats the same scope
-- so unrelated memberships in the same tenant can neither authorize nor shadow
-- the membership that actually owns the order's business/branch.

BEGIN;

DO $preflight$
DECLARE
  v_oid oid := to_regprocedure('public.confirm_cash_payment(character varying,uuid)');
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'RC499_PRECONDITION_FAILED: confirm_cash_payment(character varying,uuid) is missing';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=v_oid) THEN
    RAISE EXCEPTION 'RC499_PRECONDITION_FAILED: cash confirmation must remain SECURITY DEFINER';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE')
     OR has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC499_PRECONDITION_FAILED: cash confirmation ACL drift';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='branch_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_memberships' AND column_name='branch_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_memberships' AND column_name='permissions'
  ) THEN
    RAISE EXCEPTION 'RC499_PRECONDITION_FAILED: business/branch membership schema is incomplete';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_intent_id character varying,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_payment_intent_id text;
  v_intent record;
  v_order record;
  v_membership record;
  v_rule record;
  v_commission_amount numeric := 0;
  v_user_role text;
  v_is_authorized boolean := false;
  v_event_id text;
  v_obligation_id text;
  v_existing_event public.payment_events%rowtype;
  v_existing_obligation public.financial_obligations%rowtype;
BEGIN
  v_payment_intent_id := p_payment_intent_id;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT *
    INTO v_intent
    FROM public.payment_intents
   WHERE id = v_payment_intent_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;

  SELECT *
    INTO v_order
    FROM public.orders
   WHERE id = v_intent.order_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  -- Only select an active membership that is actually scoped to this order.
  -- A branchless membership is business-wide, not tenant-wide. Tenant-wide
  -- access is reserved for fully unscoped OWNER/ADMIN memberships. The query
  -- filters role/permission before selection, so another membership belonging
  -- to the same user cannot shadow the authorized row.
  SELECT m.role, m.permissions, m.status
    INTO v_membership
    FROM public.user_memberships m
   WHERE m.user_id = p_user_id
     AND m.tenant_id = v_intent.tenant_id
     AND m.status = 'ACTIVE'
     AND upper(coalesce(m.role::text, '')) <> 'CUSTOMER'
     AND (
       (
         m.business_id = v_order.business_id
         AND (m.branch_id IS NULL OR m.branch_id IS NOT DISTINCT FROM v_order.branch_id)
       )
       OR (
         m.business_id IS NULL
         AND m.branch_id IS NULL
         AND upper(m.role::text) IN ('OWNER', 'ADMIN')
       )
     )
     AND (
       upper(m.role::text) IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF', 'OWNER')
       OR (
         jsonb_typeof(coalesce(m.permissions, '{}'::jsonb)) = 'array'
         AND m.permissions ? 'PAYMENT_CONFIRM_CASH'
       )
       OR (
         jsonb_typeof(coalesce(m.permissions, '{}'::jsonb)) = 'object'
         AND m.permissions -> 'PAYMENT_CONFIRM_CASH' = 'true'::jsonb
       )
     )
   ORDER BY
     CASE
       WHEN m.business_id = v_order.business_id
        AND m.branch_id IS NOT DISTINCT FROM v_order.branch_id THEN 0
       WHEN m.business_id = v_order.business_id AND m.branch_id IS NULL THEN 1
       ELSE 2
     END,
     m.id
   LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  v_user_role := coalesce(v_membership.role, 'CUSTOMER');
  v_is_authorized :=
    (
      upper(v_user_role) IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF', 'OWNER')
      OR (
        jsonb_typeof(coalesce(v_membership.permissions, '{}'::jsonb)) = 'array'
        AND v_membership.permissions ? 'PAYMENT_CONFIRM_CASH'
      )
      OR (
        jsonb_typeof(coalesce(v_membership.permissions, '{}'::jsonb)) = 'object'
        AND v_membership.permissions -> 'PAYMENT_CONFIRM_CASH' = 'true'::jsonb
      )
    )
    AND upper(v_user_role) <> 'CUSTOMER';
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF v_intent.status = 'SUCCEEDED' THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'message', 'Already confirmed',
      'payment_intent', to_jsonb(v_intent),
      'order', to_jsonb(v_order)
    );
  END IF;
  IF v_intent.status NOT IN ('CREATED', 'PENDING') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE'; END IF;
  IF v_order.status = 'CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
  IF v_intent.payment_method <> 'CASH_ON_DELIVERY' THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
  IF v_intent.tenant_id::text <> v_order.tenant_id::text THEN RAISE EXCEPTION 'TENANT_MISMATCH'; END IF;
  IF v_intent.pricing_hash IS NULL
     OR v_order.pricing_hash IS NULL
     OR v_intent.pricing_hash <> v_order.pricing_hash
     OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version THEN
    RAISE EXCEPTION 'PRICING_BINDING_MISMATCH';
  END IF;
  IF v_intent.amount <> v_order.total OR v_intent.currency <> v_order.currency THEN
    RAISE EXCEPTION 'FINANCIAL_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.tenant_payment_methods tpm
     WHERE tpm.tenant_id = v_intent.tenant_id::text
       AND tpm.payment_method = 'CASH_ON_DELIVERY'
       AND tpm.provider = v_intent.provider
       AND tpm.is_enabled = true
  ) THEN
    RAISE EXCEPTION 'INVALID_PROVIDER';
  END IF;

  SELECT cr.id, cr.rule_type, cr.percentage, cr.fixed_amount, cr.per_item_amount
    INTO v_rule
    FROM public.commission_rules cr
   WHERE cr.tenant_id = v_intent.tenant_id
     AND cr.active = true
     AND (cr.business_id = v_order.business_id OR cr.business_id IS NULL)
   ORDER BY
     CASE WHEN cr.business_id = v_order.business_id THEN 0 ELSE 1 END,
     cr.updated_at DESC
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMISSION_RULE_NOT_CONFIGURED'; END IF;

  IF upper(coalesce(v_rule.rule_type, 'PERCENTAGE')) = 'PERCENTAGE' THEN
    IF coalesce(v_rule.percentage, 0) < 0 OR coalesce(v_rule.percentage, 0) > 100 THEN
      RAISE EXCEPTION 'COMMISSION_RULE_INVALID';
    END IF;
    v_commission_amount := round(v_intent.amount * coalesce(v_rule.percentage, 0) / 100, 2);
  ELSIF upper(v_rule.rule_type) = 'FIXED' THEN
    v_commission_amount := greatest(0, coalesce(v_rule.fixed_amount, 0));
  ELSE
    RAISE EXCEPTION 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_CASH';
  END IF;
  IF v_commission_amount > v_intent.amount THEN RAISE EXCEPTION 'COMMISSION_EXCEEDS_ORDER'; END IF;

  v_event_id := 'cash_confirmed:' || v_payment_intent_id;
  v_obligation_id := 'cash_commission:' || v_payment_intent_id;

  -- Do not let a pre-existing event silently suppress a new financial record.
  -- A pre-existing row is acceptable only when every monetary and actor binding matches.
  SELECT * INTO v_existing_event
    FROM public.payment_events
   WHERE event_id = v_event_id
   FOR UPDATE;
  IF FOUND AND (
       v_existing_event.tenant_id IS DISTINCT FROM v_intent.tenant_id
    OR v_existing_event.payment_id IS DISTINCT FROM v_payment_intent_id
    OR v_existing_event.amount IS DISTINCT FROM v_intent.amount
    OR v_existing_event.payment_method IS DISTINCT FROM 'CASH_ON_DELIVERY'
    OR v_existing_event.status IS DISTINCT FROM 'PROCESSED'
    OR v_existing_event.raw_payload->>'action' IS DISTINCT FROM 'CASH_CONFIRMED'
    OR v_existing_event.raw_payload->>'confirmed_by' IS DISTINCT FROM p_user_id::text
    OR v_existing_event.raw_payload->>'previous_status' IS DISTINCT FROM v_intent.status
    OR v_existing_event.raw_payload->>'new_status' IS DISTINCT FROM 'SUCCEEDED'
    OR coalesce((v_existing_event.raw_payload->>'commission_amount')::numeric, -1) IS DISTINCT FROM v_commission_amount
    OR v_existing_event.raw_payload->>'commission_rule_id' IS DISTINCT FROM v_rule.id::text
  ) THEN
    RAISE EXCEPTION 'CASH_PAYMENT_EVENT_CONFLICT';
  END IF;

  SELECT * INTO v_existing_obligation
    FROM public.financial_obligations
   WHERE id = v_obligation_id
   FOR UPDATE;
  IF FOUND AND (
       v_existing_obligation.tenant_id IS DISTINCT FROM v_intent.tenant_id
    OR v_existing_obligation.business_id IS DISTINCT FROM v_order.business_id
    OR v_existing_obligation.order_id IS DISTINCT FROM v_order.id
    OR v_existing_obligation.payment_intent_id IS DISTINCT FROM v_intent.id::text
    OR v_existing_obligation.beneficiary_type IS DISTINCT FROM 'PLATFORM'
    OR v_existing_obligation.beneficiary_id IS DISTINCT FROM 'PLATFORM'
    OR v_existing_obligation.obligation_type IS DISTINCT FROM 'PLATFORM_COMMISSION'
    OR v_existing_obligation.gross_amount IS DISTINCT FROM v_intent.amount
    OR v_existing_obligation.amount IS DISTINCT FROM v_commission_amount
    OR v_existing_obligation.currency IS DISTINCT FROM v_intent.currency
    OR v_existing_obligation.status IS DISTINCT FROM 'DUE'
    OR v_existing_obligation.payment_method IS DISTINCT FROM 'CASH'
    OR v_existing_obligation.settlement_id IS NOT NULL
    OR v_existing_obligation.settled_at IS NOT NULL
    OR v_existing_obligation.metadata->>'reason' IS DISTINCT FROM 'CUSTOMER_PAID_PROVIDER_DIRECTLY'
    OR v_existing_obligation.metadata->>'commission_rule_id' IS DISTINCT FROM v_rule.id::text
    OR v_existing_obligation.metadata->>'confirmed_by' IS DISTINCT FROM p_user_id::text
    OR coalesce((v_existing_obligation.metadata->>'commission_rate')::numeric, -1) IS DISTINCT FROM coalesce(v_rule.percentage, 0)
  ) THEN
    RAISE EXCEPTION 'CASH_COMMISSION_OBLIGATION_CONFLICT';
  END IF;

  UPDATE public.payment_intents
     SET status = 'SUCCEEDED', updated_at = now()
   WHERE id = v_payment_intent_id;

  IF v_existing_event.id IS NULL THEN
    INSERT INTO public.payment_events (
      id, tenant_id, event_id, payment_id, amount, payment_method, status, raw_payload, created_at
    ) VALUES (
      pg_catalog.gen_random_uuid(), v_intent.tenant_id, v_event_id, p_payment_intent_id,
      v_intent.amount, 'CASH_ON_DELIVERY', 'PROCESSED',
      jsonb_build_object(
        'action', 'CASH_CONFIRMED',
        'confirmed_by', p_user_id,
        'previous_status', v_intent.status,
        'new_status', 'SUCCEEDED',
        'commission_amount', v_commission_amount,
        'commission_rule_id', v_rule.id,
        'timestamp', now()
      ),
      now()
    );
  END IF;

  IF v_existing_obligation.id IS NULL THEN
    INSERT INTO public.financial_obligations (
      id, tenant_id, business_id, order_id, payment_intent_id, beneficiary_type,
      beneficiary_id, obligation_type, gross_amount, amount, currency, status,
      payment_method, metadata
    ) VALUES (
      v_obligation_id, v_intent.tenant_id, v_order.business_id, v_order.id,
      v_intent.id::text, 'PLATFORM', 'PLATFORM', 'PLATFORM_COMMISSION',
      v_intent.amount, v_commission_amount, v_intent.currency, 'DUE', 'CASH',
      jsonb_build_object(
        'reason', 'CUSTOMER_PAID_PROVIDER_DIRECTLY',
        'commission_rule_id', v_rule.id,
        'commission_rate', coalesce(v_rule.percentage, 0),
        'confirmed_by', p_user_id
      )
    );
  END IF;

  SELECT *
    INTO v_intent
    FROM public.payment_intents
   WHERE id = v_payment_intent_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'payment_intent', to_jsonb(v_intent),
    'order', to_jsonb(v_order),
    'commission_obligation', jsonb_build_object(
      'id', v_obligation_id,
      'amount', v_commission_amount,
      'status', 'DUE'
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_cash_payment(character varying, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(character varying, uuid) TO service_role;

COMMENT ON FUNCTION public.confirm_cash_payment(character varying, uuid) IS
  'RC499: service-role-only cash confirmation selects an active payment-authorized membership scoped to the order business/branch; branchless membership is business-wide; only fully unscoped OWNER/ADMIN is tenant-wide.';

COMMIT;
