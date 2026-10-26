-- RC113: Super Admin Control Center foundation.
-- Dynamic, auditable custom roles and scoped assignments. Platform authority remains
-- anchored to private.platform_admins; no browser service_role access is introduced.

create table if not exists public.platform_custom_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  display_name text not null,
  description text not null default '',
  scope text not null check (scope in ('PLATFORM','TENANT','BUSINESS','BRANCH','PROVIDER')),
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_custom_roles_key_format check (role_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint platform_custom_roles_permissions_object check (jsonb_typeof(permissions) = 'object')
);

create table if not exists public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.platform_custom_roles(id) on delete restrict,
  tenant_id varchar null references public.tenants(id) on delete restrict,
  business_id uuid null references public.businesses(id) on delete restrict,
  branch_id varchar null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_role_assignment_scope check (
    (tenant_id is null and business_id is null and branch_id is null) or tenant_id is not null
  )
);

create unique index if not exists platform_role_assignments_active_unique
  on public.platform_role_assignments(user_id, role_id, coalesce(tenant_id, ''), coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(branch_id, ''))
  where is_active;
create index if not exists platform_role_assignments_user_scope_idx
  on public.platform_role_assignments(user_id, tenant_id, business_id, branch_id)
  where is_active;

alter table public.platform_custom_roles enable row level security;
alter table public.platform_custom_roles force row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.platform_role_assignments force row level security;

-- No direct table writes/reads from browser roles. All access goes through guarded RPCs.
revoke all on public.platform_custom_roles from anon, authenticated;
revoke all on public.platform_role_assignments from anon, authenticated;

create or replace function public.mnty_platform_admin_list_custom_roles()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from private.platform_admins pa where pa.user_id = v_actor) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'role_key', r.role_key, 'display_name', r.display_name,
      'description', r.description, 'scope', r.scope, 'permissions', r.permissions,
      'is_system', r.is_system, 'is_active', r.is_active,
      'created_at', r.created_at, 'updated_at', r.updated_at
    ) order by r.is_system desc, r.display_name)
    from public.platform_custom_roles r
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.mnty_platform_admin_upsert_custom_role(
  p_role_key text,
  p_display_name text,
  p_description text,
  p_scope text,
  p_permissions jsonb,
  p_role_id uuid default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role public.platform_custom_roles%rowtype;
  v_old jsonb := '{}'::jsonb;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from private.platform_admins pa where pa.user_id = v_actor) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if nullif(trim(p_display_name), '') is null
     or p_role_key !~ '^[A-Z][A-Z0-9_]{1,63}$'
     or p_scope not in ('TENANT','BUSINESS','BRANCH','PROVIDER')
     or p_permissions is null
     or jsonb_typeof(p_permissions) <> 'object' then
    raise exception 'INVALID_ROLE_DEFINITION';
  end if;
  -- Custom roles may not impersonate the platform root role.
  if upper(p_role_key) in ('SUPER_ADMIN','PLATFORM_ADMIN','SERVICE_ROLE') then
    raise exception 'RESERVED_ROLE_KEY';
  end if;

  if p_role_id is null then
    insert into public.platform_custom_roles
      (role_key, display_name, description, scope, permissions, is_system, is_active, created_by, updated_by)
    values
      (p_role_key, trim(p_display_name), coalesce(p_description,''), p_scope, p_permissions, false, coalesce(p_is_active,true), v_actor, v_actor)
    returning * into v_role;
    v_old := '{}'::jsonb;
  else
    select * into v_role from public.platform_custom_roles where id = p_role_id for update;
    if not found then raise exception 'ROLE_NOT_FOUND'; end if;
    if v_role.is_system then raise exception 'SYSTEM_ROLE_IMMUTABLE'; end if;
    v_old := jsonb_build_object('role_key',v_role.role_key,'display_name',v_role.display_name,
      'description',v_role.description,'scope',v_role.scope,'permissions',v_role.permissions,'is_active',v_role.is_active);
    update public.platform_custom_roles
      set role_key=p_role_key, display_name=trim(p_display_name), description=coalesce(p_description,''),
          scope=p_scope, permissions=p_permissions, is_active=coalesce(p_is_active,true),
          updated_by=v_actor, updated_at=now()
      where id=p_role_id returning * into v_role;
  end if;

  insert into public.audit_logs
    (id, tenant_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, result)
  values
    (gen_random_uuid()::text, 'MNTY-PLATFORM', v_actor,
     case when p_role_id is null then 'PLATFORM_ROLE_CREATED' else 'PLATFORM_ROLE_UPDATED' end,
     'platform_custom_role', v_role.id::text, v_old,
     jsonb_build_object('role_key',v_role.role_key,'display_name',v_role.display_name,
       'description',v_role.description,'scope',v_role.scope,'permissions',v_role.permissions,'is_active',v_role.is_active),
     'SUCCESS');

  return jsonb_build_object('id',v_role.id,'role_key',v_role.role_key,'scope',v_role.scope,'is_active',v_role.is_active);
end;
$function$;

