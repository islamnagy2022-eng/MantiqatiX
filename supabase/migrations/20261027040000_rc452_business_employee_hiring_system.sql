-- RC452: activity-owned employee and hiring workspace.
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
  constraint business_job_positions_tenant_business_fk
    foreign key (tenant_id,business_id) references public.businesses(tenant_id,id) on delete cascade,
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
  constraint business_employees_tenant_business_fk
    foreign key (tenant_id,business_id) references public.businesses(tenant_id,id) on delete cascade,
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

comment on table public.business_job_positions is 'RC452: business-owned hiring positions and permission templates.';
comment on table public.business_employees is 'RC452: scoped employee roster and lifecycle per business.';
