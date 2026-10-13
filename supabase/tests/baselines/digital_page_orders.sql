-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved: 2026-10-14 for disposable migration replay only.
-- Source: read-only PostgreSQL catalog introspection of production public.digital_page_orders
-- in Supabase project moyhiluyhjsujhwlyeuu. No orders, user IDs, or payment payloads were queried.
-- This is NOT recovered historical DDL. It contains the observed current provider-correlation columns,
-- which are later than the original RC228 table definition; this replay is not clean-history certification.
-- Never apply this file to production and never move it into supabase/migrations in Git.
-- Policies are intentionally omitted: RC228 is their chronological owner.

create table public.digital_page_orders (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  target_business_id uuid,
  product_id uuid not null,
  page_type text not null,
  title text not null,
  slug text,
  amount numeric(12,2) not null,
  currency text not null default 'EGP',
  pricing_hash text not null,
  idempotency_key text not null,
  payment_status text not null default 'PENDING',
  fulfillment_status text not null default 'REQUESTED',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text,
  provider_intent_id text,
  provider_order_id text,
  provider_transaction_id text,
  constraint digital_page_orders_pkey primary key (id),
  constraint digital_page_orders_product_id_fkey
    foreign key (product_id) references public.digital_page_products(id),
  constraint digital_page_orders_target_business_id_fkey
    foreign key (target_business_id) references public.businesses(id) on delete set null,
  constraint digital_page_orders_user_id_idempotency_key_key unique (user_id, idempotency_key),
  constraint digital_page_orders_amount_check check (amount >= 0),
  constraint digital_page_orders_page_type_check check (page_type in ('PORTFOLIO','MENU')),
  constraint digital_page_orders_payment_status_check
    check (payment_status in ('PENDING','PAID','FAILED','REFUNDED','CANCELLED')),
  constraint digital_page_orders_fulfillment_status_check
    check (fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED','REJECTED','CANCELLED'))
);

create index digital_page_orders_user_idx on public.digital_page_orders (user_id, created_at desc);
create index digital_page_orders_business_idx on public.digital_page_orders (target_business_id, created_at desc);
create unique index digital_page_orders_provider_intent_uidx
  on public.digital_page_orders (provider, provider_intent_id) where provider_intent_id is not null;
create unique index digital_page_orders_provider_order_uidx
  on public.digital_page_orders (provider, provider_order_id) where provider_order_id is not null;
create index idx_digital_page_orders_product_id on public.digital_page_orders (product_id);

alter table public.digital_page_orders enable row level security;
revoke all on table public.digital_page_orders from public, anon, authenticated, service_role;
grant references, trigger, truncate on table public.digital_page_orders to anon, authenticated, service_role;
