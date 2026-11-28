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
  v_crm_qual_normalized text;
  v_confirmed_qual text;
  v_owner_read_qual text;
  v_owner_qual text;
  v_owner_check text;
  v_registry_owner oid;
  v_registry_rls boolean;
  v_registry_force_rls boolean;
  v_helper_owner oid;
  v_helper_secdef boolean;
  v_helper_config text[];
  v_helper_definition text;
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

  -- Platform-wide access must come only from the canonical protected registry.
  select c.relowner, c.relrowsecurity, c.relforcerowsecurity
    into v_registry_owner, v_registry_rls, v_registry_force_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'private'
    and c.relname = 'platform_admins'
    and c.relkind in ('r', 'p');

  if v_registry_owner is null
     or v_registry_rls is distinct from true
     or v_registry_force_rls is distinct from true then
    raise exception 'RC931_PLATFORM_ADMIN_REGISTRY_REQUIRED';
  end if;

  if pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'INSERT')
     or pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'UPDATE')
     or pg_catalog.has_table_privilege('anon', 'private.platform_admins', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'private.platform_admins', 'DELETE') then
    raise exception 'RC931_PLATFORM_ADMIN_REGISTRY_CLIENT_GRANT_FOUND';
  end if;

  select p.proowner, p.prosecdef, p.proconfig, pg_catalog.pg_get_functiondef(p.oid)
    into v_helper_owner, v_helper_secdef, v_helper_config, v_helper_definition
  from pg_catalog.pg_proc p
  where p.oid = pg_catalog.to_regprocedure('public.is_platform_admin()');

  if v_helper_owner is null
     or v_helper_owner is distinct from v_registry_owner
     or v_helper_secdef is distinct from true
     or not exists (
       select 1
       from pg_catalog.pg_roles r
       where r.oid = v_helper_owner
         and r.rolbypassrls
     )
     or not (coalesce(v_helper_config, array[]::text[]) @> array['search_path=""'])
     or v_helper_definition not ilike '%FROM private.platform_admins%'
     or v_helper_definition ilike '%FROM public.user_memberships%' then
    raise exception 'RC931_REGISTRY_ONLY_PLATFORM_ADMIN_HELPER_REQUIRED';
  end if;

  if not pg_catalog.has_function_privilege('authenticated', 'public.is_platform_admin()', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.is_platform_admin()', 'EXECUTE') then
    raise exception 'RC931_PLATFORM_ADMIN_HELPER_ACL_MISMATCH';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_RC479_RAW_ANON_REVOKE_REQUIRED';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_AUTHENTICATED_SELECT_REQUIRED_FOR_OWNER_AND_CRM';
  end if;
  if not pg_catalog.has_table_privilege('service_role', 'public.marketing_provider_profiles', 'SELECT') then
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

  -- PostgreSQL deparses IS NOT DISTINCT FROM as NOT (... IS DISTINCT FROM ...).
  -- Require that normalized outer negation, the anonymous claim, and explicit false remain present.
  if v_confirmed_qual is null
     or v_confirmed_qual not ilike '(NOT (%IS DISTINCT FROM%false%)'
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

  -- pg_policies.qual may schema-qualify the referenced table after a full
  -- chronological replay. Normalize whitespace/case, but keep both the exact
  -- tenant equality and the business_id -> businesses.id join mandatory.
  v_crm_qual_normalized := lower(
    regexp_replace(coalesce(v_crm_qual, ''), '[[:space:]]+', '', 'g')
  );

  if v_crm_qual is null
     or position('um.tenant_id=b.tenant_id' in v_crm_qual_normalized) = 0
     or v_crm_qual_normalized !~ 'b\.id=(public\.)?marketing_provider_profiles\.business_id' then
    raise exception
      'RC931_RC115_TENANT_AND_BUSINESS_SCOPED_CRM_POLICY_REQUIRED: tenant_match=%, business_join_match=%, policy_qual=%',
      position('um.tenant_id=b.tenant_id' in v_crm_qual_normalized) > 0,
      v_crm_qual_normalized ~ 'b\.id=(public\.)?marketing_provider_profiles\.business_id',
      coalesce(v_crm_qual, '<missing>');
  end if;

  -- RC116 intentionally split the former ALL policy into owner-only SELECT and UPDATE policies.
  -- Validate the current split contract rather than requiring the retired legacy policy name.
  select p.qual
    into v_owner_read_qual
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'marketing_provider_profiles'
    and p.policyname = 'Owners view own marketing provider profile'
    and p.permissive = 'PERMISSIVE'
    and p.cmd = 'SELECT'
    and 'authenticated' = any (p.roles);

  select p.qual, p.with_check
    into v_owner_qual, v_owner_check
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'marketing_provider_profiles'
    and p.policyname = 'Owners update own provider profile branding'
    and p.permissive = 'PERMISSIVE'
    and p.cmd = 'UPDATE'
    and 'authenticated' = any (p.roles);

  if v_owner_read_qual is null
     or v_owner_read_qual not ilike '%auth.uid()%'
     or v_owner_read_qual not ilike '%owner_user_id%'
     or v_owner_qual is null
     or v_owner_check is null
     or v_owner_qual not ilike '%auth.uid()%'
     or v_owner_qual not ilike '%owner_user_id%'
     or v_owner_check not ilike '%auth.uid()%'
     or v_owner_check not ilike '%owner_user_id%' then
    raise exception 'RC931_OWNER_PROFILE_SCOPE_POLICY_REQUIRED';
  end if;
end;
$preflight$;

drop policy if exists "Public can view active marketing providers"
  on public.marketing_provider_profiles;

-- Rebuild the CRM reader after RC115, replacing its legacy MNTY-PLATFORM
-- membership shortcut with RC484's registry-only platform-root predicate.
drop policy if exists "CRM managers view marketing providers"
  on public.marketing_provider_profiles;

create policy "CRM managers view marketing providers"
  on public.marketing_provider_profiles
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'is_anonymous') is not distinct from 'false'
    and (
      (select public.is_platform_admin())
      or (
        marketing_provider_profiles.business_id is not null
        and exists (
          select 1
          from public.user_memberships um
          join public.businesses b
            on b.id = marketing_provider_profiles.business_id
          where um.user_id = auth.uid()
            and um.status = 'ACTIVE'
            and (
              um.business_id = marketing_provider_profiles.business_id
              or (
                um.business_id is null
                and upper(coalesce(um.role, '')) in ('SUPER_ADMIN', 'ADMIN')
              )
            )
            -- MNTY-PLATFORM is a protected platform namespace. A tenant
            -- membership must never confer platform-wide CRM reads through it.
            and b.tenant_id <> 'MNTY-PLATFORM'
            and um.tenant_id = b.tenant_id
            and upper(coalesce(um.role, '')) in (
              'SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'BUSINESS_OWNER'
            )
            and (
              upper(coalesce(marketing_provider_profiles.status, '')) = 'ACTIVE'
              or upper(coalesce(um.role, '')) in (
                'SUPER_ADMIN', 'ADMIN', 'OWNER', 'BUSINESS_OWNER'
              )
            )
        )
      )
    )
  );

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
  if not pg_catalog.has_table_privilege('service_role', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_SERVICE_ROLE_DIRECTORY_READ_REGRESSED';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_AUTHENTICATED_OWNER_AND_CRM_READ_REGRESSED';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.marketing_provider_profiles', 'SELECT') then
    raise exception 'RC931_RAW_ANON_READ_REAPPEARED';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'marketing_provider_profiles'
      and p.policyname = 'CRM managers view marketing providers'
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and 'authenticated' = any (p.roles)
      -- pg_get_expr may omit the schema for a function resolved through the policy's search_path.
      and coalesce(p.qual, '') ilike '%is_platform_admin()%'
      and coalesce(p.qual, '') ilike '%b.tenant_id <> ''MNTY-PLATFORM''%'
  ) then
    raise exception 'RC931_REGISTRY_ONLY_CRM_POLICY_REQUIRED';
  end if;
end;
$postflight$;

commit;
