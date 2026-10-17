-- Disposable RC426 fixture. Never apply to the live Supabase project.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.digital_page_orders (
  id uuid primary key,
  user_id uuid not null,
  provider text,
  provider_intent_id text,
  provider_order_id text,
  payment_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RC426 replaces the earlier four-argument contract with a five-argument
-- contract that also binds the Paymob provider order ID.
create function public.finalize_digital_page_payment_intent_backend(
  uuid, uuid, text, text
) returns boolean language sql as $$ select false $$;
