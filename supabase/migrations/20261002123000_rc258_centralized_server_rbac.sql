-- RC258: centralized server-side RBAC authorization contract
create or replace function public.mnty_active_membership(p_tenant_id varchar default null,p_business_id uuid default null,p_branch_id varchar default null)
returns table(membership_id varchar,tenant_id varchar,organization_id varchar,business_id uuid,branch_id varchar,role varchar,permissions jsonb)
language sql stable security definer set search_path=public
as $function$
select m.id,m.tenant_id,m.organization_id,m.business_id,m.branch_id,m.role,coalesce(m.permissions,'{}'::jsonb)
from public.user_memberships m
where m.user_id=auth.uid() and m.status='ACTIVE'
and (p_tenant_id is null or m.tenant_id=p_tenant_id)
and (p_business_id is null or m.business_id=p_business_id or m.business_id is null)
and (p_branch_id is null or m.branch_id=p_branch_id or m.branch_id is null)
order by case upper(m.role) when 'SUPER_ADMIN' then 0 when 'OWNER' then 1 when 'ADMIN' then 2 when 'BUSINESS_OWNER' then 3 when 'MANAGER' then 4 when 'FINANCE_MANAGER' then 5 when 'SERVICE_PROVIDER' then 6 when 'STAFF' then 7 else 99 end,m.created_at asc
$function$;

create or replace function public.mnty_can(p_permission text,p_tenant_id varchar default null,p_business_id uuid default null,p_branch_id varchar default null)
returns boolean language sql stable security definer set search_path=public
as $function$
select exists(select 1 from public.mnty_active_membership(p_tenant_id,p_business_id,p_branch_id) m
where ((upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true)
or coalesce((m.permissions->>p_permission)::boolean,false)
or case upper(m.role)
when 'OWNER' then p_permission in ('admin','owner','platform','all_modules','manage_users','manage_business','manage_branches','manage_catalog','manage_orders','manage_crm','manage_marketing','manage_finance','manage_content','manage_reports')
when 'BUSINESS_OWNER' then p_permission in ('owner','manage_business','manage_branches','manage_catalog','manage_orders','manage_crm','manage_marketing','manage_content','manage_reports')
when 'ADMIN' then p_permission in ('admin','manage_users','manage_business','manage_branches','manage_catalog','manage_orders','manage_crm','manage_marketing','manage_content','manage_reports')
when 'MANAGER' then p_permission in ('manage_branches','manage_catalog','manage_orders','manage_crm','manage_marketing','manage_content','manage_reports')
when 'FINANCE_MANAGER' then p_permission in ('manage_finance','manage_reports')
when 'SERVICE_PROVIDER' then p_permission in ('provider','provider_orders','provider_profile','provider_schedule','provider_finance')
when 'STAFF' then p_permission in ('staff','manage_orders','provider_orders')
when 'SUPPORT_MANAGER' then p_permission in ('support','manage_crm','manage_reports')
when 'SUPPORT' then p_permission in ('support')
when 'EMPLOYEE' then p_permission in ('employee')
when 'CUSTOMER' then p_permission in ('customer')
else false end));
$function$;

create or replace function public.mnty_can_platform_admin() returns boolean
language sql stable security definer set search_path=public
as $function$ select public.mnty_can('admin',null,null,null) $function$;

revoke all on function public.mnty_active_membership(varchar,uuid,varchar) from public;
revoke all on function public.mnty_can(text,varchar,uuid,varchar) from public;
revoke all on function public.mnty_can_platform_admin() from public;
grant execute on function public.mnty_active_membership(varchar,uuid,varchar) to authenticated;
grant execute on function public.mnty_can(text,varchar,uuid,varchar) to authenticated;
grant execute on function public.mnty_can_platform_admin() to authenticated;

comment on function public.mnty_active_membership(varchar,uuid,varchar) is 'RC258 server-side RBAC scope resolver.';
comment on function public.mnty_can(text,varchar,uuid,varchar) is 'RC258 server-side RBAC permission contract.';
comment on function public.mnty_can_platform_admin() is 'RC258 authenticated platform administrator guard.';