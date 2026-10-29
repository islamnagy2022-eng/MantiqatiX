-- Forward-only, dashboard-scoped dependency rollout for MantiqatiX.
-- This migration intentionally excludes RC117's image-column additions and bulk default-image updates.
-- The copied source segments below are applied in dependency order; no historical migration is changed.
-- BEGIN RECONCILED SOURCE: supabase/migrations/20261027030000_rc113_super_admin_control_center_foundation.sql
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
  select * into v_role from public.platform_custom_roles where id=p_role_id and (is_active or (p_assignment_id is not null and coalesce(p_is_active,true)=false));
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
  if p_branch_id is not null and (p_business_id is null or not exists(
    select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id
  )) then
    raise exception 'BRANCH_BUSINESS_MISMATCH';
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

-- END RECONCILED SOURCE: supabase/migrations/20261027030000_rc113_super_admin_control_center_foundation.sql

-- BEGIN RECONCILED SOURCE: supabase/migrations/20261027040000_rc114_business_employee_hiring_system.sql
-- RC114: activity-owned employee and hiring workspace.
-- Every business owns its positions, hiring status, employee assignments and scoped permissions.
-- Existing user identities are reused; this does not fabricate Auth users or bypass memberships/RLS.

create table if not exists public.business_job_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id varchar null,
  title text not null,
  description text not null default '',
  department text not null default '',
  employment_type text not null default 'FULL_TIME'
    check (employment_type in ('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERN')),
  permission_template jsonb not null default '{"modules":{"HOME":["view"]}}'::jsonb,
  is_hiring boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_job_positions_title_nonempty check (length(trim(title)) between 2 and 120),
  constraint business_job_positions_permissions_object check (jsonb_typeof(permission_template)='object')
);

create table if not exists public.business_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id varchar null,
  user_id uuid null references auth.users(id) on delete set null,
  job_position_id uuid not null references public.business_job_positions(id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text not null default '',
  status text not null default 'INVITED'
    check (status in ('INVITED','ACTIVE','SUSPENDED','ENDED')),
  permission_overrides jsonb not null default '{}'::jsonb,
  hired_at date null,
  ended_at date null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_employees_name_nonempty check (length(trim(full_name)) between 2 and 160),
  constraint business_employees_email_nonempty check (length(trim(email)) between 3 and 254),
  constraint business_employees_permissions_object check (jsonb_typeof(permission_overrides)='object')
);

create unique index if not exists business_employees_email_per_business_unique
  on public.business_employees(business_id, lower(email))
  where status <> 'ENDED';
create index if not exists business_job_positions_business_active_idx
  on public.business_job_positions(tenant_id,business_id,is_active,is_hiring);
create index if not exists business_employees_business_status_idx
  on public.business_employees(tenant_id,business_id,status);
create index if not exists business_employees_user_active_idx
  on public.business_employees(user_id,tenant_id,business_id)
  where status='ACTIVE';

alter table public.business_job_positions enable row level security;
alter table public.business_job_positions force row level security;
alter table public.business_employees enable row level security;
alter table public.business_employees force row level security;
revoke all on public.business_job_positions from anon, authenticated;
revoke all on public.business_employees from anon, authenticated;

create or replace function public.mnty_business_employee_position_upsert(
  p_tenant_id varchar,
  p_business_id uuid,
  p_title text,
  p_description text default '',
  p_department text default '',
  p_employment_type text default 'FULL_TIME',
  p_permission_template jsonb default '{"modules":{"HOME":["view"]}}'::jsonb,
  p_is_hiring boolean default false,
  p_is_active boolean default true,
  p_branch_id varchar default null,
  p_position_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_position public.business_job_positions%rowtype;
  v_old jsonb := '{}'::jsonb;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id
      and m.business_id=p_business_id and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
  ) and not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id
      and m.business_id is null and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN','SUPER_ADMIN')
      and (upper(m.role)<>'SUPER_ADMIN' or (m.permissions->>'scope'='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)))
  ) then raise exception 'BUSINESS_HR_FORBIDDEN'; end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id) then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
  if nullif(trim(p_title),'') is null or p_employment_type not in ('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERN') or jsonb_typeof(p_permission_template)<>'object' then raise exception 'INVALID_POSITION'; end if;
  if p_position_id is null then
    insert into public.business_job_positions
      (tenant_id,business_id,branch_id,title,description,department,employment_type,permission_template,is_hiring,is_active,created_by,updated_by)
    values
      (p_tenant_id,p_business_id,p_branch_id,trim(p_title),coalesce(p_description,''),coalesce(p_department,''),p_employment_type,p_permission_template,coalesce(p_is_hiring,false),coalesce(p_is_active,true),v_actor,v_actor)
    returning * into v_position;
  else
    select * into v_position from public.business_job_positions where id=p_position_id and tenant_id=p_tenant_id and business_id=p_business_id for update;
    if not found then raise exception 'POSITION_NOT_FOUND'; end if;
    v_old:=jsonb_build_object('title',v_position.title,'department',v_position.department,'employment_type',v_position.employment_type,'permission_template',v_position.permission_template,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active);
    update public.business_job_positions set branch_id=p_branch_id,title=trim(p_title),description=coalesce(p_description,''),department=coalesce(p_department,''),employment_type=p_employment_type,permission_template=p_permission_template,is_hiring=coalesce(p_is_hiring,false),is_active=coalesce(p_is_active,true),updated_by=v_actor,updated_at=now()
    where id=p_position_id returning * into v_position;
  end if;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,p_tenant_id,v_actor,case when p_position_id is null then 'BUSINESS_JOB_POSITION_CREATED' else 'BUSINESS_JOB_POSITION_UPDATED' end,'business_job_position',v_position.id::text,v_old,
    jsonb_build_object('business_id',p_business_id,'branch_id',v_position.branch_id,'title',v_position.title,'department',v_position.department,'employment_type',v_position.employment_type,'permission_template',v_position.permission_template,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active),'SUCCESS');
  return jsonb_build_object('id',v_position.id,'title',v_position.title,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active);
end;
$function$;

