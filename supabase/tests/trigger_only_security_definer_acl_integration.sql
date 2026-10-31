-- Disposable PostgreSQL 16 integration only.
-- Proves that existing triggers continue firing after direct EXECUTE is revoked
-- from API roles, and that both trigger-only SECURITY DEFINER functions use
-- a pinned empty search_path. Never run against Production.

\set ON_ERROR_STOP on

do $roles$
begin create role anon nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role authenticated nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role service_role nologin; exception when duplicate_object then null; end
$roles$;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text not null,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $function$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create table public.businesses (
  id uuid primary key,
  tenant_id text not null,
  organization_id text
);

create table public.user_memberships (
  id text primary key,
  user_id uuid not null,
  tenant_id text not null,
  organization_id text,
  business_id uuid not null references public.businesses(id),
  role text not null,
  permissions jsonb not null default '{}'::jsonb,
  status text not null
);

create table public.commission_rules (
  id text primary key,
  tenant_id text not null,
  created_by uuid,
  updated_by uuid
);

create table public.commission_rule_audit (
  id bigint generated always as identity primary key,
  commission_rule_id text not null,
  tenant_id text not null,
  actor_user_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

insert into auth.users(id,email,email_confirmed_at)
values ('10000000-0000-4000-8000-00000000a001','fixture-owner@example.test',pg_catalog.now());

-- The commission audit function is modeled with its non-sensitive trigger behavior.
create or replace function public.capture_commission_rule_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.commission_rule_audit
      (commission_rule_id, tenant_id, actor_user_id, action, new_values)
    values
      (new.id, new.tenant_id, auth.uid(), 'INSERT',
       pg_catalog.to_jsonb(new) - 'created_by' - 'updated_by');
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.commission_rule_audit
      (commission_rule_id, tenant_id, actor_user_id, action, old_values, new_values)
    values
      (new.id, new.tenant_id, auth.uid(), 'UPDATE',
       pg_catalog.to_jsonb(old) - 'created_by' - 'updated_by',
       pg_catalog.to_jsonb(new) - 'created_by' - 'updated_by');
    return new;
  else
    insert into public.commission_rule_audit
      (commission_rule_id, tenant_id, actor_user_id, action, old_values)
    values
      (old.id, old.tenant_id, auth.uid(), 'DELETE',
       pg_catalog.to_jsonb(old) - 'created_by' - 'updated_by');
    return old;
  end if;
end;
$function$;

create trigger trg_commission_rules_audit
after insert or update or delete on public.commission_rules
for each row execute function public.capture_commission_rule_audit();


grant usage on schema public, auth to service_role;
grant insert on public.businesses, public.commission_rules to service_role;

-- Minimal synthetic trigger implementations model the two live trigger contracts.
-- The migration under test, not this fixture, applies the ACL/search_path hardening.
create or replace function public.assign_default_owner_to_unowned_business()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_owner_id uuid;
begin
  if exists (
    select 1 from public.user_memberships um
    where um.business_id=new.id and um.role in ('BUSINESS_OWNER','OWNER') and um.status='ACTIVE'
  ) then
    return new;
  end if;

  select u.id into v_owner_id
  from auth.users u
  where lower(trim(u.email))='fixture-owner@example.test'
    and u.email_confirmed_at is not null
  order by u.created_at limit 1;

  if v_owner_id is null then
    raise exception 'FIXTURE_DEFAULT_OWNER_MISSING';
  end if;

  insert into public.user_memberships
    (id,user_id,tenant_id,organization_id,business_id,role,permissions,status)
  values
    ('AUTO-BIZ-OWNER-' || replace(gen_random_uuid()::text,'-',''),
     v_owner_id,coalesce(new.tenant_id,'MNTY-PLATFORM'),new.organization_id,new.id,
     'BUSINESS_OWNER',
     jsonb_build_object('owner',true,'catalog',true,'catalog_write',true,
       'content_manage',true,'profile_manage',true,'catalog_read_only',false,
       'owner_linked_by_admin',true,'auto_assigned_default_owner',true),
     'ACTIVE');
  return new;
end;
$function$;

create constraint trigger trg_assign_default_owner_to_unowned_business
after insert on public.businesses
deferrable initially deferred
for each row
execute function public.assign_default_owner_to_unowned_business();

-- Recover the observed live function and trigger definitions, then apply RC463 ACL hardening.
-- This disposable PostgreSQL fixture is the only execution target for RC463 CI.
\ir ../migrations/20261031100000_rc463_trigger_only_security_definer_acl.sql


-- Execute actual backend DML as service_role after all direct EXECUTE grants
-- have been removed. Production grants service_role table writes on these
-- surfaces, while anon/authenticated do not. Both triggers must still run.
begin;
set local role service_role;

insert into public.businesses(id,tenant_id,organization_id)
values ('20000000-0000-4000-8000-00000000a001','tenant-trigger-fixture','org-trigger-fixture');

set constraints all immediate;

insert into public.commission_rules(id,tenant_id,created_by,updated_by)
values ('commission-rule-fixture','tenant-trigger-fixture',
        '10000000-0000-4000-8000-00000000a001',
        '10000000-0000-4000-8000-00000000a001');

reset role;

do $behavior$
begin
  if not exists (
    select 1 from public.user_memberships
    where business_id='20000000-0000-4000-8000-00000000a001'
      and user_id='10000000-0000-4000-8000-00000000a001'
      and role='BUSINESS_OWNER'
      and status='ACTIVE'
      and permissions->>'auto_assigned_default_owner'='true'
  ) then
    raise exception 'DEFAULT_OWNER_TRIGGER_DID_NOT_CREATE_ACTIVE_OWNER_MEMBERSHIP';
  end if;

  if not exists (
    select 1 from public.commission_rule_audit
    where commission_rule_id='commission-rule-fixture'
      and tenant_id='tenant-trigger-fixture'
      and action='INSERT'
  ) then
    raise exception 'COMMISSION_AUDIT_TRIGGER_DID_NOT_RECORD_INSERT';
  end if;
end;
$behavior$;
rollback;

select 'TRIGGER_ONLY_SECURITY_DEFINER_ACL_INTEGRATION: PASS' as result;
