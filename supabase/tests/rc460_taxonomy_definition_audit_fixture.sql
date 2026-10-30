-- RC460 disposable PostgreSQL fixture only.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key);

create table public.bizcatalog_platform_settings (
  settings_key text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