create or replace function public.mnty_business_employee_upsert(
  p_tenant_id varchar,
  p_business_id uuid,
  p_job_position_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default '',
  p_user_id uuid default null,
  p_status text default 'INVITED',
  p_permission_overrides jsonb default '{}'::jsonb,
  p_branch_id varchar default null,
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_employee public.business_employees%rowtype;
  v_old jsonb := '{}'::jsonb;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
  ) and not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id is null
      and m.status='ACTIVE' and upper(m.role) in ('OWNER','ADMIN','SUPER_ADMIN')
      and (upper(m.role)<>'SUPER_ADMIN' or (m.permissions->>'scope'='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)))
  ) then raise exception 'BUSINESS_HR_FORBIDDEN'; end if;
  if not exists(select 1 from public.business_job_positions p where p.id=p_job_position_id and p.tenant_id=p_tenant_id and p.business_id=p_business_id and p.is_active) then raise exception 'ACTIVE_POSITION_REQUIRED'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id) then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
  if nullif(trim(p_full_name),'') is null or position('@' in coalesce(p_email,''))<2 or jsonb_typeof(p_permission_overrides)<>'object' or p_status not in ('INVITED','ACTIVE','SUSPENDED','ENDED') then raise exception 'INVALID_EMPLOYEE'; end if;
  if p_user_id is not null and not exists(select 1 from auth.users u where u.id=p_user_id and lower(u.email)=lower(trim(p_email))) then raise exception 'AUTH_USER_EMAIL_MISMATCH'; end if;
  if p_status='ACTIVE' and p_user_id is null then raise exception 'ACTIVE_EMPLOYEE_REQUIRES_AUTH_USER'; end if;

  if p_employee_id is null then
    insert into public.business_employees
      (tenant_id,business_id,branch_id,user_id,job_position_id,full_name,email,phone,status,permission_overrides,hired_at,created_by,updated_by)
    values
      (p_tenant_id,p_business_id,p_branch_id,p_user_id,p_job_position_id,trim(p_full_name),lower(trim(p_email)),coalesce(p_phone,''),p_status,p_permission_overrides,case when p_status='ACTIVE' then current_date else null end,v_actor,v_actor)
    returning * into v_employee;
  else
    select * into v_employee from public.business_employees where id=p_employee_id and tenant_id=p_tenant_id and business_id=p_business_id for update;
    if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
    v_old:=jsonb_build_object('user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'status',v_employee.status,'permission_overrides',v_employee.permission_overrides);
    update public.business_employees set branch_id=p_branch_id,user_id=p_user_id,job_position_id=p_job_position_id,full_name=trim(p_full_name),email=lower(trim(p_email)),phone=coalesce(p_phone,''),status=p_status,permission_overrides=p_permission_overrides,
      hired_at=case when p_status='ACTIVE' then coalesce(hired_at,current_date) else hired_at end,
      ended_at=case when p_status='ENDED' then coalesce(ended_at,current_date) else null end,
      updated_by=v_actor,updated_at=now()
    where id=p_employee_id returning * into v_employee;
  end if;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,p_tenant_id,v_actor,case when p_status in ('SUSPENDED','ENDED') then 'BUSINESS_EMPLOYEE_STATUS_CHANGED' else 'BUSINESS_EMPLOYEE_UPSERTED' end,'business_employee',v_employee.id::text,v_old,
    jsonb_build_object('business_id',p_business_id,'branch_id',v_employee.branch_id,'user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'full_name',v_employee.full_name,'email',v_employee.email,'status',v_employee.status,'permission_overrides',v_employee.permission_overrides),'SUCCESS');
  return jsonb_build_object('id',v_employee.id,'business_id',v_employee.business_id,'user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'status',v_employee.status);
end;
$function$;

revoke all on function public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid) from public, anon;
revoke all on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) from public, anon;
grant execute on function public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid) to authenticated;
grant execute on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) to authenticated;

comment on table public.business_job_positions is 'RC114: business-owned hiring positions and permission templates.';
comment on table public.business_employees is 'RC114: scoped employee roster and lifecycle per business.';

-- END RECONCILED SOURCE: supabase/migrations/20261027040000_rc114_business_employee_hiring_system.sql

-- BEGIN RECONCILED SOURCE: supabase/migrations/20261027050000_rc115_control_center_integration.sql
-- RC115: wire the platform control center to scoped user, role and employee administration.
-- Additive only: no production data rewrite and no historical migration edits.

create or replace function public.mnty_platform_has_permission(
  p_permission_key text,
  p_tenant_id varchar default null,
  p_business_id uuid default null,
  p_branch_id varchar default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_module text := upper(split_part(coalesce(p_permission_key,''),'.',1));
  v_action text := lower(split_part(coalesce(p_permission_key,''),'.',2));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or position('.' in coalesce(p_permission_key,'')) < 2
     or v_module = '' or v_action = '' then
    return false;
  end if;

  -- Platform-owner authority is still sourced only from the protected registry.
  if exists (select 1 from private.platform_admins pa where pa.user_id=v_actor) then
    return true;
  end if;

  -- Scoped staff memberships are used only when an endpoint explicitly calls this gate.
  if exists (
    select 1
    from public.user_memberships m
    where m.user_id=v_actor and m.status='ACTIVE'
      and upper(coalesce(m.role,'')) in ('EMPLOYEE','STAFF')
      and (p_tenant_id is null or m.tenant_id=p_tenant_id)
      and (m.business_id is null or m.business_id=p_business_id)
      and (m.branch_id is null or m.branch_id=p_branch_id)
      and coalesce(m.permissions #> array['modules',v_module], '[]'::jsonb) ? v_action
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.platform_role_assignments a
    join public.platform_custom_roles r on r.id=a.role_id
    where a.user_id=v_actor and a.is_active and r.is_active
      and p_tenant_id is not null and a.tenant_id=p_tenant_id
      and (
        (r.scope='TENANT' and a.business_id is null and a.branch_id is null)
        or (r.scope='BUSINESS' and p_business_id is not null and a.business_id=p_business_id and a.branch_id is null)
        or (r.scope='BRANCH' and p_business_id is not null and a.business_id=p_business_id and p_branch_id is not null and a.branch_id=p_branch_id)
        or (r.scope='PROVIDER' and (a.business_id is null or a.business_id=p_business_id))
      )
      and coalesce(r.permissions #> array['modules',v_module], '[]'::jsonb) ? v_action
  );
end;
$function$;

create or replace function public.mnty_platform_admin_list_people(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_search text := lower(trim(coalesce(p_search,'')));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',u.id,
      'email',coalesce(u.email,''),
      'full_name',coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.raw_user_meta_data->>'fullName',''),
      'phone',coalesce(u.phone,u.raw_user_meta_data->>'phone',''),
      'email_confirmed',u.email_confirmed_at is not null,
      'created_at',u.created_at,
      'last_sign_in_at',u.last_sign_in_at,
      'memberships',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',m.id,'tenant_id',m.tenant_id,'business_id',m.business_id,'branch_id',m.branch_id,
          'role',m.role,'status',m.status,'business_name',b.name
        ) order by m.created_at desc)
        from public.user_memberships m
        left join public.businesses b on b.id=m.business_id
        where m.user_id=u.id
      ),'[]'::jsonb)
    ) order by u.created_at desc)
    from (
      select au.*
      from auth.users au
      where v_search='' or lower(coalesce(au.email,'')) like '%'||v_search||'%'
        or lower(coalesce(au.raw_user_meta_data->>'full_name',au.raw_user_meta_data->>'name','')) like '%'||v_search||'%'
      order by au.created_at desc
      limit 200
    ) u
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.mnty_platform_admin_list_role_assignments()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',a.id,'user_id',a.user_id,'email',coalesce(u.email,''),
      'full_name',coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),
      'role_id',r.id,'role_key',r.role_key,'role_name',r.display_name,'scope',r.scope,
      'tenant_id',a.tenant_id,'business_id',a.business_id,'branch_id',a.branch_id,
      'is_active',a.is_active,'created_at',a.created_at
    ) order by a.created_at desc)
    from public.platform_role_assignments a
    join public.platform_custom_roles r on r.id=a.role_id
    join auth.users u on u.id=a.user_id
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.mnty_business_employee_list(p_tenant_id varchar, p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
  if not exists(
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
  ) and not public.mnty_platform_has_permission('EMPLOYEES.VIEW',p_tenant_id,p_business_id,null)
    and not public.mnty_platform_has_permission('EMPLOYEES.MANAGE',p_tenant_id,p_business_id,null) then
    raise exception 'BUSINESS_HR_FORBIDDEN';
  end if;
  return jsonb_build_object(
    'positions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'tenant_id',p.tenant_id,'business_id',p.business_id,'branch_id',p.branch_id,
        'title',p.title,'description',p.description,'department',p.department,'employment_type',p.employment_type,
        'permission_template',p.permission_template,'is_hiring',p.is_hiring,'is_active',p.is_active,
        'created_at',p.created_at,'updated_at',p.updated_at
      ) order by p.created_at desc)
      from public.business_job_positions p where p.tenant_id=p_tenant_id and p.business_id=p_business_id
    ),'[]'::jsonb),
    'employees',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'tenant_id',e.tenant_id,'business_id',e.business_id,'branch_id',e.branch_id,
        'user_id',e.user_id,'job_position_id',e.job_position_id,'position_title',p.title,
        'full_name',e.full_name,'email',e.email,'phone',e.phone,'status',e.status,
        'permission_overrides',e.permission_overrides,'hired_at',e.hired_at,'ended_at',e.ended_at,
        'created_at',e.created_at,'updated_at',e.updated_at
      ) order by e.created_at desc)
      from public.business_employees e
      join public.business_job_positions p on p.id=e.job_position_id
      where e.tenant_id=p_tenant_id and e.business_id=p_business_id
    ),'[]'::jsonb)
  );
