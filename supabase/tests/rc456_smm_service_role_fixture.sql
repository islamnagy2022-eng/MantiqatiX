-- Disposable RC456 fixture. Never run against production.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create table public.smm_admins(user_id uuid primary key);
create table public.smm_providers(id uuid primary key,name text not null,api_url text not null,active boolean not null default true,priority integer not null default 0);
create table public.smm_services(
 id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.smm_providers(id),
 external_service_id text not null,platform text not null,category text not null,name text not null,description text,
 provider_cost numeric not null default 0,selling_price numeric not null default 0,
 min_quantity bigint not null default 1,max_quantity bigint not null default 1000000,
 refill boolean not null default false,cancel boolean not null default false,dripfeed boolean not null default false,
 active boolean not null default true,metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.smm_orders(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,service_id uuid not null references public.smm_services(id),
 target_url text not null,quantity bigint not null,selling_price numeric not null,provider_cost numeric not null,profit numeric not null,
 status text not null,provider_order_id text,provider_status text,error_message text,metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.smm_wallets(user_id uuid primary key,balance numeric not null default 0,currency text not null default 'EGP',updated_at timestamptz not null default now());
create table public.smm_order_events(id uuid primary key default gen_random_uuid(),order_id uuid not null,event_type text not null,payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table public.smm_provider_credentials(id uuid primary key default gen_random_uuid(),provider_id uuid not null,secret_ciphertext text not null);
create table public.smm_wallet_transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null,amount numeric not null);
