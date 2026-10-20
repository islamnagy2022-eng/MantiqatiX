-- Disposable PostgreSQL fixture for the used-item directory read RPC.
create role anon nologin;
create role authenticated nologin;

create schema if not exists auth;
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
  description text not null default '',
  category varchar not null,
  price numeric not null,
  seller_name varchar not null,
  seller_phone varchar not null,
  image_url text not null default '',
  fee_paid numeric not null default 0,
  location varchar not null default '',
  is_sold boolean not null default false,
  created_at timestamptz not null default now()
);
