-- RC463A: recover the exact live trigger-only SECURITY DEFINER function sources.
-- The functions and enabled triggers were observed in Production, but their
-- creation SQL was absent from the tracked migration history and from the
-- captured Oct-08 schema checkpoint. Restore them before RC463 hardens their ACLs.
--
-- No business rows, memberships, commission rules, or audit rows are modified.

do $preflight$
begin
  if pg_catalog.to_regclass('public.businesses') is null
     or pg_catalog.to_regclass('public.user_memberships') is null
     or pg_catalog.to_regclass('public.commission_rules') is null
     or pg_catalog.to_regclass('public.commission_rule_audit') is null
     or pg_catalog.to_regclass('auth.users') is null then
    raise exception 'RC463A_REQUIRED_RELATION_MISSING';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_memberships'
      and column_name in ('user_id','tenant_id','organization_id','business_id','role','permissions','status')
    group by table_schema,table_name
    having count(*)=8
  ) then
    raise exception 'RC463A_USER_MEMBERSHIP_SCHEMA_MISMATCH';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='commission_rule_audit'
      and column_name in ('commission_rule_id','tenant_id','actor_user_id','action','old_values','new_values')
    group by table_schema,table_name
    having count(*)=6
  ) then
    raise exception 'RC463A_COMMISSION_AUDIT_SCHEMA_MISMATCH';
  end if;

  if exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_assign_default_owner_to_unowned_business'
      and (tgrelid <> 'public.businesses'::regclass
        or tgfoid <> coalesce(pg_catalog.to_regprocedure('public.assign_default_owner_to_unowned_business()')::oid,0))
  ) then
    raise exception 'RC463A_DEFAULT_OWNER_TRIGGER_NAME_COLLISION';
  end if;

  if exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_commission_rules_audit'
      and (tgrelid <> 'public.commission_rules'::regclass
        or tgfoid <> coalesce(pg_catalog.to_regprocedure('public.capture_commission_rule_audit()')::oid,0))
  ) then
    raise exception 'RC463A_COMMISSION_AUDIT_TRIGGER_NAME_COLLISION';
  end if;
end;
$preflight$;

-- Recovered from the live Production function definition observed on 2026-10-31.
-- Keep the established default-owner behavior; RC463 immediately pins search_path
-- to empty and removes direct EXECUTE from all API roles.
create or replace function public.assign_default_owner_to_unowned_business()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_owner_id uuid;
begin
  -- If the creation flow already linked an owner in this transaction, leave it unchanged.
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
  where lower(trim(u.email)) = 'islam.nagy3033@gmail.com'
    and u.email_confirmed_at is not null
  order by u.created_at
  limit 1;

  if v_owner_id is null then
    raise exception 'Default catalog owner account islam.nagy3033@gmail.com was not found or is not confirmed; business creation cancelled to avoid an unowned activity.';
  end if;

  insert into public.user_memberships
    (id, user_id, tenant_id, organization_id, business_id, role, permissions, status)
  values
    (
      'AUTO-BIZ-OWNER-' || replace(gen_random_uuid()::text, '-', ''),
      v_owner_id,
      coalesce(new.tenant_id, 'MNTY-PLATFORM'),
      new.organization_id,
      new.id,
      'BUSINESS_OWNER',
      jsonb_build_object(
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
  if TG_OP = 'INSERT' then
    insert into public.commission_rule_audit(commission_rule_id, tenant_id, actor_user_id, action, new_values)
    values (new.id, new.tenant_id, auth.uid(), 'INSERT',
      to_jsonb(new) - 'created_by' - 'updated_by');
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into public.commission_rule_audit(commission_rule_id, tenant_id, actor_user_id, action, old_values, new_values)
    values (new.id, new.tenant_id, auth.uid(), 'UPDATE',
      to_jsonb(old) - 'created_by' - 'updated_by',
      to_jsonb(new) - 'created_by' - 'updated_by');
    return new;
  else
    insert into public.commission_rule_audit(commission_rule_id, tenant_id, actor_user_id, action, old_values)
    values (old.id, old.tenant_id, auth.uid(), 'DELETE',
      to_jsonb(old) - 'created_by' - 'updated_by');
    return old;
  end if;
end;
$function$;

-- Preserve existing trigger objects and their enablement. Create only when absent.
do $triggers$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_assign_default_owner_to_unowned_business'
      and tgrelid='public.businesses'::regclass
      and not tgisinternal
  ) then
    execute $ddl$
      create constraint trigger trg_assign_default_owner_to_unowned_business
      after insert on public.businesses
      deferrable initially deferred
      for each row
      execute function public.assign_default_owner_to_unowned_business()
    $ddl$;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_commission_rules_audit'
      and tgrelid='public.commission_rules'::regclass
      and not tgisinternal
  ) then
    execute $ddl$
      create trigger trg_commission_rules_audit
      after insert or update or delete on public.commission_rules
      for each row
      execute function public.capture_commission_rule_audit()
    $ddl$;
  end if;
end;
$triggers$;

do $verify$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.assign_default_owner_to_unowned_business()'::regprocedure
      and p.prosecdef and p.prorettype='trigger'::regtype
  ) or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.capture_commission_rule_audit()'::regprocedure
      and p.prosecdef and p.prorettype='trigger'::regtype
  ) then
    raise exception 'RC463A_TRIGGER_FUNCTION_RECOVERY_FAILED';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_assign_default_owner_to_unowned_business'
      and tgrelid='public.businesses'::regclass
      and not tgisinternal and tgenabled='O'
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgname='trg_commission_rules_audit'
      and tgrelid='public.commission_rules'::regclass
      and not tgisinternal and tgenabled='O'
  ) then
    raise exception 'RC463A_EXPECTED_TRIGGER_MISSING_OR_DISABLED';
  end if;
end;
$verify$;
