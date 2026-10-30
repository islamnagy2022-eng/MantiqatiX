-- Disposable PostgreSQL 16 fixture for RC426 and RC427. Never run against Production.
do $roles$
begin create role anon nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role authenticated nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role service_role nologin; exception when duplicate_object then null; end
$roles$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create table public.digital_page_orders (
  id uuid primary key,
  user_id uuid not null,
  provider text,
  provider_intent_id text,
  provider_order_id text,
  payment_status text not null,
  fulfillment_status text not null default 'PENDING',
  amount numeric(12,2) not null default 0,
  currency text not null default 'EGP',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.finalize_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text,
  p_provider_intent_id text
)
returns boolean language sql security definer
set search_path=''
as $function$
  select false
$function$;

create table public.payment_intents (
  id uuid primary key,
  order_id uuid not null,
  status text not null,
  created_at timestamptz not null default now()
);
