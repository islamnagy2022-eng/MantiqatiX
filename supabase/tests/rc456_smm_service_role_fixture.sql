-- Disposable RC456 fixture mirroring the read-only production schema observed 2026-10-11.
-- Never run against production. This fixture does not synthesize the missing historical migration baseline.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);

create table public.smm_admins(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.smm_providers(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 api_url text not null,
 api_style text not null default 'generic',
 active boolean not null default false,
 priority integer not null default 100,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.smm_services(
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references public.smm_providers(id) on delete cascade,
 external_service_id text not null,
 platform text not null,
 category text not null,
 name text not null,
 description text,
 provider_cost numeric not null default 0 check(provider_cost>=0),
 selling_price numeric not null default 0 check(selling_price>=0),
 min_quantity bigint not null default 1 check(min_quantity>0),
 max_quantity bigint not null default 1000000 check(max_quantity>=min_quantity),
 refill boolean not null default false,
 cancel boolean not null default false,
 dripfeed boolean not null default false,
 active boolean not null default true,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider_id,external_service_id)
);
create table public.smm_orders(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 service_id uuid not null references public.smm_services(id),
 target_url text not null,
 quantity bigint not null check(quantity>0),
 selling_price numeric not null check(selling_price>=0),
 provider_cost numeric not null default 0 check(provider_cost>=0),
 profit numeric not null default 0,
 status text not null check(status in ('PENDING','SUBMITTING','PROCESSING','COMPLETED','PARTIAL','CANCELLED','REFUNDED','FAILED')),
 provider_order_id text,
 provider_status text,
 error_message text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.smm_wallets(
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance numeric not null default 0 check(balance>=0),
 currency text not null default 'USD',
 updated_at timestamptz not null default now()
);
create table public.smm_order_events(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.smm_orders(id) on delete cascade,
 event_type text not null,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.smm_provider_credentials(
 provider_id uuid primary key references public.smm_providers(id) on delete cascade,
 api_key_ciphertext text,
 configured boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.smm_wallet_transactions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 amount numeric not null,
 type text not null check(type in ('CREDIT','DEBIT','REFUND','ADJUSTMENT')),
 reference_id uuid,
 description text,
 created_at timestamptz not null default now()
);
