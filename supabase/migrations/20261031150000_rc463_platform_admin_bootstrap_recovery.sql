-- RC463: repair platform-root bootstrap and add audited grant/revocation lifecycle.
-- Forward-only. Does not seed, update, or remove any Production platform-admin identity.
-- Keep all lifecycle mutation behind service_role-authenticated Edge Function calls.

begin;

grant usage on schema private to service_role;

create table if not exists private.platform_admin_lifecycle_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_type text not null check (event_type in ('BOOTSTRAP','GRANTED','REVOKED')),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null,
  tenant_id varchar not null,
  reason text not null,
  actor_source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

alter table private.platform_admin_lifecycle_events enable row level security;
alter table private.platform_admin_lifecycle_events force row level security;
drop policy if exists mnty_deny_platform_admin_lifecycle_events on private.platform_admin_lifecycle_events;
create policy mnty_deny_platform_admin_lifecycle_events
on private.platform_admin_lifecycle_events
as restrictive
for all to anon, authenticated
using (false)
with check (false);

revoke all on table private.platform_admin_lifecycle_events from public, anon, authenticated;
grant select, insert on table private.platform_admin_lifecycle_events to service_role;

create or replace function private.bootstrap_platform_admin(
  p_user_id uuid,
  p_tenant_id varchar default 'MNTY-PLATFORM',
  p_tenant_name varchar default 'MNTY Platform',
  p_tenant_code varchar default 'MNTY'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email_confirmed_at timestamptz;
  v_banned_until timestamptz;
  v_deleted_at timestamptz;
  v_is_anonymous boolean;
  v_tenant_status varchar;
  v_membership_count integer;
  v_membership_id varchar;
  v_tenant_created boolean := false;
begin
  if p_user_id is null then
    raise exception 'PLATFORM_BOOTSTRAP_USER_REQUIRED';
  end if;
  if p_tenant_id is distinct from 'MNTY-PLATFORM'
     or p_tenant_code is distinct from 'MNTY'
     or nullif(pg_catalog.btrim(coalesce(p_tenant_name,'')),'') is null then
    raise exception 'PLATFORM_BOOTSTRAP_CANONICAL_TENANT_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mantiqatix:platform-admin-lifecycle', 0)
  );
  lock table private.platform_admins in exclusive mode;

  if exists (select 1 from private.platform_admins) then
    raise exception 'PLATFORM_BOOTSTRAP_ALREADY_INITIALIZED';
  end if;

  select u.email_confirmed_at, u.is_anonymous, u.banned_until, u.deleted_at
    into v_email_confirmed_at, v_is_anonymous, v_banned_until, v_deleted_at
    from auth.users u
   where u.id = p_user_id
   for key share;

  if not found then
    raise exception 'PLATFORM_BOOTSTRAP_AUTH_USER_NOT_FOUND';
  end if;
  if v_is_anonymous or v_email_confirmed_at is null
     or v_deleted_at is not null
     or (v_banned_until is not null and v_banned_until > pg_catalog.now()) then
    raise exception 'PLATFORM_BOOTSTRAP_AUTH_USER_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.code <> p_tenant_code
  ) or exists (
    select 1 from public.tenants t
    where t.code = p_tenant_code and t.id <> p_tenant_id
  ) then
    raise exception 'PLATFORM_BOOTSTRAP_TENANT_ID_CODE_CONFLICT';
  end if;

  select t.status into v_tenant_status
    from public.tenants t
   where t.id = p_tenant_id
   for update;

  if not found then
    insert into public.tenants(id, name, code, status, settings)
    values (p_tenant_id, pg_catalog.btrim(p_tenant_name), p_tenant_code, 'ACTIVE', '{}'::jsonb);
    v_tenant_created := true;
    v_tenant_status := 'ACTIVE';
  elsif upper(coalesce(v_tenant_status,'')) <> 'ACTIVE' then
    raise exception 'PLATFORM_BOOTSTRAP_TENANT_NOT_ACTIVE';
  end if;

  select count(*) into v_membership_count
    from public.user_memberships m
   where m.user_id = p_user_id
     and m.tenant_id = p_tenant_id
     and upper(m.role) = 'SUPER_ADMIN'
     and m.business_id is null
     and m.branch_id is null;

  if v_membership_count > 1 then
    raise exception 'PLATFORM_BOOTSTRAP_MULTIPLE_ROOT_MEMBERSHIPS';
  elsif v_membership_count = 1 then
    update public.user_memberships
       set status = 'ACTIVE',
           permissions = pg_catalog.jsonb_build_object('scope','PLATFORM','full_control',true)
     where user_id = p_user_id
       and tenant_id = p_tenant_id
       and upper(role) = 'SUPER_ADMIN'
       and business_id is null
       and branch_id is null;
    select m.id into v_membership_id
      from public.user_memberships m
     where m.user_id = p_user_id
       and m.tenant_id = p_tenant_id
       and upper(m.role) = 'SUPER_ADMIN'
       and m.business_id is null
       and m.branch_id is null
     order by m.created_at asc, m.id asc
     limit 1;
  else
    v_membership_id := pg_catalog.gen_random_uuid()::text;
    insert into public.user_memberships(
      id, user_id, tenant_id, business_id, branch_id, role, permissions, status
    ) values (
      v_membership_id, p_user_id, p_tenant_id, null, null, 'SUPER_ADMIN',
      pg_catalog.jsonb_build_object('scope','PLATFORM','full_control',true), 'ACTIVE'
    );
  end if;

  insert into private.platform_admins(user_id) values (p_user_id);

  insert into private.platform_admin_lifecycle_events(
    event_type, actor_user_id, target_user_id, tenant_id, reason, actor_source, metadata
  ) values (
    'BOOTSTRAP', null, p_user_id, p_tenant_id,
    'Initial platform-root bootstrap through the privileged service-role path',
    'SERVICE_ROLE_BOOTSTRAP',
    pg_catalog.jsonb_build_object(
      'tenant_created', v_tenant_created,
      'membership_id', v_membership_id,
      'membership_scope', 'PLATFORM'
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 'BOOTSTRAPPED',
    'tenant_id', p_tenant_id,
    'membership_id', v_membership_id
  );
end;
$function$;

revoke all on function private.bootstrap_platform_admin(uuid, varchar, varchar, varchar)
  from public, anon, authenticated;
grant execute on function private.bootstrap_platform_admin(uuid, varchar, varchar, varchar)
  to service_role;

create or replace function private.grant_platform_admin(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email_confirmed_at timestamptz;
  v_banned_until timestamptz;
  v_deleted_at timestamptz;
  v_is_anonymous boolean;
  v_tenant_status varchar;
  v_membership_count integer;
  v_membership_id varchar;
begin
  if p_actor_user_id is null or p_target_user_id is null then
    raise exception 'PLATFORM_ADMIN_ACTOR_AND_TARGET_REQUIRED';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'PLATFORM_ADMIN_SELF_GRANT_NOT_ALLOWED';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) < 10
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) > 500 then
    raise exception 'PLATFORM_ADMIN_REASON_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mantiqatix:platform-admin-lifecycle', 0)
  );
  lock table private.platform_admins in exclusive mode;

  if not exists (
    select 1 from private.platform_admins pa where pa.user_id = p_actor_user_id
  ) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;

  if exists (
    select 1 from private.platform_admins pa where pa.user_id = p_target_user_id
  ) then
    return pg_catalog.jsonb_build_object('ok', true, 'status', 'ALREADY_PLATFORM_ADMIN');
  end if;

  select u.email_confirmed_at, u.is_anonymous, u.banned_until, u.deleted_at
    into v_email_confirmed_at, v_is_anonymous, v_banned_until, v_deleted_at
    from auth.users u
   where u.id = p_target_user_id
   for key share;

  if not found then
    raise exception 'PLATFORM_ADMIN_TARGET_USER_NOT_FOUND';
  end if;
  if v_is_anonymous or v_email_confirmed_at is null
     or v_deleted_at is not null
     or (v_banned_until is not null and v_banned_until > pg_catalog.now()) then
    raise exception 'PLATFORM_ADMIN_TARGET_USER_NOT_ELIGIBLE';
  end if;

  select t.status into v_tenant_status
    from public.tenants t
   where t.id = 'MNTY-PLATFORM' and t.code = 'MNTY'
   for update;

  if not found or upper(coalesce(v_tenant_status,'')) <> 'ACTIVE' then
    raise exception 'PLATFORM_ADMIN_CANONICAL_TENANT_UNAVAILABLE';
  end if;

  select count(*) into v_membership_count
    from public.user_memberships m
   where m.user_id = p_target_user_id
     and m.tenant_id = 'MNTY-PLATFORM'
     and upper(m.role) = 'SUPER_ADMIN'
     and m.business_id is null
     and m.branch_id is null;

  if v_membership_count > 1 then
    raise exception 'PLATFORM_ADMIN_MULTIPLE_ROOT_MEMBERSHIPS';
  elsif v_membership_count = 1 then
    update public.user_memberships
       set status = 'ACTIVE',
           permissions = pg_catalog.jsonb_build_object('scope','PLATFORM','full_control',true)
     where user_id = p_target_user_id
       and tenant_id = 'MNTY-PLATFORM'
       and upper(role) = 'SUPER_ADMIN'
       and business_id is null
       and branch_id is null;
    select m.id into v_membership_id
      from public.user_memberships m
     where m.user_id = p_target_user_id
       and m.tenant_id = 'MNTY-PLATFORM'
       and upper(m.role) = 'SUPER_ADMIN'
       and m.business_id is null
       and m.branch_id is null
     order by m.created_at asc, m.id asc
     limit 1;
  else
    v_membership_id := pg_catalog.gen_random_uuid()::text;
    insert into public.user_memberships(
      id, user_id, tenant_id, business_id, branch_id, role, permissions, status
    ) values (
      v_membership_id, p_target_user_id, 'MNTY-PLATFORM', null, null, 'SUPER_ADMIN',
      pg_catalog.jsonb_build_object('scope','PLATFORM','full_control',true), 'ACTIVE'
    );
  end if;

  insert into private.platform_admins(user_id) values (p_target_user_id);

  insert into private.platform_admin_lifecycle_events(
    event_type, actor_user_id, target_user_id, tenant_id, reason, actor_source, metadata
  ) values (
    'GRANTED', p_actor_user_id, p_target_user_id, 'MNTY-PLATFORM',
    pg_catalog.btrim(p_reason), 'AUTHENTICATED_PLATFORM_ADMIN_EDGE',
    pg_catalog.jsonb_build_object('membership_id',v_membership_id,'membership_scope','PLATFORM')
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'status', 'GRANTED',
    'target_user_id', p_target_user_id, 'membership_id', v_membership_id
  );
