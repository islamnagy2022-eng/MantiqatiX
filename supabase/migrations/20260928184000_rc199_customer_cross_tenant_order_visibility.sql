-- RC199: allow a customer to read only their own marketplace orders across provider tenants.
-- Read-only browser access; no client INSERT/UPDATE/DELETE privileges are added.
-- This file is an unapplied repository candidate: production's captured migration-version ledger
-- contains 20260928154411 (which creates the history policy) but not this file's 20260928184000 version.
-- Keep the policy operations idempotent and fail closed if an existing same-name policy has a different contract.

grant select on public.orders to authenticated;
grant select on public.order_status_history to authenticated;

DO $orders_customer_policy$
DECLARE
  v_existing record;
BEGIN
  SELECT cmd, roles, qual, permissive
  INTO v_existing
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'orders'
    AND policyname = 'orders_customer_select_own';

  IF FOUND THEN
    IF v_existing.cmd <> 'SELECT'
       OR v_existing.roles <> ARRAY['authenticated'::name]
       OR v_existing.permissive <> 'PERMISSIVE'
       OR v_existing.qual IS NULL
       OR position('customer_id = auth.uid()' IN v_existing.qual) = 0
       OR position('is_anonymous' IN v_existing.qual) = 0 THEN
      RAISE EXCEPTION 'orders_customer_select_own_policy_contract_mismatch';
    END IF;
  ELSE
    EXECUTE $create_policy$
      CREATE POLICY orders_customer_select_own
      ON public.orders
      FOR SELECT
      TO authenticated
      USING (
        coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
        AND customer_id = auth.uid()
      )
    $create_policy$;
  END IF;
END;
$orders_customer_policy$;

-- The immediately preceding applied migration 20260928154411 already creates this exact
-- history policy. Reuse it when present; create it only if absent in a disposable baseline.
DO $order_history_customer_policy$
DECLARE
  v_existing record;
BEGIN
  SELECT cmd, roles, qual, permissive
  INTO v_existing
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'order_status_history'
    AND policyname = 'order_status_history_customer_select_own';

  IF FOUND THEN
    IF v_existing.cmd <> 'SELECT'
       OR v_existing.roles <> ARRAY['authenticated'::name]
       OR v_existing.permissive <> 'PERMISSIVE'
       OR v_existing.qual IS NULL
       OR position('order_status_history.order_id' IN v_existing.qual) = 0
       OR position('o.id' IN v_existing.qual) = 0
       OR position('o.customer_id = auth.uid()' IN v_existing.qual) = 0
       OR position('is_anonymous' IN v_existing.qual) = 0 THEN
      RAISE EXCEPTION 'order_status_history_customer_select_own_policy_contract_mismatch';
    END IF;
  ELSE
    EXECUTE $create_policy$
      CREATE POLICY order_status_history_customer_select_own
      ON public.order_status_history
      FOR SELECT
      TO authenticated
      USING (
        coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
        AND EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.id = order_status_history.order_id
            AND o.customer_id = auth.uid()
        )
      )
    $create_policy$;
  END IF;
END;
$order_history_customer_policy$;
