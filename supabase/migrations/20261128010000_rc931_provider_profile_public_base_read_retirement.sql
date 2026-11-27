-- RC931: retire the global provider-profile base-table directory read.
--
-- Public discovery is served by public-catalog and public-catalog-directory
-- through service_role with an explicit display-safe column projection.
-- Authenticated browser access remains limited to RC115 business-scoped CRM
-- readers and the existing owner-scoped profile policy. RC479/RC926 must be
-- applied first; never use this migration as a standalone hot fix.
begin;

do $preflight$
declare
  v_rls boolean;
  v_force_rls boolean;
  v_crm_qual text;
  v_confirmed_qual text;
begin
  select c.relrowsecurity, c.relforcerowsecurity
    into v_rls, v_force_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'marketing_provider_profiles'
    and c.relkind in ('r', 'p');

  if v_rls is distinct from true then
    raise exception 'RC931_PROVIDER_PROFILE_RLS_REQUIRED';
  end if;
  if v_force_rls is distinct from true then
    raise exception 'RC931_PROVIDER_PROFILE_FORCE_RLS_REQUIRED';
  end if;
  if has_table_privilege('anon', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_RC479_RAW_ANON_REVOKE_REQUIRED';
  end if;
  if not has_table_privilege('authenticated', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_AUTHENTICATED_SELECT_REQUIRED_FOR_OWNER_AND_CRM';
  end if;
  if not has_table_privilege('service_role', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_SERVICE_ROLE_SELECT_REQUIRED_FOR_CURATED_DIRECTORY';
  end if;

  select p.qual into v_confirmed_qual
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'marketing_provider_profiles'
    and p.policyname = 'marketing_provider_profiles_confirmed_auth_select'
    and p.permissive = 'RESTRICTIVE'
    and p.cmd = 'SELECT'
    and 'authenticated' = any (p.roles);

  if v_confirmed_qual is null
     or v_confirmed_qual not ilike '%IS NOT DISTINCT FROM%'
     or v_confirmed_qual not ilike '%is_anonymous%' then
    raise exception 'RC931_RC926_STRICT_CONFIRMED_AUTH_GUARD_REQUIRED';
  end if;

  select p.qual into v_crm_qual
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'marketing_provider_profiles'
    and p.policyname = 'CRM managers view marketing providers'
    and p.permissive = 'PERMISSIVE'
    and p.cmd = 'SELECT'
    and 'authenticated' = any (p.roles);

  if v_crm_qual is null
     or v_crm_qual not ilike '%um.tenant_id = b.tenant_id%'
     or v_crm_qual not ilike '%b.id = marketing_provider_profiles.business_id%' then
    raise exception 'RC931_RC115_TENANT_AND_BUSINESS_SCOPED_CRM_POLICY_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'marketing_provider_profiles'
      and p.policyname = 'Owners manage their marketing provider profile'
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'ALL'
      and 'authenticated' = any (p.roles)
  ) then
    raise exception 'RC931_OWNER_PROFILE_ACCESS_POLICY_REQUIRED';
  end if;
end;
$preflight$;

drop policy if exists "Public can view active marketing providers"
  on public.marketing_provider_profiles;

do $postflight$
begin
  if exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'marketing_provider_profiles'
      and p.policyname = 'Public can view active marketing providers'
  ) then
    raise exception 'RC931_GLOBAL_PROVIDER_PROFILE_READ_POLICY_REMAINS';
  end if;
  if not has_table_privilege('service_role', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_SERVICE_ROLE_DIRECTORY_READ_REGRESSED';
  end if;
  if not has_table_privilege('authenticated', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_AUTHENTICATED_OWNER_AND_CRM_READ_REGRESSED';
  end if;
  if has_table_privilege('anon', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_RAW_ANON_READ_REAPPEARED';
  end if;
end;
$postflight$;

commit;
