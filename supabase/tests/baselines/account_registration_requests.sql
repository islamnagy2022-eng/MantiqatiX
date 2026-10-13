-- OWNER-APPROVED TEST-ONLY LIVE-DERIVED REGISTRATION SECURITY BASELINE
-- Source: read-only PostgreSQL catalog introspection of production project moyhiluyhjsujhwlyeuu.
-- Snapshot/approval date: 2026-10-12.
-- NOT recovered historical policy/grant provenance. Never apply this file to production.
-- Inject only into disposable CI after migration 20260927065247 defines the atomic review RPC.
-- This fixture creates policies/grants only; table DDL and indexes are in the earlier schema-only fixture.
-- No production rows or user data are included.

create policy account_registration_requests_platform_review
  on public.account_registration_requests for select to authenticated
  using (
    coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    and exists (
      select 1 from public.user_memberships um
      where um.user_id = (select auth.uid())
        and um.status = 'ACTIVE'
        and um.role = any (array['SUPER_ADMIN','OWNER','ADMIN']::character varying[])
    )
  );

create policy account_registration_requests_self_insert
  on public.account_registration_requests for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'PENDING'
    and coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  );

create policy account_registration_requests_self_select
  on public.account_registration_requests for select to authenticated
  using (
    coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    and (select auth.uid()) = user_id
  );

revoke all on table public.account_registration_requests from public, anon, authenticated, service_role;
grant insert, select on table public.account_registration_requests to authenticated;
grant insert, references, select, trigger, truncate, update
  on table public.account_registration_requests to service_role;
