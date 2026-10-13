-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Source: read-only pg_catalog/information_schema/pg_policies snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NEVER be applied to production.
-- Injected only into a disposable chronological replay before 20260927140500.
-- Schema/policy only; this file creates no data rows or direct access privileges.

create table public.smm_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.smm_services(id),
  target_url text not null,
  quantity bigint not null check (quantity > 0),
  selling_price numeric(18,8) not null check (selling_price >= 0),
  provider_cost numeric(18,8) not null default 0 check (provider_cost >= 0),
  profit numeric(18,8) not null default 0,
  status text not null default 'PENDING'
    check (status = any (array['PENDING','SUBMITTING','PROCESSING','COMPLETED','PARTIAL','CANCELLED','REFUNDED','FAILED']::text[])),
  provider_order_id text,
  provider_status text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index smm_orders_status_idx on public.smm_orders(status, created_at desc);
create index smm_orders_user_idx on public.smm_orders(user_id, created_at desc);
alter table public.smm_orders enable row level security;

create policy smm_orders_owner_insert
  on public.smm_orders
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy smm_orders_owner_read
  on public.smm_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
