-- RC116: bind direct CRM writes to the caller's own business membership.
-- Canonical lead creation remains in marketing-lead-create (service role).
-- Direct inserts are retained only as a constrained compatibility path.
drop policy if exists "Users create marketing leads" on public.marketing_leads;
create policy "Users create marketing leads"
  on public.marketing_leads
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and requester_user_id = auth.uid()
    and status = 'OPEN'
    and source = 'PLATFORM'
    and currency = 'EGP'
    and assigned_provider_id is null
    and (
      requester_business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b
          on b.id = public.marketing_leads.requester_business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.business_id = b.id
          and um.tenant_id = b.tenant_id
      )
    )
  );

-- A provider profile is created through the reviewed onboarding/admin path.
-- Owners may read their own profile and edit only its branding assets; they
-- cannot create/delete profiles or change its business, ownership, or approval state.
drop policy if exists "Owners manage their marketing provider profile" on public.marketing_provider_profiles;

-- Legacy owner profiles with business_id NULL (including the RC926 owner fixture)
-- retain owner-only branding access. Their business_id cannot be changed because it
-- is not included in the authenticated UPDATE column grants below. A bound profile
-- still requires an exact ACTIVE membership for that business and tenant.
create policy "Owners view own marketing provider profile"
  on public.marketing_provider_profiles
  for select
  to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and owner_user_id = auth.uid()
    and (
      business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b
          on b.id = public.marketing_provider_profiles.business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.business_id = b.id
          and um.tenant_id = b.tenant_id
      )
    )
  );

create policy "Owners update own provider profile branding"
  on public.marketing_provider_profiles
  for update
  to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and owner_user_id = auth.uid()
    and (
      business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b
          on b.id = public.marketing_provider_profiles.business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.business_id = b.id
          and um.tenant_id = b.tenant_id
      )
    )
  )
  with check (
    coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and owner_user_id = auth.uid()
    and (
      business_id is null
      or exists (
        select 1
        from public.user_memberships um
        join public.businesses b
          on b.id = public.marketing_provider_profiles.business_id
        where um.user_id = auth.uid()
          and um.status = 'ACTIVE'
          and um.business_id = b.id
          and um.tenant_id = b.tenant_id
      )
    )
  );

-- The provider UI currently updates only image path, branding settings, and timestamp.
-- Column-level grants prevent direct owner APIs from changing business/owner/status/
-- verification/ranking fields, even if an update policy were accidentally broadened.
revoke insert, update, delete
  on table public.marketing_provider_profiles
  from authenticated;

grant update (profile_image_path, settings, updated_at)
  on table public.marketing_provider_profiles
  to authenticated;

 
-- Column-level UPDATE grants still expose a whole JSONB column. Keep the owner
-- branding contract narrow: only branding.logo_path may change through the
-- authenticated owner API; every other profile settings key stays immutable.
create or replace function public.mnty_guard_provider_profile_branding_only()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_old_settings jsonb;
  v_new_settings jsonb;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_old_settings := coalesce(old.settings, '{}'::jsonb);
  v_new_settings := coalesce(new.settings, '{}'::jsonb);

  if (v_new_settings - 'branding') is distinct from (v_old_settings - 'branding') then
    raise exception 'PROVIDER_PROFILE_OWNER_SETTINGS_NOT_BRANDING'
      using errcode = '42501';
  end if;

  if v_new_settings ? 'branding'
     and pg_catalog.jsonb_typeof(v_new_settings->'branding') is distinct from 'object' then
    raise exception 'PROVIDER_PROFILE_OWNER_BRANDING_OBJECT_REQUIRED'
      using errcode = '42501';
  end if;

  if (coalesce(v_new_settings->'branding', '{}'::jsonb) - 'logo_path')
       is distinct from
     (coalesce(v_old_settings->'branding', '{}'::jsonb) - 'logo_path') then
    raise exception 'PROVIDER_PROFILE_OWNER_SETTINGS_NOT_BRANDING'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists mnty_provider_profile_branding_only on public.marketing_provider_profiles;
create trigger mnty_provider_profile_branding_only
  before update of settings on public.marketing_provider_profiles
  for each row
  execute function public.mnty_guard_provider_profile_branding_only();