end;
$function$;

-- Replace the position writer with the same audited operation plus scoped custom-permission support.
create or replace function public.mnty_business_employee_position_upsert(
  p_tenant_id varchar,
  p_business_id uuid,
  p_title text,
  p_description text default '',
  p_department text default '',
  p_employment_type text default 'FULL_TIME',
  p_permission_template jsonb default '{"modules":{"HOME":["view"]}}'::jsonb,
  p_is_hiring boolean default false,
  p_is_active boolean default true,
  p_branch_id varchar default null,
  p_position_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_position public.business_job_positions%rowtype;
  v_old jsonb := '{}'::jsonb;
  v_permission text := case when p_position_id is null then 'EMPLOYEES.CREATE' else 'EMPLOYEES.UPDATE' end;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
  ) and not public.mnty_platform_has_permission(v_permission,p_tenant_id,p_business_id,p_branch_id)
    and not public.mnty_platform_has_permission('EMPLOYEES.MANAGE',p_tenant_id,p_business_id,p_branch_id) then
    raise exception 'BUSINESS_HR_FORBIDDEN';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id) then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
  if nullif(trim(p_title),'') is null or p_employment_type not in ('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERN') or jsonb_typeof(p_permission_template)<>'object' then raise exception 'INVALID_POSITION'; end if;
  if p_position_id is null then
    insert into public.business_job_positions
      (tenant_id,business_id,branch_id,title,description,department,employment_type,permission_template,is_hiring,is_active,created_by,updated_by)
    values
      (p_tenant_id,p_business_id,p_branch_id,trim(p_title),coalesce(p_description,''),coalesce(p_department,''),p_employment_type,p_permission_template,coalesce(p_is_hiring,false),coalesce(p_is_active,true),v_actor,v_actor)
    returning * into v_position;
  else
    select * into v_position from public.business_job_positions where id=p_position_id and tenant_id=p_tenant_id and business_id=p_business_id for update;
    if not found then raise exception 'POSITION_NOT_FOUND'; end if;
    v_old:=jsonb_build_object('title',v_position.title,'department',v_position.department,'employment_type',v_position.employment_type,'permission_template',v_position.permission_template,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active);
    update public.business_job_positions set branch_id=p_branch_id,title=trim(p_title),description=coalesce(p_description,''),department=coalesce(p_department,''),employment_type=p_employment_type,permission_template=p_permission_template,is_hiring=coalesce(p_is_hiring,false),is_active=coalesce(p_is_active,true),updated_by=v_actor,updated_at=now()
    where id=p_position_id returning * into v_position;
  end if;
  -- Permission and activation changes propagate immediately to memberships linked to this position.
  update public.user_memberships m
    set permissions=coalesce(v_position.permission_template,'{}'::jsonb)||coalesce(e.permission_overrides,'{}'::jsonb),
        status=case when e.status='ACTIVE' and v_position.is_active then 'ACTIVE' else 'INACTIVE' end
  from public.business_employees e
  where e.job_position_id=v_position.id and e.business_id=p_business_id and e.tenant_id=p_tenant_id
    and e.user_id=m.user_id
    and m.id='MNTY-EMPLOYEE-'||replace(e.id::text,'-','')
    and upper(m.role)='EMPLOYEE';

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,p_tenant_id,v_actor,case when p_position_id is null then 'BUSINESS_JOB_POSITION_CREATED' else 'BUSINESS_JOB_POSITION_UPDATED' end,'business_job_position',v_position.id::text,v_old,
    jsonb_build_object('business_id',p_business_id,'branch_id',v_position.branch_id,'title',v_position.title,'department',v_position.department,'employment_type',v_position.employment_type,'permission_template',v_position.permission_template,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active),'SUCCESS');
  return jsonb_build_object('id',v_position.id,'title',v_position.title,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active);
end;
$function$;

