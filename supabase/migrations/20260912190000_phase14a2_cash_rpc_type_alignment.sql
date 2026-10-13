-- PHASE 14A.2: CASH RPC TYPE ALIGNMENT
-- Fixes UUID/VARCHAR mismatches introduced by Phase 14A.1.
-- No schema tables are modified.
-- No order status mutation is performed.
-- RPC remains SECURITY DEFINER and service_role-only.

CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
    p_payment_intent_id VARCHAR,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_intent_id UUID;
    v_intent RECORD;
    v_order RECORD;
    v_membership RECORD;
    v_user_role TEXT;
    v_is_authorized BOOLEAN := FALSE;
    v_event_id TEXT;
BEGIN
    BEGIN
        v_payment_intent_id := p_payment_intent_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_INTENT_ID: Invalid UUID';
    END;

    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN: User identity mismatch. auth.uid() does not match p_user_id';
    END IF;

    SELECT *
    INTO v_intent
    FROM public.payment_intents
    WHERE id = v_payment_intent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'PAYMENT_INTENT_NOT_FOUND: Payment intent % not found',
            p_payment_intent_id;
    END IF;

    IF v_intent.status = 'SUCCEEDED' THEN
        SELECT *
        INTO v_order
        FROM public.orders
        WHERE id = v_intent.order_id;

        RETURN jsonb_build_object(
            'status', 'success',
            'message', 'Already confirmed',
            'payment_intent', to_jsonb(v_intent),
            'order', to_jsonb(v_order)
        );
    END IF;

    IF v_intent.status NOT IN ('CREATED', 'PENDING') THEN
        RAISE EXCEPTION
            'INVALID_PAYMENT_STATE: Cannot transition payment from status % to SUCCEEDED',
            v_intent.status;
    END IF;

    IF v_intent.payment_method != 'CASH_ON_DELIVERY' THEN
        RAISE EXCEPTION
            'INVALID_METHOD: Only CASH_ON_DELIVERY payment method is permitted for cash confirmation';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.tenant_payment_methods tpm
        WHERE tpm.tenant_id = v_intent.tenant_id::TEXT
          AND tpm.payment_method = 'CASH_ON_DELIVERY'
          AND tpm.provider = v_intent.provider
          AND tpm.is_enabled = TRUE
    ) THEN
        RAISE EXCEPTION
            'INVALID_PROVIDER: Provider % is not configured or enabled for CASH_ON_DELIVERY for this tenant',
            v_intent.provider;
    END IF;

    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = v_intent.order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'ORDER_NOT_FOUND: Associated order % not found',
            v_intent.order_id;
    END IF;

    IF v_order.tenant_id::TEXT != v_intent.tenant_id::TEXT THEN
        RAISE EXCEPTION
            'TENANT_MISMATCH: Tenant mismatch between intent and order';
    END IF;

    IF v_intent.amount != v_order.total
       OR v_intent.currency != v_order.currency THEN
        RAISE EXCEPTION
            'FINANCIAL_MISMATCH: Amount or currency mismatch between intent and order';
    END IF;

    SELECT role, permissions, status
    INTO v_membership
    FROM public.user_memberships
    WHERE user_id = p_user_id
      AND tenant_id = v_intent.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'FORBIDDEN: User is not a member of this tenant';
    END IF;

    IF v_membership.status IS NOT NULL
       AND v_membership.status != 'ACTIVE' THEN
        RAISE EXCEPTION
            'FORBIDDEN: User membership is not active';
    END IF;

    SELECT role
    INTO v_user_role
    FROM public.users
    WHERE id = p_user_id;

    v_is_authorized := (
        UPPER(
            COALESCE(
                v_membership.role,
                v_user_role,
                'CUSTOMER'
            )
        ) IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF', 'OWNER')
        OR (
            COALESCE(v_membership.permissions, '{}'::jsonb)
            ? 'PAYMENT_CONFIRM_CASH'
        )
    )
    AND UPPER(
        COALESCE(
            v_membership.role,
            v_user_role,
            'CUSTOMER'
        )
    ) != 'CUSTOMER';

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION
            'FORBIDDEN: Insufficient permissions or customer role cannot confirm cash payment';
    END IF;

    UPDATE public.payment_intents
    SET
        status = 'SUCCEEDED',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_payment_intent_id;

    v_event_id := 'cash_confirmed:' || v_payment_intent_id::TEXT;

    INSERT INTO public.payment_events (
        id,
        tenant_id,
        event_id,
        payment_id,
        amount,
        payment_method,
        status,
        raw_payload,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        v_intent.tenant_id,
        v_event_id,
        p_payment_intent_id,
        v_intent.amount,
        'CASH_ON_DELIVERY',
        'PROCESSED',
        jsonb_build_object(
            'action', 'CASH_CONFIRMED',
            'confirmed_by', p_user_id,
            'previous_status', v_intent.status,
            'new_status', 'SUCCEEDED',
            'timestamp', CURRENT_TIMESTAMP
        ),
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (event_id) DO NOTHING;

    SELECT *
    INTO v_intent
    FROM public.payment_intents
    WHERE id = v_payment_intent_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'payment_intent', to_jsonb(v_intent),
        'order', to_jsonb(v_order)
    );
END;
$$;

REVOKE EXECUTE
ON FUNCTION public.confirm_cash_payment(VARCHAR, UUID)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.confirm_cash_payment(VARCHAR, UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.confirm_cash_payment(VARCHAR, UUID)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.confirm_cash_payment(VARCHAR, UUID)
TO service_role;
