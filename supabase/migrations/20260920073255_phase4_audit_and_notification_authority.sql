create or replace function public.append_audit_log_backend(
 p_id varchar,
 p_tenant_id varchar,
 p_organization_id varchar default null,
 p_business_id uuid default null,
 p_branch_id varchar default null,
 p_action varchar default 'UNKNOWN',
 p_entity_type varchar default 'UNKNOWN',
 p_entity_id varchar default '',
 p_old_values jsonb default null,
 p_new_values jsonb default null,
 p_result varchar default 'SUCCESS'
) returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.audit_logs;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (
   select 1 from public.user_memberships m
   where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
 ) then raise exception 'TENANT_ACCESS_DENIED'; end if;
 if upper(coalesce(p_result,'SUCCESS')) not in ('SUCCESS','FAILURE','DENIED','ERROR') then
   raise exception 'INVALID_AUDIT_RESULT';
 end if;
 insert into public.audit_logs(
   id,tenant_id,organization_id,business_id,branch_id,actor_user_id,
   action,entity_type,entity_id,old_values,new_values,result,created_at
 ) values (
   p_id,p_tenant_id,p_organization_id,p_business_id,p_branch_id,auth.uid(),
   p_action,p_entity_type,p_entity_id,p_old_values,p_new_values,p_result,now()
 )
 returning * into v_row;
 return v_row;
end;
$$;

create or replace function public.create_notification_backend(
 p_id varchar,
 p_tenant_id varchar,
 p_user_id uuid,
 p_type varchar,
 p_title varchar,
 p_body text,
 p_entity_type varchar default null,
 p_entity_id varchar default null
) returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.notifications;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (
   select 1 from public.user_memberships m
   where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
 ) and not public.is_platform_admin() then
   raise exception 'TENANT_ACCESS_DENIED';
 end if;
 if not exists (
   select 1 from public.user_memberships m
   where m.user_id=p_user_id and m.tenant_id=p_tenant_id and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
 ) then
   raise exception 'RECIPIENT_NOT_IN_TENANT';
 end if;
 insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id,created_at)
 values(p_id,p_tenant_id,p_user_id,p_type,p_title,p_body,p_entity_type,p_entity_id,now())
 returning * into v_row;
 return v_row;
end;
$$;

revoke all on function public.append_audit_log_backend(varchar,varchar,varchar,uuid,varchar,varchar,varchar,varchar,jsonb,jsonb,varchar) from public;
grant execute on function public.append_audit_log_backend(varchar,varchar,varchar,uuid,varchar,varchar,varchar,varchar,jsonb,jsonb,varchar) to authenticated;

revoke all on function public.create_notification_backend(varchar,varchar,uuid,varchar,varchar,text,varchar,varchar) from public;
grant execute on function public.create_notification_backend(varchar,varchar,uuid,varchar,varchar,text,varchar,varchar) to authenticated;