-- Link an active employee only to the existing Supabase identity with the same email.
-- The EMPLOYEE membership carries a scoped permission document; it is not mapped to OWNER/ADMIN.
create or replace function public.mnty_business_employee_upsert(
  p_tenant_id varchar,
  p_business_id uuid,
  p_job_position_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default '',
  p_user_id uuid default null,
  p_status text default 'INVITED',
  p_permission_overrides jsonb default '{}'::jsonb,
  p_branch_id varchar default null,
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_employee public.business_employees%rowtype;
  v_position public.business_job_positions%rowtype;
  v_old jsonb := '{}'::jsonb;
  v_user_id uuid;
  v_previous_user_id uuid;
  v_org_id public.businesses.organization_id%type;
  v_membership_id text;
  v_effective_permissions jsonb;
  v_permission text := case when p_employee_id is null then 'EMPLOYEES.CREATE' else 'EMPLOYEES.UPDATE' end;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
  ) and not public.mnty_platform_has_permission(v_permission,p_tenant_id,p_business_id,p_branch_id)
    and not public.mnty_platform_has_permission('EMPLOYEES.MANAGE',p_tenant_id,p_business_id,p_branch_id) then
    raise exception 'BUSINESS_HR_FORBIDDEN';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
  select * into v_position from public.business_job_positions p
    where p.id=p_job_position_id and p.tenant_id=p_tenant_id and p.business_id=p_business_id and p.is_active;
  if not found then raise exception 'ACTIVE_POSITION_REQUIRED'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id) then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
  if nullif(trim(p_full_name),'') is null or position('@' in coalesce(p_email,''))<2
    or jsonb_typeof(coalesce(p_permission_overrides,'{}'::jsonb))<>'object'
    or p_status not in ('INVITED','ACTIVE','SUSPENDED','ENDED') then raise exception 'INVALID_EMPLOYEE'; end if;

  select u.id into v_user_id from auth.users u where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null limit 1;
  if p_user_id is not null then
    if not exists(select 1 from auth.users u where u.id=p_user_id and lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null) then raise exception 'AUTH_USER_EMAIL_MISMATCH_OR_UNCONFIRMED'; end if;
    v_user_id:=p_user_id;
  end if;
  if p_status='ACTIVE' and v_user_id is null then raise exception 'ACTIVE_EMPLOYEE_REQUIRES_CONFIRMED_AUTH_USER'; end if;
  if p_employee_id is null then
    insert into public.business_employees
      (tenant_id,business_id,branch_id,user_id,job_position_id,full_name,email,phone,status,permission_overrides,hired_at,created_by,updated_by)
    values
      (p_tenant_id,p_business_id,p_branch_id,v_user_id,p_job_position_id,trim(p_full_name),lower(trim(p_email)),coalesce(p_phone,''),p_status,coalesce(p_permission_overrides,'{}'::jsonb),case when p_status='ACTIVE' then current_date else null end,v_actor,v_actor)
    returning * into v_employee;
  else
    select * into v_employee from public.business_employees where id=p_employee_id and tenant_id=p_tenant_id and business_id=p_business_id for update;
    if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
    v_old:=jsonb_build_object('user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'status',v_employee.status,'permission_overrides',v_employee.permission_overrides);
    v_previous_user_id:=v_employee.user_id;
    update public.business_employees set branch_id=p_branch_id,user_id=v_user_id,job_position_id=p_job_position_id,full_name=trim(p_full_name),email=lower(trim(p_email)),phone=coalesce(p_phone,''),status=p_status,permission_overrides=coalesce(p_permission_overrides,'{}'::jsonb),
      hired_at=case when p_status='ACTIVE' then coalesce(hired_at,current_date) else hired_at end,
      ended_at=case when p_status='ENDED' then coalesce(ended_at,current_date) else null end,
      updated_by=v_actor,updated_at=now()
    where id=p_employee_id returning * into v_employee;
  end if;

  -- Revoke the old employee membership before linking a changed email/identity.
  if v_previous_user_id is not null and v_previous_user_id is distinct from v_employee.user_id then
    update public.user_memberships
      set status='INACTIVE'
      where id='MNTY-EMPLOYEE-'||replace(v_employee.id::text,'-','')
        and user_id=v_previous_user_id and tenant_id=p_tenant_id and business_id=p_business_id
        and upper(role)='EMPLOYEE';
  end if;

  if v_employee.user_id is not null then
    select b.organization_id into v_org_id from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id;
    v_membership_id:='MNTY-EMPLOYEE-'||replace(v_employee.id::text,'-','');
    v_effective_permissions:=coalesce(v_position.permission_template,'{}'::jsonb)||coalesce(v_employee.permission_overrides,'{}'::jsonb);
    if v_employee.status='ACTIVE' then
      insert into public.user_memberships(id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
      values(v_membership_id,v_employee.user_id,p_tenant_id,v_org_id,p_business_id,v_employee.branch_id,'EMPLOYEE',v_effective_permissions,'ACTIVE')
      on conflict(id) do update set user_id=excluded.user_id,tenant_id=excluded.tenant_id,organization_id=excluded.organization_id,business_id=excluded.business_id,branch_id=excluded.branch_id,role='EMPLOYEE',permissions=excluded.permissions,status='ACTIVE';
    else
      update public.user_memberships set status=case when v_employee.status='SUSPENDED' then 'SUSPENDED' else 'INACTIVE' end
      where id=v_membership_id and user_id=v_employee.user_id and business_id=p_business_id;
    end if;
  end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,p_tenant_id,v_actor,case when p_status in ('SUSPENDED','ENDED') then 'BUSINESS_EMPLOYEE_STATUS_CHANGED' else 'BUSINESS_EMPLOYEE_UPSERTED' end,'business_employee',v_employee.id::text,v_old,
    jsonb_build_object('business_id',p_business_id,'branch_id',v_employee.branch_id,'user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'full_name',v_employee.full_name,'email',v_employee.email,'status',v_employee.status,'permission_overrides',v_employee.permission_overrides),'SUCCESS');
  return jsonb_build_object('id',v_employee.id,'business_id',v_employee.business_id,'user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'status',v_employee.status);
end;
$function$;


create or replace function public.mnty_platform_admin_list_audit(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_search text := lower(trim(coalesce(p_search,'')));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',l.id,'tenant_id',l.tenant_id,'actor_user_id',l.actor_user_id,'actor_email',coalesce(u.email,''),
      'action',l.action,'entity_type',l.entity_type,'entity_id',l.entity_id,'old_values',l.old_values,
      'new_values',l.new_values,'result',l.result,'created_at',l.created_at
    ) order by l.created_at desc)
    from (
      select al.* from public.audit_logs al
      where v_search='' or lower(coalesce(al.action,'')) like '%'||v_search||'%'
        or lower(coalesce(al.entity_type,'')) like '%'||v_search||'%'
        or lower(coalesce(al.entity_id,'')) like '%'||v_search||'%'
      order by al.created_at desc limit 200
    ) l
    left join auth.users u on u.id=l.actor_user_id
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.mnty_platform_admin_list_audit(text) from public, anon;
revoke all on function public.mnty_platform_has_permission(text,varchar,uuid,varchar) from public, anon;
revoke all on function public.mnty_platform_admin_list_people(text) from public, anon;
revoke all on function public.mnty_platform_admin_list_role_assignments() from public, anon;
revoke all on function public.mnty_business_employee_list(varchar,uuid) from public, anon;
grant execute on function public.mnty_platform_admin_list_audit(text) to authenticated;
grant execute on function public.mnty_platform_has_permission(text,varchar,uuid,varchar) to authenticated;
grant execute on function public.mnty_platform_admin_list_people(text) to authenticated;
grant execute on function public.mnty_platform_admin_list_role_assignments() to authenticated;
grant execute on function public.mnty_business_employee_list(varchar,uuid) to authenticated;
grant execute on function public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid) to authenticated;
grant execute on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) to authenticated;

comment on function public.mnty_platform_has_permission(text,varchar,uuid,varchar) is 'RC115 scoped permission resolver. It only takes effect in an API/RPC that explicitly calls it.';
comment on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) is 'RC115 employee lifecycle and scoped EMPLOYEE membership synchronization; never elevates to OWNER or ADMIN.';

