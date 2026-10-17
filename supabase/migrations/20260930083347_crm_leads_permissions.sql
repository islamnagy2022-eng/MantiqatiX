grant select, insert on table public.marketing_leads to authenticated;
grant select on table public.marketing_provider_profiles to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='marketing_leads' and policyname='CRM managers view marketing leads') then
    create policy "CRM managers view marketing leads"
      on public.marketing_leads
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.user_memberships um
          where um.user_id = auth.uid()
            and um.status = 'ACTIVE'
            and upper(coalesce(um.role::text,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='marketing_provider_profiles' and policyname='CRM managers view marketing providers') then
    create policy "CRM managers view marketing providers"
      on public.marketing_provider_profiles
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.user_memberships um
          where um.user_id = auth.uid()
            and um.status = 'ACTIVE'
            and upper(coalesce(um.role::text,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
        )
      );
  end if;
end $$;