create or replace function public.mnty_platform_admin_assign_custom_role(
  p_user_id uuid,
  p_role_id uuid,
  p_tenant_id varchar default null,
  p_business_id uuid default null,
  p_branch_id varchar default null,
  p_is_active boolean default true,
  p_assignment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role public.platform_custom_roles%rowtype;
  v_assignment public.platform_role_assignments%rowtype;
  v_old jsonb := '{}'::jsonb;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from private.platform_admins pa where pa.user_id = v_actor) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  if p_user_id is null or p_role_id is null then raise exception 'USER_AND_ROLE_REQUIRED'; end if;
  select * into v_role from public.platform_custom_roles where id=p_role_id and is_active;
  if not found then raise exception 'ACTIVE_ROLE_REQUIRED'; end if;
  if v_role.scope='TENANT' and (p_tenant_id is null or p_business_id is not null or p_branch_id is not null) then
    raise exception 'INVALID_TENANT_SCOPE';
  elsif v_role.scope='BUSINESS' and (p_tenant_id is null or p_business_id is null or p_branch_id is not null) then
    raise exception 'INVALID_BUSINESS_SCOPE';
  elsif v_role.scope='BRANCH' and (p_tenant_id is null or p_business_id is null or p_branch_id is null) then
    raise exception 'INVALID_BRANCH_SCOPE';
  elsif v_role.scope='PROVIDER' and p_tenant_id is null then
    raise exception 'INVALID_PROVIDER_SCOPE';
  end if;
  if p_tenant_id is not null and not exists(select 1 from public.tenants t where t.id=p_tenant_id and t.status='ACTIVE') then
    raise exception 'ACTIVE_TENANT_REQUIRED';
  end if;
  if p_business_id is not null and not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then
    raise exception 'BUSINESS_TENANT_MISMATCH';
  end if;

  if p_assignment_id is null then
    insert into public.platform_role_assignments
      (user_id,role_id,tenant_id,business_id,branch_id,is_active,created_by,updated_by)
    values
      (p_user_id,p_role_id,p_tenant_id,p_business_id,p_branch_id,coalesce(p_is_active,true),v_actor,v_actor)
    on conflict do nothing
    returning * into v_assignment;
    if v_assignment.id is null then
      select * into v_assignment from public.platform_role_assignments
      where user_id=p_user_id and role_id=p_role_id
        and coalesce(tenant_id,'')=coalesce(p_tenant_id,'')
        and coalesce(business_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(p_business_id,'00000000-0000-0000-0000-000000000000'::uuid)
        and coalesce(branch_id,'')=coalesce(p_branch_id,'') and is_active
      limit 1;
      if not found then raise exception 'ASSIGNMENT_CONFLICT'; end if;
    end if;
    v_old := '{}'::jsonb;
  else
    select * into v_assignment from public.platform_role_assignments where id=p_assignment_id for update;
    if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
    v_old := jsonb_build_object('user_id',v_assignment.user_id,'role_id',v_assignment.role_id,
      'tenant_id',v_assignment.tenant_id,'business_id',v_assignment.business_id,
      'branch_id',v_assignment.branch_id,'is_active',v_assignment.is_active);
    update public.platform_role_assignments set
      user_id=p_user_id, role_id=p_role_id, tenant_id=p_tenant_id, business_id=p_business_id,
      branch_id=p_branch_id, is_active=coalesce(p_is_active,true), updated_by=v_actor, updated_at=now()
    where id=p_assignment_id returning * into v_assignment;
  end if;

  insert into public.audit_logs
    (id, tenant_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, result)
  values
    (gen_random_uuid()::text, coalesce(p_tenant_id,'MNTY-PLATFORM'), v_actor,
     case when p_is_active then 'PLATFORM_ROLE_ASSIGNED' else 'PLATFORM_ROLE_REVOKED' end,
     'platform_role_assignment', v_assignment.id::text, v_old,
     jsonb_build_object('user_id',v_assignment.user_id,'role_id',v_assignment.role_id,
       'tenant_id',v_assignment.tenant_id,'business_id',v_assignment.business_id,
       'branch_id',v_assignment.branch_id,'is_active',v_assignment.is_active),
     'SUCCESS');

  return jsonb_build_object('id',v_assignment.id,'user_id',v_assignment.user_id,
    'role_id',v_assignment.role_id,'is_active',v_assignment.is_active);
end;
$function$;

revoke all on function public.mnty_platform_admin_list_custom_roles() from public, anon;
revoke all on function public.mnty_platform_admin_upsert_custom_role(text,text,text,text,jsonb,uuid,boolean) from public, anon;
revoke all on function public.mnty_platform_admin_assign_custom_role(uuid,uuid,varchar,uuid,varchar,boolean,uuid) from public, anon;
grant execute on function public.mnty_platform_admin_list_custom_roles() to authenticated;
grant execute on function public.mnty_platform_admin_upsert_custom_role(text,text,text,text,jsonb,uuid,boolean) to authenticated;
grant execute on function public.mnty_platform_admin_assign_custom_role(uuid,uuid,varchar,uuid,varchar,boolean,uuid) to authenticated;

comment on table public.platform_custom_roles is 'RC113: custom scoped roles managed only by the authoritative platform administrator.';
comment on table public.platform_role_assignments is 'RC113: custom role assignments with explicit tenant/business/branch scope; assignments do not supersede RLS.';
