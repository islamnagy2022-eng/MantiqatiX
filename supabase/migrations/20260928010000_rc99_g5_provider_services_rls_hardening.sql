-- RC99 G5: provider-service ownership and platform service catalog write hardening.
drop policy if exists "authenticated_sessions_only" on public.marketing_provider_services;
drop policy if exists "mnt_non_anonymous_boundary" on public.marketing_provider_services;
drop policy if exists "non_anonymous_authenticated_guard" on public.marketing_provider_services;

create policy marketing_provider_services_owner_manage
on public.marketing_provider_services
for all to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1 from public.marketing_provider_profiles p
    where p.id = marketing_provider_services.provider_id
      and p.owner_user_id = auth.uid()
  )
)
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1 from public.marketing_provider_profiles p
    where p.id = marketing_provider_services.provider_id
      and p.owner_user_id = auth.uid()
  )
);

drop policy if exists "authenticated_sessions_only" on public.marketing_services;
drop policy if exists "mnt_non_anonymous_boundary" on public.marketing_services;
drop policy if exists "non_anonymous_authenticated_guard" on public.marketing_services;

create policy marketing_services_admin_manage
on public.marketing_services
for all to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1 from public.user_memberships m
    where m.user_id=auth.uid()
      and coalesce(m.status,'ACTIVE')='ACTIVE'
      and upper(m.role) in ('SUPER_ADMIN','ADMIN','OWNER')
  )
)
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1 from public.user_memberships m
    where m.user_id=auth.uid()
      and coalesce(m.status,'ACTIVE')='ACTIVE'
      and upper(m.role) in ('SUPER_ADMIN','ADMIN','OWNER')
  )
);
