-- Give the existing platform Owner account persistent role-switching contexts
-- for the operational roles represented by the application.
-- SUPER_ADMIN remains a distinct platform authority and is intentionally excluded.
insert into public.user_memberships
  (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
select
  'MNTY-OWNER-' || lower(role_name),
  pa.user_id,
  owner.tenant_id,
  owner.organization_id,
  null,
  null,
  role_name,
  '[]'::jsonb,
  'ACTIVE'
from private.platform_admins pa
join public.user_memberships owner
  on owner.user_id=pa.user_id
 and owner.role='OWNER'
 and owner.status='ACTIVE'
cross join (values
  ('ADMIN'),
  ('MANAGER'),
  ('BUSINESS_OWNER'),
  ('SUPPORT'),
  ('SUPPORT_MANAGER'),
  ('EMPLOYEE'),
  ('STAFF'),
  ('CUSTOMER'),
  ('SERVICE_PROVIDER')
) as roles(role_name)
where not exists (
  select 1
  from public.user_memberships existing
  where existing.user_id=pa.user_id
    and existing.tenant_id=owner.tenant_id
    and existing.role=role_name
    and existing.status='ACTIVE'
);
