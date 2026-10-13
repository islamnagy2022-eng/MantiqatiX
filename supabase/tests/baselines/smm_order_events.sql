-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Source: read-only pg_catalog/information_schema/pg_policies snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NEVER be applied to production.
-- Injected only into a disposable chronological replay before 20260927140500.
-- Schema/policy only: no rows, grants, triggers, or FORCE ROW LEVEL SECURITY are created.

create table public.smm_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.smm_orders(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.smm_order_events enable row level security;

-- The historical ALTER POLICY migration requires this pre-existing live policy.
create policy smm_order_events_owner_read
  on public.smm_order_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.smm_orders o
      where o.id = smm_order_events.order_id
        and o.user_id = (select auth.uid())
    )
  );
