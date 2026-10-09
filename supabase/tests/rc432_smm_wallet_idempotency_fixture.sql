-- Disposable PostgreSQL fixture for RC432 integration tests only.
create extension if not exists pgcrypto;
do $roles$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end
$roles$;

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
