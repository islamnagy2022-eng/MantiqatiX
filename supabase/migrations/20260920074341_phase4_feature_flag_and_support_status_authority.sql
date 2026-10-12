
create or replace function public.set_platform_feature_flag_backend(
 p_scope_type varchar,p_scope_id varchar,p_sector_id varchar,p_tenant_id varchar,
 p_business_id uuid,p_branch_id varchar,p_module_code varchar,p_feature_code varchar,
 p_enabled boolean,p_configuration jsonb default '{}'::jsonb)
returns public.platform_feature_flags
language plpgsql security definer set search_path=public as $$
declare r public.platform_feature_flags;
begin
 if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 insert into public.platform_feature_flags(scope_type,scope_id,sector_id,tenant_id,business_id,branch_id,module_code,feature_code,enabled,configuration,updated_by)
 values(p_scope_type,p_scope_id,p_sector_id,p_tenant_id,p_business_id,p_branch_id,p_module_code,p_feature_code,p_enabled,coalesce(p_configuration,'{}'::jsonb),auth.uid())
 on conflict (scope_type,coalesce(scope_id,''),coalesce(sector_id,''),coalesce(tenant_id,''),coalesce(business_id::text,''),coalesce(branch_id,''),module_code,feature_code)
 do update set enabled=excluded.enabled,configuration=excluded.configuration,updated_by=auth.uid(),updated_at=now()
 returning * into r;
 return r;
end $$;
grant execute on function public.set_platform_feature_flag_backend(varchar,varchar,varchar,varchar,uuid,varchar,varchar,varchar,boolean,jsonb) to authenticated;

create or replace function public.update_support_ticket_status_backend(
 p_ticket_id varchar,p_status varchar,p_assigned_user_id uuid default null)
returns public.support_tickets
language plpgsql security definer set search_path=public as $$
declare r public.support_tickets;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(
   select 1 from public.support_tickets t
   join public.user_memberships m on m.tenant_id=t.tenant_id
   where t.id=p_ticket_id and m.user_id=auth.uid() and m.status='ACTIVE'
   and m.role in ('ADMIN','SUPER_ADMIN','MANAGER','SUPPORT','SUPPORT_AGENT')
 ) then raise exception 'SUPPORT_ACCESS_DENIED'; end if;
 if p_status not in ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') then raise exception 'INVALID_STATUS'; end if;
 update public.support_tickets
 set status=p_status, assigned_user_id=coalesce(p_assigned_user_id,assigned_user_id),
     updated_at=now(), closed_at=case when p_status='CLOSED' then now() else closed_at end
 where id=p_ticket_id returning * into r;
 return r;
end $$;
grant execute on function public.update_support_ticket_status_backend(varchar,varchar,uuid) to authenticated;
