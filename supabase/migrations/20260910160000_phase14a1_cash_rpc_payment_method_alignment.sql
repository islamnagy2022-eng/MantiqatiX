-- PHASE 14A.1: CASH RPC COMPATIBILITY FIX
-- Aligns confirm_cash_payment with the new payment_method / provider architecture

CREATE OR REPLACE FUNCTION confirm_cash_payment(
    p_payment_intent_id VARCHAR,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_intent RECORD;
    v_order RECORD;
    v_membership RECORD;
    v_user_role TEXT;
    v_is_authorized BOOLEAN := FALSE;
    v_event_id TEXT;
    v_result JSONB;
BEGIN
    -- 0. Identity verification (Direct DB call protection)
    -- If called directly via PostgREST (authenticated), ensure p_user_id matches JWT auth.uid()
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN: User identity mismatch. auth.uid() does not match p_user_id';
    END IF;

    -- 1. Lock and fetch payment intent with FOR UPDATE to prevent race conditions
    SELECT * INTO v_intent
    FROM payment_intents
    WHERE id = p_payment_intent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND: Payment intent % not found', p_payment_intent_id;
    END IF;

    -- 2. Idempotency check: if already succeeded, return success safely
    IF v_intent.status = 'SUCCEEDED' THEN
        SELECT * INTO v_order FROM orders WHERE id = v_intent.order_id;
        RETURN jsonb_build_object(
            'status', 'success',
            'message', 'Already confirmed',
            'payment_intent', to_jsonb(v_intent),
            'order', to_jsonb(v_order)
        );
    END IF;

    -- 3. Enforce valid state machine transition (CREATED or PENDING -> SUCCEEDED)
    IF v_intent.status NOT IN ('CREATED', 'PENDING') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_STATE: Cannot transition payment from status % to SUCCEEDED', v_intent.status;
    END IF;

    -- 4. Verify payment_method is CASH_ON_DELIVERY (replaces provider check)
    IF v_intent.payment_method != 'CASH_ON_DELIVERY' THEN
        RAISE EXCEPTION 'INVALID_METHOD: Only CASH_ON_DELIVERY payment method is permitted for cash confirmation';
    END IF;

    -- 4b. Verify the specific provider for this payment method is enabled for the tenant
    IF NOT EXISTS (
        SELECT 1 FROM tenant_payment_methods 
        WHERE tenant_id = v_intent.tenant_id 
          AND payment_method = 'CASH_ON_DELIVERY' 
          AND provider = v_intent.provider 
          AND is_enabled = true
    ) THEN
        RAISE EXCEPTION 'INVALID_PROVIDER: Provider % is not configured or enabled for CASH_ON_DELIVERY for this tenant', v_intent.provider;
    END IF;

    -- 5. Lock and fetch canonical order with FOR UPDATE
    SELECT * INTO v_order
    FROM orders
    WHERE id = v_intent.order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Associated order % not found', v_intent.order_id;
    END IF;

    IF v_order.tenant_id::text != v_intent.tenant_id::text THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Tenant mismatch between intent and order';
    END IF;

    -- Verify amount and currency consistency
    IF v_intent.amount != v_order.total OR v_intent.currency != v_order.currency THEN
        RAISE EXCEPTION 'FINANCIAL_MISMATCH: Amount or currency mismatch between intent and order';
    END IF;

    -- 6. Authorize user membership & permissions (PAYMENT_CONFIRM_CASH or Staff role, excluding CUSTOMER)
    SELECT role, permissions, status INTO v_membership
    FROM user_memberships
    WHERE user_id = p_user_id AND tenant_id = v_intent.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'FORBIDDEN: User is not a member of this tenant';
    END IF;

    IF v_membership.status IS NOT NULL AND v_membership.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'FORBIDDEN: User membership is not active';
    END IF;

    SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
    
    v_is_authorized := (
        UPPER(COALESCE(v_membership.role, v_user_role, 'CUSTOMER')) IN ('ADMIN', 'MANAGER', 'CASHIER', 'STAFF', 'OWNER')
        OR (v_membership.permissions ? 'PAYMENT_CONFIRM_CASH')
    ) AND UPPER(COALESCE(v_membership.role, v_user_role, 'CUSTOMER')) != 'CUSTOMER';

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions or customer role cannot confirm cash payment';
    END IF;

    -- 7. Perform atomic mutations within the transaction
    -- Only update payment intent, DO NOT forcefully rewind or alter order.status 
    -- as it may already be in OUT_FOR_DELIVERY, DELIVERED, or COMPLETED state.
    UPDATE payment_intents
    SET status = 'SUCCEEDED', updated_at = CURRENT_TIMESTAMP
    WHERE id = p_payment_intent_id;

    -- 8. Record deterministic audit payment event with UNIQUE event_id protection
    v_event_id := 'cash_confirmed:' || p_payment_intent_id;

    -- Insert event with ON CONFLICT DO NOTHING for robust concurrent idempotency
    INSERT INTO payment_events (
        id,
        tenant_id,
        event_id,
        payment_id,
        amount,
        payment_method,
        status,
        raw_payload,
        created_at
    ) VALUES (
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

    -- 9. Fetch final updated records
    SELECT * INTO v_intent FROM payment_intents WHERE id = p_payment_intent_id;
    
    RETURN jsonb_build_object(
        'status', 'success',
        'payment_intent', to_jsonb(v_intent),
        'order', to_jsonb(v_order)
    );
END;
$$;

-- Secure RPC execution: Revoke public execution, restrict to service_role only
REVOKE EXECUTE ON FUNCTION confirm_cash_payment(VARCHAR, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION confirm_cash_payment(VARCHAR, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION confirm_cash_payment(VARCHAR, UUID) FROM authenticated;
