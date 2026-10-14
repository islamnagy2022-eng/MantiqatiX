-- RC526: protect the shared platform-wide marketing services catalogue.
-- This table has no tenant/business key; tenant administrators must not mutate shared definitions.
-- Platform-wide writes require active MNTY-PLATFORM SUPER_ADMIN with explicit full-control scope.
drop policy if exists "marketing_services_admin_manage" on public.marketing_services;
create policy "marketing_services_admin_manage"
  on public.marketing_services
  for all
  to authenticated
  using (
    coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
    and exists (
      select 1
      from public.user_memberships platform_admin
      where platform_admin.user_id = auth.uid()
        and platform_admin.status = 'ACTIVE'
        and upper(platform_admin.role) = 'SUPER_ADMIN'
        and platform_admin.tenant_id = 'MNTY-PLATFORM'
        and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
    )
  )
  with check (
    coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
    and exists (
      select 1
      from public.user_memberships platform_admin
      where platform_admin.user_id = auth.uid()
        and platform_admin.status = 'ACTIVE'
        and upper(platform_admin.role) = 'SUPER_ADMIN'
        and platform_admin.tenant_id = 'MNTY-PLATFORM'
        and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
    )
  );
