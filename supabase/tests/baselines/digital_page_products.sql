-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved: 2026-10-14 for disposable migration replay only.
-- Source: read-only PostgreSQL catalog introspection of production public.digital_page_products
-- in Supabase project moyhiluyhjsujhwlyeuu. No product rows were queried or copied.
-- This is NOT recovered historical DDL. The fixture contains current catalog shape only so
-- the disposable replay can continue past an earlier RC256 dependency; it cannot certify clean history.
-- Never apply this file to production and never move it into supabase/migrations in Git.
-- Policies are intentionally omitted: RC228 is their chronological owner.

create table public.digital_page_products (
  id uuid not null default gen_random_uuid(),
  page_type text not null,
  code text not null,
  name_ar text not null,
  description_ar text,
  price numeric(12,2) not null,
  currency text not null default 'EGP',
  duration_days integer,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_page_products_pkey primary key (id),
  constraint digital_page_products_code_key unique (code),
  constraint digital_page_products_page_type_check check (page_type in ('PORTFOLIO','MENU')),
  constraint digital_page_products_price_check check (price >= 0)
);

create index digital_page_products_active_idx
  on public.digital_page_products (page_type, active);

alter table public.digital_page_products enable row level security;
revoke all on table public.digital_page_products from public, anon, authenticated, service_role;
grant references, trigger, truncate on table public.digital_page_products to anon, authenticated, service_role;