-- END RECONCILED SOURCE: supabase/migrations/20261027050000_rc115_control_center_integration.sql

-- BEGIN RECONCILED SOURCE: supabase/migrations/20261027060000_rc116_business_subscriber_admin.sql
-- RC116: guarded platform administration for business profiles and subscriber memberships.
-- "Delete" is implemented as audited deactivation; financial and historical records are retained.
-- Auth identities are never hard-deleted by this interface.

create or replace function public.mnty_platform_admin_list_businesses(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_search text := lower(trim(coalesce(p_search,'')));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',b.id,'tenant_id',b.tenant_id,'name',b.name,'code',b.code,'status',b.status,
      'settings',b.settings,'created_at',b.created_at,
      'memberships',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',m.id,'user_id',m.user_id,'role',m.role,'status',m.status,
          'email',coalesce(u.email,''),'full_name',coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','')
        ) order by m.created_at desc)
        from public.user_memberships m left join auth.users u on u.id=m.user_id
        where m.tenant_id=b.tenant_id and m.business_id=b.id
      ),'[]'::jsonb)
    ) order by b.created_at desc)
    from public.businesses b
    where v_search='' or lower(coalesce(b.name,'')) like '%'||v_search||'%'
      or lower(coalesce(b.code,'')) like '%'||v_search||'%'
    limit 300
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.mnty_platform_admin_manage_business(
  p_business_id uuid,
  p_name text,
  p_settings jsonb default null,
  p_action text default 'UPDATE'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_business public.businesses%rowtype;
  v_old jsonb;
  v_action text := upper(coalesce(p_action,'UPDATE'));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if v_action not in ('UPDATE','DEACTIVATE','RESTORE') then raise exception 'INVALID_BUSINESS_ACTION'; end if;
  select * into v_business from public.businesses where id=p_business_id for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
  v_old:=jsonb_build_object('name',v_business.name,'status',v_business.status,'settings',v_business.settings);
  if v_action='UPDATE' then
    if nullif(trim(p_name),'') is null then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
    update public.businesses set name=trim(p_name),
      settings=case when p_settings is null then settings else p_settings end
    where id=p_business_id returning * into v_business;
  elsif v_action='DEACTIVATE' then
    update public.businesses set status='INACTIVE' where id=p_business_id returning * into v_business;
  else
    update public.businesses set status='ACTIVE' where id=p_business_id returning * into v_business;
  end if;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,v_business.tenant_id,v_actor,
    case v_action when 'UPDATE' then 'PLATFORM_BUSINESS_UPDATED' when 'DEACTIVATE' then 'PLATFORM_BUSINESS_DEACTIVATED' else 'PLATFORM_BUSINESS_RESTORED' end,
    'business',v_business.id::text,v_old,
    jsonb_build_object('name',v_business.name,'status',v_business.status,'settings',v_business.settings),'SUCCESS');
  return jsonb_build_object('id',v_business.id,'name',v_business.name,'status',v_business.status);
end;
$function$;

create or replace function public.mnty_platform_admin_manage_membership(
  p_membership_id uuid,
  p_action text,
  p_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.user_memberships%rowtype;
  v_old jsonb;
  v_action text := upper(coalesce(p_action,''));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if v_action not in ('SUSPEND','RESTORE','CHANGE_ROLE') then raise exception 'INVALID_MEMBERSHIP_ACTION'; end if;
  select * into v_membership from public.user_memberships where id=p_membership_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if upper(coalesce(v_membership.role,'')) in ('SUPER_ADMIN','PLATFORM_ADMIN')
    or exists(select 1 from private.platform_admins pa where pa.user_id=v_membership.user_id) then
    raise exception 'PLATFORM_OWNER_MEMBERSHIP_PROTECTED';
  end if;
  v_old:=jsonb_build_object('user_id',v_membership.user_id,'role',v_membership.role,'status',v_membership.status);
  if v_action='SUSPEND' then
    update public.user_memberships set status='INACTIVE' where id=p_membership_id returning * into v_membership;
  elsif v_action='RESTORE' then
    update public.user_memberships set status='ACTIVE' where id=p_membership_id returning * into v_membership;
  else
    if nullif(trim(p_role),'') is null or upper(trim(p_role)) in ('SUPER_ADMIN','PLATFORM_ADMIN','SERVICE_ROLE') then raise exception 'INVALID_MEMBERSHIP_ROLE'; end if;
    update public.user_memberships set role=upper(trim(p_role)) where id=p_membership_id returning * into v_membership;
  end if;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,v_membership.tenant_id,v_actor,
    case v_action when 'SUSPEND' then 'PLATFORM_MEMBERSHIP_SUSPENDED' when 'RESTORE' then 'PLATFORM_MEMBERSHIP_RESTORED' else 'PLATFORM_MEMBERSHIP_ROLE_CHANGED' end,
    'user_membership',v_membership.id::text,v_old,
    jsonb_build_object('user_id',v_membership.user_id,'role',v_membership.role,'status',v_membership.status),'SUCCESS');
  return jsonb_build_object('id',v_membership.id,'user_id',v_membership.user_id,'role',v_membership.role,'status',v_membership.status);
end;
$function$;

revoke all on function public.mnty_platform_admin_list_businesses(text) from public, anon;
revoke all on function public.mnty_platform_admin_manage_business(uuid,text,jsonb,text) from public, anon;
revoke all on function public.mnty_platform_admin_manage_membership(uuid,text,text) from public, anon;
grant execute on function public.mnty_platform_admin_list_businesses(text) to authenticated;
grant execute on function public.mnty_platform_admin_manage_business(uuid,text,jsonb,text) to authenticated;
grant execute on function public.mnty_platform_admin_manage_membership(uuid,text,text) to authenticated;

-- END RECONCILED SOURCE: supabase/migrations/20261027060000_rc116_business_subscriber_admin.sql

-- BEGIN RECONCILED SOURCE: supabase/migrations/20261028225000_rc457_business_employee_permission_ceiling.sql
-- RC457: prevent a delegated employee manager from granting permissions beyond their authority.
-- This is a forward repair; historical RC113-RC115 migrations remain unchanged.

