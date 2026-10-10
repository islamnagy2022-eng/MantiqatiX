-- RC444: scope CRM manager reads to the row's business; platform-wide reads require explicit full control.
drop policy if exists "CRM managers view marketing leads" on public.marketing_leads;
create policy "CRM managers view marketing leads"
  on public.marketing_leads
  for select
  to authenticated
  using (
    requester_user_id = auth.uid()
    or exists (
      select 1
      from public.user_memberships um
      where um.user_id=auth.uid()
        and um.tenant_id='MNTY-PLATFORM'
        and um.status='ACTIVE'
        and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN')
        and coalesce(um.permissions->>'scope','')='PLATFORM'
        and coalesce((um.permissions->>'full_control')::boolean,false)=true
    )
    or (
      requester_business_id is not null
      and exists (
        select 1
        from public.user_memberships um
        where um.user_id=auth.uid()
          and um.status='ACTIVE'
          and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
          and um.business_id=marketing_leads.requester_business_id
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
      from public.user_memberships um
      where um.user_id=auth.uid()
        and um.tenant_id='MNTY-PLATFORM'
        and um.status='ACTIVE'
        and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN')
        and coalesce(um.permissions->>'scope','')='PLATFORM'
        and coalesce((um.permissions->>'full_control')::boolean,false)=true
    )
    or (
      business_id is not null
      and exists (
        select 1
        from public.user_memberships um
        where um.user_id=auth.uid()
          and um.status='ACTIVE'
          and upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
          and um.business_id=marketing_provider_profiles.business_id
      )
    )
  );
