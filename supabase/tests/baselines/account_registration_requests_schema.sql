-- OWNER-APPROVED TEST-ONLY LIVE-DERIVED SCHEMA BASELINE
-- Approved by the project owner on 2026-10-12 for isolated disposable CI replay only.
-- Source: read-only PostgreSQL catalog introspection of production project moyhiluyhjsujhwlyeuu.
-- This is NOT recovered historical creation DDL. Never apply this file to production.
-- Inject only before the first historical function migration that references this table.
-- The pending unique index is intentionally omitted because migration 20260927134000 creates it.
-- This fixture contains schema only: no policies, grants, or production rows.

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

