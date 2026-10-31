-- Disposable PostgreSQL 16 integration only.
-- Proves that existing triggers continue firing after direct EXECUTE is revoked
-- from API roles, and that both trigger-only SECURITY DEFINER functions use
-- a pinned empty search_path. Never run against Production.

\\set ON_ERROR_STOP on

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

create or replace function public.assign_default_owner_to_unowned_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid;
begin
  if exists (
    select 1
    from public.user_memberships um
    where um.business_id = new.id
      and um.role in ('BUSINESS_OWNER', 'OWNER')
      and um.status = 'ACTIVE'
  ) then
    return new;
  end if;

  select u.id
    into v_owner_id
  from auth.users u
  where pg_catalog.lower(pg_catalog.btrim(u.email)) = 'fixture-owner@example.test'
    and u.email_confirmed_at is not null
  order by u.created_at
  limit 1;

  if v_owner_id is null then
    raise exception 'Default fixture owner account was not found or is not confirmed';
  end if;

  insert into public.user_memberships
    (id, user_id, tenant_id, organization_id, business_id, role, permissions, status)
  values
    (
      'AUTO-BIZ-OWNER-' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      v_owner_id,
      coalesce(new.tenant_id, 'MNTY-PLATFORM'),
      new.organization_id,
      new.id,
      'BUSINESS_OWNER',
      pg_catalog.jsonb_build_object(
        'owner', true,
        'catalog', true,
        'catalog_write', true,
        'content_manage', true,
        'profile_manage', true,
        'catalog_read_only', false,
        'owner_linked_by_admin', true,
        'auto_assigned_default_owner', true
      ),
      'ACTIVE'
    );

  return new;
end;
$function$;

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

-- Create both triggers while the creating owner has EXECUTE.
create constraint trigger trg_assign_default_owner_to_unowned_business
after insert on public.businesses
deferrable initially deferred
for each row
execute function public.assign_default_owner_to_unowned_business();

create trigger trg_commission_rules_audit
after insert or update or delete on public.commission_rules
for each row
execute function public.capture_commission_rule_audit();

grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant insert on public.businesses, public.commission_rules to authenticated;

-- These are trigger-only functions, not client/server RPC entrypoints.
-- Explicitly remove inherited PUBLIC and direct API-role EXECUTE.
revoke all on function public.assign_default_owner_to_unowned_business()
  from public, anon, authenticated, service_role;
revoke all on function public.capture_commission_rule_audit()
  from public, anon, authenticated, service_role;

do $acl$
declare
  v_function oid;
begin
  foreach v_function in array array[
    'public.assign_default_owner_to_unowned_business()'::regprocedure::oid,
    'public.capture_commission_rule_audit()'::regprocedure::oid
  ] loop
    if has_function_privilege('anon', v_function, 'EXECUTE')
       or has_function_privilege('authenticated', v_function, 'EXECUTE')
       or has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'TRIGGER_ONLY_FUNCTION_STILL_EXECUTABLE_BY_API_ROLE: %',v_function::regprocedure;
    end if;

    if exists (
      select 1
      from pg_catalog.aclexplode((select p.proacl from pg_catalog.pg_proc p where p.oid=v_function)) a
      where a.grantee=0 and a.privilege_type='EXECUTE'
    ) then
      raise exception 'TRIGGER_ONLY_FUNCTION_STILL_EXECUTABLE_BY_PUBLIC: %',v_function::regprocedure;
    end if;

    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid=v_function
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception 'TRIGGER_ONLY_FUNCTION_SEARCH_PATH_NOT_EMPTY: %',v_function::regprocedure;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_assign_default_owner_to_unowned_business'
      and tgrelid='public.businesses'::regclass
      and not tgisinternal and tgenabled='O'
  ) then raise exception 'DEFAULT_OWNER_TRIGGER_NOT_ENABLED'; end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_commission_rules_audit'
      and tgrelid='public.commission_rules'::regclass
      and not tgisinternal and tgenabled='O'
  ) then raise exception 'COMMISSION_AUDIT_TRIGGER_NOT_ENABLED'; end if;
end;
$acl$;

-- Execute actual DML as authenticated after all direct EXECUTE grants have
-- been removed. The deferred owner trigger and immediate audit trigger must
-- still run as their SECURITY DEFINER owners.
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-00000000a001',true);

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
      and actor_user_id='10000000-0000-4000-8000-00000000a001'
      and action='INSERT'
  ) then
    raise exception 'COMMISSION_AUDIT_TRIGGER_DID_NOT_RECORD_INSERT';
  end if;
end;
$behavior$;
rollback;

select 'TRIGGER_ONLY_SECURITY_DEFINER_ACL_INTEGRATION: PASS' as result;
