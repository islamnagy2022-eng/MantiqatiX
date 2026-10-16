-- RC527: require JSON boolean true for platform full-control in marketing CRM policies.
-- Forward-only correction; RC452 remains immutable. Run after RC452 and RC526.
-- Text values such as "true" must not satisfy platform authorization.
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
        and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
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

-- A caller may submit a lead for themself, but may not spoof another business.

drop policy if exists "Users create marketing leads" on public.marketing_leads;
create policy "Users create marketing leads"
  on public.marketing_leads
  for insert
  to authenticated
  with check (
    requester_user_id = auth.uid()
    and (
      requester_business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b on b.id = public.marketing_leads.requester_business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.tenant_id = b.tenant_id
          and (
            um.business_id = b.id
            or (
              um.business_id is null
              and upper(coalesce(um.role, '')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
            )
          )
      )
      or exists (
        select 1 from public.user_memberships platform_admin
        where platform_admin.user_id = auth.uid()
          and platform_admin.status = 'ACTIVE'
          and upper(platform_admin.role) = 'SUPER_ADMIN'
          and platform_admin.tenant_id = 'MNTY-PLATFORM'
          and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
      )
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
        and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
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

-- Provider profiles may only be attached to a business within the owner's active membership scope.

drop policy if exists "Owners manage their marketing provider profile" on public.marketing_provider_profiles;
create policy "Owners manage their marketing provider profile"
  on public.marketing_provider_profiles
  for all
  to authenticated
  using (
    owner_user_id = auth.uid()
    and (
      business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b on b.id = public.marketing_provider_profiles.business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.tenant_id = b.tenant_id
          and (
            um.business_id = b.id
            or (
              um.business_id is null
              and upper(coalesce(um.role, '')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
            )
          )
      )
      or exists (
        select 1 from public.user_memberships platform_admin
        where platform_admin.user_id = auth.uid()
          and platform_admin.status = 'ACTIVE'
          and upper(platform_admin.role) = 'SUPER_ADMIN'
          and platform_admin.tenant_id = 'MNTY-PLATFORM'
          and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
      )
    )
  )
  with check (
    owner_user_id = auth.uid()
    and (
      business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b on b.id = public.marketing_provider_profiles.business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.tenant_id = b.tenant_id
          and (
            um.business_id = b.id
            or (
              um.business_id is null
              and upper(coalesce(um.role, '')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
            )
          )
      )
      or exists (
        select 1 from public.user_memberships platform_admin
        where platform_admin.user_id = auth.uid()
          and platform_admin.status = 'ACTIVE'
          and upper(platform_admin.role) = 'SUPER_ADMIN'
          and platform_admin.tenant_id = 'MNTY-PLATFORM'
          and platform_admin.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb
      )
    )
  );

-- Assigned providers may read only leads assigned to their own active provider profile.
