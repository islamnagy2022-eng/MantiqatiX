-- RC115: enforce business-bound CRM reads and keep pending onboarding private.
drop policy if exists "CRM managers view marketing leads" on public.marketing_leads;
create policy "CRM managers view marketing leads"
  on public.marketing_leads for select to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and (
      requester_user_id = auth.uid()
      or exists (
      select 1 from public.user_memberships um
      where um.user_id = auth.uid()
        and um.tenant_id = 'MNTY-PLATFORM'
        and um.status = 'ACTIVE'
        and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN')
        and coalesce(um.permissions->>'scope','') = 'PLATFORM'
        and coalesce(um.permissions->>'full_control','false') = 'true'
    )
    or (
      requester_business_id is not null
      and exists (
        select 1
        from public.user_memberships um
        join public.businesses b on b.id = requester_business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and (um.business_id is null or um.business_id = requester_business_id)
          and um.tenant_id = b.tenant_id
          and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
      )
    )
    )
  );

drop policy if exists "Users view own marketing leads" on public.marketing_leads;
create policy "Users view own marketing leads"
  on public.marketing_leads for select to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and requester_user_id = auth.uid()
  );

drop policy if exists "CRM managers view marketing providers" on public.marketing_provider_profiles;
create policy "CRM managers view marketing providers"
  on public.marketing_provider_profiles for select to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and (
      exists (
      select 1 from public.user_memberships um
      where um.user_id = auth.uid()
        and um.tenant_id = 'MNTY-PLATFORM'
        and um.status = 'ACTIVE'
        and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN')
        and coalesce(um.permissions->>'scope','') = 'PLATFORM'
        and coalesce(um.permissions->>'full_control','false') = 'true'
    )
    or (
      business_id is not null
      and exists (
        select 1
        from public.user_memberships um
        join public.businesses b on b.id = marketing_provider_profiles.business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and (um.business_id is null or um.business_id = marketing_provider_profiles.business_id)
          and um.tenant_id = b.tenant_id
          and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
          and (
            upper(coalesce(marketing_provider_profiles.status,'')) = 'ACTIVE'
            or upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','BUSINESS_OWNER')
          )
      )
    )
    )
  );
