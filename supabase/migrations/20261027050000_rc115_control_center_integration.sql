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

  select u.id into v_user_id from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if p_user_id is not null then
    if not exists(select 1 from auth.users u where u.id=p_user_id and lower(u.email)=lower(trim(p_email))) then raise exception 'AUTH_USER_EMAIL_MISMATCH'; end if;
    v_user_id:=p_user_id;
  end if;
  if p_status='ACTIVE' and v_user_id is null then raise exception 'ACTIVE_EMPLOYEE_REQUIRES_AUTH_USER'; end if;
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
    update public.business_employees set branch_id=p_branch_id,user_id=v_user_id,job_position_id=p_job_position_id,full_name=trim(p_full_name),email=lower(trim(p_email)),phone=coalesce(p_phone,''),status=p_status,permission_overrides=coalesce(p_permission_overrides,'{}'::jsonb),
      hired_at=case when p_status='ACTIVE' then coalesce(hired_at,current_date) else hired_at end,
      ended_at=case when p_status='ENDED' then coalesce(ended_at,current_date) else null end,
      updated_by=v_actor,updated_at=now()
    where id=p_employee_id returning * into v_employee;
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