end;
$function$;

revoke all on function private.grant_platform_admin(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.grant_platform_admin(uuid, uuid, text)
  to service_role;

create or replace function private.revoke_platform_admin(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_count integer;
  v_membership_count integer;
begin
  if p_actor_user_id is null or p_target_user_id is null then
    raise exception 'PLATFORM_ADMIN_ACTOR_AND_TARGET_REQUIRED';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'PLATFORM_ADMIN_SELF_REVOCATION_NOT_ALLOWED';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) < 10
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) > 500 then
    raise exception 'PLATFORM_ADMIN_REASON_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mantiqatix:platform-admin-lifecycle', 0)
  );
  lock table private.platform_admins in exclusive mode;

  if not exists (
    select 1 from private.platform_admins pa where pa.user_id = p_actor_user_id
  ) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if not exists (
    select 1 from private.platform_admins pa where pa.user_id = p_target_user_id
  ) then
    raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND';
  end if;

  select count(*) into v_admin_count from private.platform_admins;
  if v_admin_count <= 1 then
    raise exception 'PLATFORM_ADMIN_LAST_ROOT_CANNOT_BE_REVOKED';
  end if;

  select count(*) into v_membership_count
    from public.user_memberships m
   where m.user_id = p_target_user_id
     and m.tenant_id = 'MNTY-PLATFORM'
     and upper(m.role) = 'SUPER_ADMIN'
     and m.business_id is null
     and m.branch_id is null
     and m.status = 'ACTIVE';

  if v_membership_count = 0 then
    raise exception 'PLATFORM_ADMIN_ROOT_MEMBERSHIP_NOT_FOUND';
  end if;

  update public.user_memberships
     set status = 'INACTIVE',
         permissions = pg_catalog.jsonb_build_object('scope','PLATFORM','full_control',false)
   where user_id = p_target_user_id
     and tenant_id = 'MNTY-PLATFORM'
     and upper(role) = 'SUPER_ADMIN'
     and business_id is null
     and branch_id is null
     and status = 'ACTIVE';

  delete from private.platform_admins where user_id = p_target_user_id;

  insert into private.platform_admin_lifecycle_events(
    event_type, actor_user_id, target_user_id, tenant_id, reason, actor_source, metadata
  ) values (
    'REVOKED', p_actor_user_id, p_target_user_id, 'MNTY-PLATFORM',
    pg_catalog.btrim(p_reason), 'AUTHENTICATED_PLATFORM_ADMIN_EDGE',
    pg_catalog.jsonb_build_object('deactivated_platform_memberships',v_membership_count)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'status', 'REVOKED',
    'target_user_id', p_target_user_id,
    'deactivated_platform_memberships', v_membership_count
  );
end;
$function$;

revoke all on function private.revoke_platform_admin(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.revoke_platform_admin(uuid, uuid, text)
  to service_role;

comment on table private.platform_admin_lifecycle_events is
  'RC463: private audit trail for initial platform bootstrap, privileged platform-admin grants, and revocations. Never expose through client roles.';
comment on function private.bootstrap_platform_admin(uuid, varchar, varchar, varchar) is
  'RC463: one-time service-role-only bootstrap. Reuses only the canonical MNTY-PLATFORM tenant (code MNTY); never creates a parallel platform tenant.';
comment on function private.grant_platform_admin(uuid, uuid, text) is
  'RC463: service-role-only grant, called only by a JWT-authenticated Edge Function after verifying the actor in private.platform_admins.';
comment on function private.revoke_platform_admin(uuid, uuid, text) is
  'RC463: service-role-only revocation; deactivates platform SUPER_ADMIN membership and removes registry authority atomically, preserving at least one root admin.';

commit;
