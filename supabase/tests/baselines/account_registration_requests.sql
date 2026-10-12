-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved by the project owner on 2026-10-12 for isolated disposable CI replay only.
-- Source: read-only PostgreSQL catalog introspection of production project moyhiluyhjsujhwlyeuu.
-- This is a live-derived compatibility bootstrap, NOT recovered historical creation DDL.
-- Never apply this file to production or move it into supabase/migrations.
-- Deliberately omits account_registration_requests_pending_role_uidx because the
-- committed migration 20260927134000 creates it in timestamp order.
-- No production rows or user data are included.

create table public.account_registration_requests (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  requested_role character varying(40) not null,
  status character varying(20) not null default 'PENDING'::character varying,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint account_registration_requests_pkey primary key (id),
  constraint account_registration_requests_requested_role_check
    check (requested_role::text = any (array['CUSTOMER'::character varying, 'SERVICE_PROVIDER'::character varying]::text[])),
  constraint account_registration_requests_status_check
    check (status::text = any (array['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying]::text[])),
  constraint account_registration_requests_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id),
  constraint account_registration_requests_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create index idx_account_registration_requests_reviewed_by
  on public.account_registration_requests using btree (reviewed_by);
create index idx_account_registration_requests_user_status
  on public.account_registration_requests using btree (user_id, status);

alter table public.account_registration_requests enable row level security;

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
