-- RC452: scope CRM access to marketing leads and provider profiles by tenant/business.
-- Existing owner/public-directory access is preserved. Platform-wide access requires an explicit
-- active MNTY-PLATFORM SUPER_ADMIN membership with PLATFORM scope and full_control=true.
drop policy if exists "CRM managers view marketing leads" on public.marketing_leads;
create policy "CRM managers view marketing leads"
  on public.marketing_leads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_memberships platform_admin
      where platform_admin.user_id = auth.uid()
        and platform_admin.status = 'ACTIVE'
        and upper(platform_admin.role) = 'SUPER_ADMIN'
        and platform_admin.tenant_id = 'MNTY-PLATFORM'
        and platform_admin.permissions ->> 'scope' = 'PLATFORM'
        and platform_admin.permissions ->> 'full_control' = 'true'
    )
    or exists (
      select 1
      from public.user_memberships um
      join public.businesses b
        on b.id = public.marketing_leads.requester_business_id
      where um.user_id = auth.uid()
        and um.status = 'ACTIVE'
        and upper(coalesce(um.role, '')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
        and um.tenant_id = b.tenant_id
        and (um.business_id is null or um.business_id = b.id)
    )
  );

drop policy if exists "CRM managers view marketing providers" on public.marketing_provider_profiles;
create policy "CRM managers view marketing providers"
  on public.marketing_provider_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_memberships platform_admin
      where platform_admin.user_id = auth.uid()
        and platform_admin.status = 'ACTIVE'
        and upper(platform_admin.role) = 'SUPER_ADMIN'
        and platform_admin.tenant_id = 'MNTY-PLATFORM'
        and platform_admin.permissions ->> 'scope' = 'PLATFORM'
        and platform_admin.permissions ->> 'full_control' = 'true'
    )
    or exists (
      select 1
      from public.user_memberships um
      join public.businesses b
        on b.id = public.marketing_provider_profiles.business_id
      where um.user_id = auth.uid()
        and um.status = 'ACTIVE'
        and upper(coalesce(um.role, '')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
        and um.tenant_id = b.tenant_id
        and (um.business_id is null or um.business_id = b.id)
    )
  );

-- Assigned providers may read only leads assigned to their own active provider profile.
drop policy if exists "Assigned providers view assigned marketing leads" on public.marketing_leads;
create policy "Assigned providers view assigned marketing leads"
  on public.marketing_leads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.marketing_provider_profiles p
      where p.id = public.marketing_leads.assigned_provider_id
        and p.owner_user_id = auth.uid()
        and p.status = 'ACTIVE'
    )
  );
