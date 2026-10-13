-- READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE
-- Source: pg_policies and pg_class catalog inspection of production project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical policy-creation DDL and MUST NOT be applied to production.
-- It creates only the finance-read policy required by the later chronological ALTER POLICY.
-- No table DDL, grants, operational rows, or settlement/payment data are included.

CREATE POLICY settlement_transactions_finance_read
  ON public.settlement_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_memberships um
      WHERE um.user_id = (SELECT auth.uid() AS uid)
        AND um.tenant_id::text = (settlement_transactions.tenant_id)::text
        AND um.status::text = 'ACTIVE'::text
        AND upper((um.role)::text) = ANY (
          ARRAY['OWNER'::text,'ADMIN'::text,'MANAGER'::text,'FINANCE'::text,'ACCOUNTANT'::text,'FINANCE_MANAGER'::text]
        )
    )
  );
