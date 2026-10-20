-- Disposable PostgreSQL fixture for used-item directory RPC integration tests only.
create schema if not exists auth;
do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end
$roles$;

create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create or replace function auth.jwt()
returns jsonb language sql stable
as $function$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$function$;

create table public.used_item_ads (
  id uuid primary key,
  owner_user_id uuid not null,
  tenant_id varchar,
  business_id uuid,
  title varchar not null,
  description text not null,
  category varchar not null,
  price numeric not null,
  seller_name varchar not null,
  seller_phone varchar not null,
  image_url text not null,
  fee_paid numeric not null,
  location varchar not null,
  is_sold boolean not null default false,
  created_at timestamptz not null default now()
);
