-- Disposable fixture for RC442 approval audit atomicity.
create extension if not exists pgcrypto;
create schema if not exists private;

do $roles$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;

create table public.businesses(
  id uuid primary key,
  tenant_id varchar not null,
  status varchar not null,
  updated_at timestamptz not null default now()
);
create table public.user_memberships(
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  permissions jsonb not null default '{}'::jsonb,
  status varchar not null
);
create table public.approval_requests(
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  request_type varchar not null,
  entity_type varchar not null,
  entity_id varchar not null,
  requested_by uuid not null,
  status varchar not null,
  priority varchar not null default 'NORMAL',
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.approval_actions(
  id varchar primary key,
  approval_request_id varchar not null references public.approval_requests(id) on delete cascade,
  action varchar not null,
  acted_by uuid not null,
  comment text,
  created_at timestamptz not null default now()
);
alter table public.approval_actions enable row level security;
grant select,insert,update,delete on public.approval_actions to authenticated;
create policy approval_actions_member_insert on public.approval_actions for insert to authenticated
  with check (acted_by is not null);