create or replace function public.mnty_business_employee_permission_ceiling_allows(
  p_permissions jsonb,
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_modules jsonb;
  v_module text;
  v_actions jsonb;
  v_action text;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or p_tenant_id is null or p_business_id is null
     or jsonb_typeof(coalesce(p_permissions,'{}'::jsonb)) <> 'object' then
    return false;
  end if;

  -- Employee permission documents may only carry a modules map; platform-level flags
  -- or scope attributes must never be smuggled into an EMPLOYEE membership.
  if exists (
    select 1 from jsonb_object_keys(coalesce(p_permissions,'{}'::jsonb)) as k(key)
    where key <> 'modules'
  ) then return false; end if;

  v_modules := coalesce(p_permissions,'{}'::jsonb)->'modules';
  if v_modules is null then return true; end if;
  if jsonb_typeof(v_modules) <> 'object' then return false; end if;

  -- Trusted business/platform owners may define the initial permission ceiling.
  if exists (select 1 from private.platform_admins pa where pa.user_id=v_actor)
     or exists (
       select 1 from public.user_memberships m
       where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id=p_business_id
         and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
         and (m.branch_id is null or m.branch_id=p_branch_id)
     )
     or exists (
       select 1 from public.user_memberships m
       where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.business_id is null
         and m.status='ACTIVE' and upper(m.role) in ('OWNER','ADMIN','SUPER_ADMIN')
         and (upper(m.role)<>'SUPER_ADMIN' or (m.permissions->>'scope'='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)))
     ) then
    return true;
  end if;

  -- Every delegated module/action must already be granted to the caller at this exact scope.
  for v_module, v_actions in select key, value from jsonb_each(v_modules) loop
    if v_module !~ '^[A-Z][A-Z0-9_]{0,63}$' or jsonb_typeof(v_actions) <> 'array' then return false; end if;
    for v_action in select jsonb_array_elements_text(v_actions) loop
      if v_action not in ('view','create','update','delete','manage') then return false; end if;
      if not public.mnty_platform_has_permission(v_module||'.'||v_action,p_tenant_id,p_business_id,p_branch_id) then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$function$;

create or replace function public.mnty_business_employee_permissions_subset(
  p_candidate jsonb,
  p_ceiling jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_candidate_modules jsonb;
  v_ceiling_modules jsonb;
  v_module text;
  v_actions jsonb;
  v_ceiling_actions jsonb;
  v_action text;
begin
  if jsonb_typeof(coalesce(p_candidate,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_ceiling,'{}'::jsonb)) <> 'object' then
    return false;
  end if;
  if exists (select 1 from jsonb_object_keys(coalesce(p_candidate,'{}'::jsonb)) as k(key) where key <> 'modules')
     or exists (select 1 from jsonb_object_keys(coalesce(p_ceiling,'{}'::jsonb)) as k(key) where key <> 'modules') then
    return false;
  end if;

  v_candidate_modules := coalesce(p_candidate,'{}'::jsonb)->'modules';
  v_ceiling_modules := coalesce(p_ceiling,'{}'::jsonb)->'modules';
  if v_candidate_modules is null then return true; end if;
  if jsonb_typeof(v_candidate_modules) <> 'object' then return false; end if;
  if v_ceiling_modules is null then
    for v_module, v_actions in select key, value from jsonb_each(v_candidate_modules) loop
      if jsonb_typeof(v_actions) is distinct from 'array' or jsonb_array_length(v_actions) > 0 then
        return false;
      end if;
    end loop;
    return true;
  end if;
  if jsonb_typeof(v_ceiling_modules) <> 'object' then return false; end if;

  for v_module, v_actions in select key, value from jsonb_each(v_candidate_modules) loop
    if v_module !~ '^[A-Z][A-Z0-9_]{0,63}$' or jsonb_typeof(v_actions) <> 'array' then return false; end if;
    if jsonb_array_length(v_actions)=0 then continue; end if;
    v_ceiling_actions := v_ceiling_modules->v_module;
    if jsonb_typeof(v_ceiling_actions) is distinct from 'array' then return false; end if;
    for v_action in select jsonb_array_elements_text(v_actions) loop
      if v_action not in ('view','create','update','delete','manage')
         or not exists (
           select 1 from jsonb_array_elements_text(v_ceiling_actions) AS allowed(action)
           where allowed.action=v_action
         ) then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$function$;

revoke all on function public.mnty_business_employee_permission_ceiling_allows(jsonb,varchar,uuid,varchar) from public, anon, authenticated;
revoke all on function public.mnty_business_employee_permissions_subset(jsonb,jsonb) from public, anon, authenticated;

create or replace function public.mnty_business_employee_list_scoped(
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then
    raise exception 'BUSINESS_TENANT_MISMATCH';
  end if;
  if p_branch_id is not null and not exists(
    select 1 from public.branches br
    where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id
  ) then
    raise exception 'BRANCH_BUSINESS_MISMATCH';
  end if;

  if not exists(
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.status='ACTIVE'
      and (
        (m.business_id=p_business_id and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
          and (m.branch_id is null or m.branch_id=p_branch_id))
        or (m.business_id is null and m.branch_id is null and upper(m.role) in ('OWNER','ADMIN'))
      )
  ) and not public.mnty_platform_has_permission('EMPLOYEES.VIEW',p_tenant_id,p_business_id,p_branch_id)
    and not public.mnty_platform_has_permission('EMPLOYEES.MANAGE',p_tenant_id,p_business_id,p_branch_id) then
    raise exception 'BUSINESS_HR_FORBIDDEN';
  end if;

  return jsonb_build_object(
    'positions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'tenant_id',p.tenant_id,'business_id',p.business_id,'branch_id',p.branch_id,
        'title',p.title,'description',p.description,'department',p.department,'employment_type',p.employment_type,
        'permission_template',p.permission_template,'is_hiring',p.is_hiring,'is_active',p.is_active,
        'created_at',p.created_at,'updated_at',p.updated_at
      ) order by p.created_at desc)
      from public.business_job_positions p
      where p.tenant_id=p_tenant_id and p.business_id=p_business_id
        and (p_branch_id is null or p.branch_id=p_branch_id)
    ),'[]'::jsonb),
    'employees',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'tenant_id',e.tenant_id,'business_id',e.business_id,'branch_id',e.branch_id,
        'user_id',e.user_id,'job_position_id',e.job_position_id,'position_title',p.title,
        'full_name',e.full_name,'email',e.email,'phone',e.phone,'status',e.status,
        'permission_overrides',e.permission_overrides,'hired_at',e.hired_at,'ended_at',e.ended_at,
        'created_at',e.created_at,'updated_at',e.updated_at
      ) order by e.created_at desc)
      from public.business_employees e
      join public.business_job_positions p on p.id=e.job_position_id
      where e.tenant_id=p_tenant_id and e.business_id=p_business_id
        and (p_branch_id is null or e.branch_id=p_branch_id)
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.mnty_business_employee_list_scoped(varchar,uuid,varchar) from public, anon;
grant execute on function public.mnty_business_employee_list_scoped(varchar,uuid,varchar) to authenticated;
comment on function public.mnty_business_employee_list_scoped(varchar,uuid,varchar) is 'RC457 branch-aware roster list. Business-wide owner/member sees the business scope; branch-scoped membership sees only the explicitly matching branch.';

