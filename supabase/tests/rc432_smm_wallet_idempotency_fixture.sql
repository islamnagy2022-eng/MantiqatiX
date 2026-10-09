-- Disposable PostgreSQL fixture for RC432 integration tests only.
create extension if not exists pgcrypto;
create table public.smm_admins (user_id uuid primary key);

create table public.smm_wallets (
  user_id uuid primary key,
  balance numeric not null default 0,
  updated_at timestamptz not null default now()
);
create table public.smm_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric not null,
  type text not null,
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

-- Production compatibility fixture: legacy RPC signature that RC432 disables for service_role.
create function public.smm_admin_credit_wallet(
  p_actor uuid,
  p_user uuid,
  p_amount numeric,
  p_description text default null
)
returns boolean language sql as $legacy$
  select false;
$legacy$;
grant execute on function public.smm_admin_credit_wallet(uuid,uuid,numeric,text) to service_role;
