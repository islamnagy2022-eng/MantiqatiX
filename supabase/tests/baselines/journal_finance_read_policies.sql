-- READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE
-- Source: read-only pg_policies catalog snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical policy-creation DDL and MUST NOT be applied to production.
-- Injected only into a fresh disposable replay immediately before 20260927140500.
-- Both policies preserve the observed tenant-scoped finance-role read predicates.
-- No table DDL, grants, trigger, or data mutation is included.

CREATE POLICY journal_entries_finance_read
ON public.journal_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = (SELECT auth.uid())
      AND um.tenant_id::text = journal_entries.tenant_id::text
      AND um.status::text = 'ACTIVE'
      AND upper(um.role::text) = ANY (
        ARRAY['OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER']
      )
  )
);

CREATE POLICY journal_entry_lines_finance_read
ON public.journal_entry_lines
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.journal_entries je
    JOIN public.user_memberships um
      ON um.tenant_id::text = je.tenant_id::text
    WHERE je.id::text = journal_entry_lines.journal_entry_id::text
      AND um.user_id = (SELECT auth.uid())
      AND um.status::text = 'ACTIVE'
      AND upper(um.role::text) = ANY (
        ARRAY['OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER']
      )
  )
);
