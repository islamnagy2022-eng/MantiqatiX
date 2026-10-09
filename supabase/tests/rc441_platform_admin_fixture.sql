-- Disposable fixture for RC441 platform-admin scope integration tests only.
create extension if not exists pgcrypto;
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;

create table public.user_memberships (
  id text primary key,
  user_id uuid not null,
  tenant_id text not null,
  role text not null,
  status text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
