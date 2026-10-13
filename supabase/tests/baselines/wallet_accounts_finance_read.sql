-- READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE
-- Source: read-only pg_policies catalog snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical policy-creation DDL and MUST NOT be applied to production.
-- Injected only into a fresh disposable replay before 20260927140500.
-- Preserves the observed tenant-scoped finance-role read predicate exactly.
-- No table DDL, grants, or data mutation is included.

CREATE POLICY wallet_accounts_finance_read
ON public.wallet_accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = (SELECT auth.uid())
      AND um.tenant_id::text = wallet_accounts.tenant_id::text
      AND um.status::text = 'ACTIVE'
      AND upper(um.role::text) = ANY (
        ARRAY['OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER']
      )
  )
);
