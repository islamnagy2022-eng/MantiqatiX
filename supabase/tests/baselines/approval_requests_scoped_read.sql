-- READ-ONLY CATALOG-DERIVED TEST-ONLY POLICY COMPATIBILITY BASELINE
-- Source: read-only pg_policies catalog query against Supabase project moyhiluyhjsujhwlyeuu on 2026-10-13.
-- This is NOT recovered historical policy-creation DDL and MUST NOT be applied to production.
-- Injected only into disposable replay immediately before migration 20260927140500.
-- No table DDL, grants, revokes, triggers, or data mutations are included.
-- The following migration remains the source for the ordered ALTER POLICY role-boundary change.

CREATE POLICY approval_requests_scoped_read
ON public.approval_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = approval_requests.tenant_id::text
      AND um.status::text = 'ACTIVE'::text
      AND (
        approval_requests.requested_by = auth.uid()
        OR um.role::text = ANY (
          ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'SUPER_ADMIN'::character varying, 'MANAGER'::character varying]::text[]
        )
      )
  )
);