-- Keep the legacy RPC name for existing callers, but route it through the strict
-- business-wide scope check. Branch-scoped users must call the scoped endpoint
-- with their explicitly authorized branch; the old endpoint cannot reveal a full roster.
create or replace function public.mnty_business_employee_list(p_tenant_id varchar, p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.mnty_business_employee_list_scoped(p_tenant_id,p_business_id,null);
end;
$function$;

revoke all on function public.mnty_business_employee_list(varchar,uuid) from public, anon;
grant execute on function public.mnty_business_employee_list(varchar,uuid) to authenticated;
comment on function public.mnty_business_employee_list(varchar,uuid) is 'RC457 compatibility wrapper. Delegates to the branch-aware function with no branch scope and therefore denies branch-only memberships instead of exposing the whole roster.';

create or replace function public.mnty_business_employee_position_upsert(
  p_tenant_id varchar,
  p_business_id uuid,
  p_title text,
  p_description text default '',
  p_department text default '',
  p_employment_type text default 'FULL_TIME',
  p_permission_template jsonb default '{"modules":{"HOME":["view"]}}'::jsonb,
  p_is_hiring boolean default false,
  p_is_active boolean default true,
  p_branch_id varchar default null,
  p_position_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_position public.business_job_positions%rowtype;
  v_old jsonb := '{}'::jsonb;
  v_revoked_overrides jsonb := '[]'::jsonb;
  v_permission text := case when p_position_id is null then 'EMPLOYEES.CREATE' else 'EMPLOYEES.UPDATE' end;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.status='ACTIVE'
       and (
         (m.business_id=p_business_id and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
           and (m.branch_id is null or m.branch_id=p_branch_id))
         or (m.business_id is null and m.branch_id is null and upper(m.role) in ('OWNER','ADMIN'))
       )
  ) and not public.mnty_platform_has_permission(v_permission,p_tenant_id,p_business_id,p_branch_id)
    and not public.mnty_platform_has_permission('EMPLOYEES.MANAGE',p_tenant_id,p_business_id,p_branch_id) then
    raise exception 'BUSINESS_HR_FORBIDDEN';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id) then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
  if nullif(trim(p_title),'') is null or p_employment_type not in ('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERN') or jsonb_typeof(p_permission_template)<>'object' then raise exception 'INVALID_POSITION'; end if;
  if not public.mnty_business_employee_permission_ceiling_allows(coalesce(p_permission_template,'{}'::jsonb),p_tenant_id,p_business_id,p_branch_id) then
    raise exception 'EMPLOYEE_PERMISSION_ESCALATION';
  end if;
  if p_position_id is null then
    insert into public.business_job_positions
      (tenant_id,business_id,branch_id,title,description,department,employment_type,permission_template,is_hiring,is_active,created_by,updated_by)
    values
      (p_tenant_id,p_business_id,p_branch_id,trim(p_title),coalesce(p_description,''),coalesce(p_department,''),p_employment_type,p_permission_template,coalesce(p_is_hiring,false),coalesce(p_is_active,true),v_actor,v_actor)
    returning * into v_position;
  else
    select * into v_position from public.business_job_positions where id=p_position_id and tenant_id=p_tenant_id and business_id=p_business_id and (p_branch_id is null or branch_id=p_branch_id) for update;
    if not found then raise exception 'POSITION_NOT_FOUND'; end if;
    v_old:=jsonb_build_object('title',v_position.title,'department',v_position.department,'employment_type',v_position.employment_type,'permission_template',v_position.permission_template,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active);
    update public.business_job_positions set branch_id=p_branch_id,title=trim(p_title),description=coalesce(p_description,''),department=coalesce(p_department,''),employment_type=p_employment_type,permission_template=p_permission_template,is_hiring=coalesce(p_is_hiring,false),is_active=coalesce(p_is_active,true),updated_by=v_actor,updated_at=now()
    where id=p_position_id returning * into v_position;
  end if;
  -- A position may narrow or replace its permission template. Clear any old per-employee
  -- override that is no longer a subset of the new template before syncing memberships.
  -- This prevents a stale FINANCE.MANAGE (or other old grant) from surviving a role reduction.
  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id',e.id,
    'permission_overrides',e.permission_overrides
  ) order by e.id),'[]'::jsonb)
  into v_revoked_overrides
  from public.business_employees e
  where e.job_position_id=v_position.id
    and e.tenant_id=p_tenant_id and e.business_id=p_business_id
    and not public.mnty_business_employee_permissions_subset(
      coalesce(e.permission_overrides,'{}'::jsonb),
      coalesce(v_position.permission_template,'{}'::jsonb)
    );

  if jsonb_array_length(v_revoked_overrides) > 0 then
    update public.business_employees e
      set permission_overrides='{}'::jsonb, updated_by=v_actor, updated_at=now()
    where e.job_position_id=v_position.id
      and e.tenant_id=p_tenant_id and e.business_id=p_business_id
      and e.id in (
        select (revoked.value->>'employee_id')::uuid
        from jsonb_array_elements(v_revoked_overrides) as revoked(value)
      );
  end if;

  -- Permission and activation changes propagate immediately to memberships linked to this position.
  update public.user_memberships m
    set permissions=coalesce(v_position.permission_template,'{}'::jsonb)||coalesce(e.permission_overrides,'{}'::jsonb),
        status=case when e.status='ACTIVE' and v_position.is_active then 'ACTIVE' else 'INACTIVE' end
  from public.business_employees e
  where e.job_position_id=v_position.id and e.business_id=p_business_id and e.tenant_id=p_tenant_id
    and e.user_id=m.user_id
    and m.id='MNTY-EMPLOYEE-'||replace(e.id::text,'-','')
    and upper(m.role)='EMPLOYEE';

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,p_tenant_id,v_actor,case when p_position_id is null then 'BUSINESS_JOB_POSITION_CREATED' else 'BUSINESS_JOB_POSITION_UPDATED' end,'business_job_position',v_position.id::text,v_old,
    jsonb_build_object('business_id',p_business_id,'branch_id',v_position.branch_id,'title',v_position.title,'department',v_position.department,'employment_type',v_position.employment_type,'permission_template',v_position.permission_template,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active,'revoked_employee_overrides',v_revoked_overrides),'SUCCESS');
  return jsonb_build_object('id',v_position.id,'title',v_position.title,'is_hiring',v_position.is_hiring,'is_active',v_position.is_active);
end;
$function$;

-- Link an active employee only to the existing Supabase identity with the same email.
-- The EMPLOYEE membership carries a scoped permission document; it is not mapped to OWNER/ADMIN.

