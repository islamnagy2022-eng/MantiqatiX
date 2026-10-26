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
