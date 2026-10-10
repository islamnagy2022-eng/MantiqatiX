-- Disposable PostgreSQL fixture for RC448 financial journal integration tests only.
create extension if not exists pgcrypto;
create schema if not exists auth;
do $roles$
begin
  create role anon;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role;
exception when duplicate_object then null;
end
$roles$;

create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;
create or replace function auth.role()
returns text language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$function$;

create table public.user_memberships (
  user_id uuid not null,
  tenant_id varchar not null,
  role varchar not null,
  status varchar not null
);
create table public.chart_of_accounts (
  id varchar primary key,
  tenant_id varchar not null,
  is_active boolean not null default true
);
create table public.journal_entries (
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  entry_number varchar not null,
  reference_type varchar,
  reference_id varchar,
  description text,
  status varchar not null,
  total_debit numeric not null,
  total_credit numeric not null,
  entry_date date not null,
  posted_at timestamptz not null,
  created_by uuid not null
);
create table public.journal_entry_lines (
  id varchar primary key,
  journal_entry_id varchar not null,
  account_id varchar not null,
  line_number integer not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  description text
);
create table public.general_ledger (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid,
  journal_entry_id varchar not null,
  journal_line_id varchar not null,
  account_id varchar not null,
  debit numeric not null,
  credit numeric not null,
  running_balance numeric not null,
  entry_date date not null,
  posted_at timestamptz not null
);
