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
