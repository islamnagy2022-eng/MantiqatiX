\set ON_ERROR_STOP on

-- Test-only schema overlay for a known live Production object that is absent
-- from the 2026-10-17 schema-only checkpoint: the deferred default-owner
-- trigger on public.businesses. This is not a migration and is never deployed.
-- Synthetic identity/email only; no Production rows or personal identifiers.

begin;

insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   is_sso_user, is_anonymous)
values
  ('10000000-0000-4000-8000-00000000a001',
   'authenticated', 'authenticated',
   'fixture-owner@example.test', '',
   now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"test_fixture":true,"source":"LIVE_TRIGGER_OVERLAY_FIXTURE"}'::jsonb,
   now(), now(), false, false)
on conflict (id) do nothing;

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

drop trigger if exists trg_assign_default_owner_to_unowned_business
  on public.businesses;

create constraint trigger trg_assign_default_owner_to_unowned_business
after insert on public.businesses
deferrable initially deferred
for each row
execute function public.assign_default_owner_to_unowned_business();

commit;
