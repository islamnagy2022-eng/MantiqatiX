-- RC459 disposable PostgreSQL fixture. Never run against Production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key);
create table public.user_memberships (
  id uuid primary key,
  user_id uuid not null,
  tenant_id text not null,
  business_id uuid,
  branch_id text,
  role text not null,
  status text not null,
  permissions jsonb not null default '{}'::jsonb
);
create table public.businesses (
  id uuid primary key,
  tenant_id text not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.public_directory_listings (
  id uuid primary key,
  display_name text not null,
  functional_group_id text not null,
  taxonomy_category_id text not null,
  taxonomy_specialty text,
  listing_status text not null default 'PUBLISHED',
  claim_status text not null default 'UNCLAIMED',
  phone text,
  updated_at timestamptz not null default now()
);
