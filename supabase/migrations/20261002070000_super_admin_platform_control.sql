-- RC220: authoritative SUPER_ADMIN tenant context.
insert into public.user_memberships
  (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
select 'MNTY-SUPER-ADMIN-' || lower(t.id) || '-' || replace(pa.user_id::text,'-',''),pa.user_id,t.id,null,null,null,'SUPER_ADMIN',jsonb_build_object('scope','PLATFORM','full_control',true),'ACTIVE'
from private.platform_admins pa cross join public.tenants t
where t.status='ACTIVE' and not exists (select 1 from public.user_memberships um where um.user_id=pa.user_id and um.tenant_id=t.id and upper(um.role)='SUPER_ADMIN' and um.status='ACTIVE');
