-- Disposable RC426 fixture for the provider-order-bound finalizer.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create table public.digital_page_orders (
  id uuid primary key,
  user_id uuid not null,
  provider text,
  provider_intent_id text,
  provider_order_id text,
  payment_status text not null default 'CREATED',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Model the older overload so RC426 can explicitly revoke it.
create or replace function public.finalize_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text,
  p_provider_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  return false;
end;
$function$;