create or replace function public.mnty_business_employee_upsert(
  p_tenant_id varchar,
  p_business_id uuid,
  p_job_position_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default '',
  p_user_id uuid default null,
  p_status text default 'INVITED',
  p_permission_overrides jsonb default '{}'::jsonb,
  p_branch_id varchar default null,
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_employee public.business_employees%rowtype;
  v_position public.business_job_positions%rowtype;
  v_old jsonb := '{}'::jsonb;
  v_user_id uuid;
  v_previous_user_id uuid;
  v_org_id public.businesses.organization_id%type;
  v_membership_id text;
  v_effective_permissions jsonb;
  v_permission text := case when p_employee_id is null then 'EMPLOYEES.CREATE' else 'EMPLOYEES.UPDATE' end;
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=v_actor and m.tenant_id=p_tenant_id and m.status='ACTIVE'
       and (
         (m.business_id=p_business_id and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN')
           and (m.branch_id is null or m.branch_id=p_branch_id))
         or (m.business_id is null and m.branch_id is null and upper(m.role) in ('OWNER','ADMIN'))
       )
  ) and not public.mnty_platform_has_permission(v_permission,p_tenant_id,p_business_id,p_branch_id)
    and not public.mnty_platform_has_permission('EMPLOYEES.MANAGE',p_tenant_id,p_business_id,p_branch_id) then
    raise exception 'BUSINESS_HR_FORBIDDEN';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
  select * into v_position from public.business_job_positions p
    where p.id=p_job_position_id and p.tenant_id=p_tenant_id and p.business_id=p_business_id and p.is_active and (p_branch_id is null or p.branch_id=p_branch_id);
  if not found then raise exception 'ACTIVE_POSITION_REQUIRED'; end if;
  if not public.mnty_business_employee_permissions_subset(coalesce(p_permission_overrides,'{}'::jsonb),coalesce(v_position.permission_template,'{}'::jsonb)) then
    raise exception 'EMPLOYEE_PERMISSION_ESCALATION';
  end if;
  if p_branch_id is not null and not exists(select 1 from public.branches br where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id) then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
  if nullif(trim(p_full_name),'') is null or position('@' in coalesce(p_email,''))<2
    or jsonb_typeof(coalesce(p_permission_overrides,'{}'::jsonb))<>'object'
    or p_status not in ('INVITED','ACTIVE','SUSPENDED','ENDED') then raise exception 'INVALID_EMPLOYEE'; end if;

  select u.id into v_user_id from auth.users u where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null limit 1;
  if p_user_id is not null then
    if not exists(select 1 from auth.users u where u.id=p_user_id and lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null) then raise exception 'AUTH_USER_EMAIL_MISMATCH_OR_UNCONFIRMED'; end if;
    v_user_id:=p_user_id;
  end if;
  if p_status='ACTIVE' and v_user_id is null then raise exception 'ACTIVE_EMPLOYEE_REQUIRES_CONFIRMED_AUTH_USER'; end if;
  if p_employee_id is null then
    insert into public.business_employees
      (tenant_id,business_id,branch_id,user_id,job_position_id,full_name,email,phone,status,permission_overrides,hired_at,created_by,updated_by)
    values
      (p_tenant_id,p_business_id,p_branch_id,v_user_id,p_job_position_id,trim(p_full_name),lower(trim(p_email)),coalesce(p_phone,''),p_status,coalesce(p_permission_overrides,'{}'::jsonb),case when p_status='ACTIVE' then current_date else null end,v_actor,v_actor)
    returning * into v_employee;
  else
    select * into v_employee from public.business_employees where id=p_employee_id and tenant_id=p_tenant_id and business_id=p_business_id and (p_branch_id is null or branch_id=p_branch_id) for update;
    if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
    v_old:=jsonb_build_object('user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'status',v_employee.status,'permission_overrides',v_employee.permission_overrides);
    v_previous_user_id:=v_employee.user_id;
    update public.business_employees set branch_id=p_branch_id,user_id=v_user_id,job_position_id=p_job_position_id,full_name=trim(p_full_name),email=lower(trim(p_email)),phone=coalesce(p_phone,''),status=p_status,permission_overrides=coalesce(p_permission_overrides,'{}'::jsonb),
      hired_at=case when p_status='ACTIVE' then coalesce(hired_at,current_date) else hired_at end,
      ended_at=case when p_status='ENDED' then coalesce(ended_at,current_date) else null end,
      updated_by=v_actor,updated_at=now()
    where id=p_employee_id returning * into v_employee;
  end if;

  -- Revoke the old employee membership before linking a changed email/identity.
  if v_previous_user_id is not null and v_previous_user_id is distinct from v_employee.user_id then
    update public.user_memberships
      set status='INACTIVE'
      where id='MNTY-EMPLOYEE-'||replace(v_employee.id::text,'-','')
        and user_id=v_previous_user_id and tenant_id=p_tenant_id and business_id=p_business_id
        and upper(role)='EMPLOYEE';
  end if;

  if v_employee.user_id is not null then
    select b.organization_id into v_org_id from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id;
    v_membership_id:='MNTY-EMPLOYEE-'||replace(v_employee.id::text,'-','');
    v_effective_permissions:=coalesce(v_position.permission_template,'{}'::jsonb)||coalesce(v_employee.permission_overrides,'{}'::jsonb);
    if v_employee.status='ACTIVE' then
      insert into public.user_memberships(id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
      values(v_membership_id,v_employee.user_id,p_tenant_id,v_org_id,p_business_id,v_employee.branch_id,'EMPLOYEE',v_effective_permissions,'ACTIVE')
      on conflict(id) do update set user_id=excluded.user_id,tenant_id=excluded.tenant_id,organization_id=excluded.organization_id,business_id=excluded.business_id,branch_id=excluded.branch_id,role='EMPLOYEE',permissions=excluded.permissions,status='ACTIVE';
    else
      update public.user_memberships set status=case when v_employee.status='SUSPENDED' then 'SUSPENDED' else 'INACTIVE' end
      where id=v_membership_id and user_id=v_employee.user_id and business_id=p_business_id;
    end if;
  end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,p_tenant_id,v_actor,case when p_status in ('SUSPENDED','ENDED') then 'BUSINESS_EMPLOYEE_STATUS_CHANGED' else 'BUSINESS_EMPLOYEE_UPSERTED' end,'business_employee',v_employee.id::text,v_old,
    jsonb_build_object('business_id',p_business_id,'branch_id',v_employee.branch_id,'user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'full_name',v_employee.full_name,'email',v_employee.email,'status',v_employee.status,'permission_overrides',v_employee.permission_overrides),'SUCCESS');
  return jsonb_build_object('id',v_employee.id,'business_id',v_employee.business_id,'user_id',v_employee.user_id,'job_position_id',v_employee.job_position_id,'status',v_employee.status);
end;
$function$;


revoke all on function public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid) from public, anon;
revoke all on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) from public, anon;
grant execute on function public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid) to authenticated;
grant execute on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) to authenticated;

comment on function public.mnty_business_employee_permission_ceiling_allows(jsonb,varchar,uuid,varchar) is 'RC457 scoped permission ceiling: a delegated employee can only grant module/actions already held at the same tenant/business/branch scope.';
comment on function public.mnty_business_employee_permissions_subset(jsonb,jsonb) is 'RC457 employee-specific overrides must be a subset of the selected job position permission template.';
comment on function public.mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid) is 'RC457 forward repair: position permissions cannot exceed the caller authority unless the caller is a trusted owner/admin.';
comment on function public.mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid) is 'RC457 forward repair: employee permission overrides cannot exceed the selected position template.';

-- END RECONCILED SOURCE: supabase/migrations/20261028225000_rc457_business_employee_permission_ceiling.sql