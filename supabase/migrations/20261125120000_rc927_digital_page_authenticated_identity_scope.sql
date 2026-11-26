-- RC927: keep public digital-page rendering on raw anon only, and fail closed for Anonymous Auth sessions.
-- RC480 limits raw-anon columns; RC927 closes the authenticated-role bypass of that column allowlist.
-- Confirmed owners retain the existing owner policies. No business data is modified.
BEGIN;

DO $rc927_preflight$
DECLARE
  v_pages_rls boolean;
  v_sections_rls boolean;
  v_public_page_policy boolean;
  v_owner_page_select boolean;
  v_owner_page_insert boolean;
  v_owner_page_update boolean;
  v_admin_page_policy boolean;
  v_public_section_policy boolean;
  v_owner_section_policy boolean;
BEGIN
  SELECT c.relrowsecurity
    INTO v_pages_rls
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND c.relname='digital_pages'
     AND c.relkind IN ('r','p');

  SELECT c.relrowsecurity
    INTO v_sections_rls
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND c.relname='digital_page_sections'
     AND c.relkind IN ('r','p');

  IF v_pages_rls IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RC927_DIGITAL_PAGES_RLS_REQUIRED';
  END IF;
  IF v_sections_rls IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RC927_DIGITAL_PAGE_SECTIONS_RLS_REQUIRED';
  END IF;

  -- RC480 must already have restricted raw anon to the public renderer projection.
  IF NOT pg_catalog.has_column_privilege('anon','public.digital_pages','id','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','page_type','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','slug','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','title','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','subtitle','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','description','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','seo_title','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','seo_description','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','status','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','version','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','business_id','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','provider_profile_id','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','theme','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','published_at','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','created_by','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','updated_by','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','created_at','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','updated_at','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','digital_page_order_id','SELECT')
     OR pg_catalog.has_table_privilege('anon','public.digital_pages','SELECT') THEN
    RAISE EXCEPTION 'RC927_RC480_EXACT_TEN_COLUMN_ANON_ALLOWLIST_REQUIRED';
  END IF;

  -- Raw anon may read the intended public projections only; no direct write grants.
  IF pg_catalog.has_table_privilege('anon','public.digital_pages','INSERT')
     OR pg_catalog.has_table_privilege('anon','public.digital_pages','UPDATE')
     OR pg_catalog.has_table_privilege('anon','public.digital_pages','DELETE')
     OR pg_catalog.has_table_privilege('anon','public.digital_page_sections','INSERT')
     OR pg_catalog.has_table_privilege('anon','public.digital_page_sections','UPDATE')
     OR pg_catalog.has_table_privilege('anon','public.digital_page_sections','DELETE') THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_WRITE_PRIVILEGE_PRESENT';
  END IF;

  -- Preserve the existing authenticated owner privileges. RC927 does not
  -- add service_role table grants; any backend caller must use its existing
  -- RPC/ACL contract rather than expanding table privileges here.
  IF NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','INSERT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','UPDATE')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','DELETE') THEN
    RAISE EXCEPTION 'RC927_DIGITAL_PAGES_OWNER_PRIVILEGES_REQUIRED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('anon','public.digital_page_sections','SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_page_sections','SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_page_sections','INSERT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_page_sections','UPDATE')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_page_sections','DELETE') THEN
    RAISE EXCEPTION 'RC927_DIGITAL_PAGE_SECTIONS_OWNER_PRIVILEGES_REQUIRED';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_pages'
       AND policyname='digital_pages_public_read' AND permissive='PERMISSIVE'
       AND cmd='SELECT' AND 'anon'=ANY(roles) AND 'authenticated'=ANY(roles)
  ) INTO v_public_page_policy;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_pages'
       AND policyname='digital_pages_owner_select' AND permissive='PERMISSIVE'
       AND cmd='SELECT' AND 'authenticated'=ANY(roles)
  ) INTO v_owner_page_select;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_pages'
       AND policyname='digital_pages_owner_insert' AND permissive='PERMISSIVE'
       AND cmd='INSERT' AND 'authenticated'=ANY(roles)
  ) INTO v_owner_page_insert;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_pages'
       AND policyname='digital_pages_owner_update_draft' AND permissive='PERMISSIVE'
       AND cmd='UPDATE' AND 'authenticated'=ANY(roles)
  ) INTO v_owner_page_update;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_pages'
       AND policyname='digital_pages_admin_manage' AND permissive='PERMISSIVE'
       AND cmd='ALL' AND 'authenticated'=ANY(roles)
  ) INTO v_admin_page_policy;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_page_sections'
       AND policyname='digital_page_sections_public_read' AND permissive='PERMISSIVE'
       AND cmd='SELECT' AND 'anon'=ANY(roles) AND 'authenticated'=ANY(roles)
  ) INTO v_public_section_policy;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public' AND tablename='digital_page_sections'
       AND policyname='digital_page_sections_owner_manage' AND permissive='PERMISSIVE'
       AND cmd='ALL' AND 'authenticated'=ANY(roles)
  ) INTO v_owner_section_policy;

  IF NOT v_public_page_policy OR NOT v_owner_page_select OR NOT v_owner_page_insert
     OR NOT v_owner_page_update OR NOT v_admin_page_policy
     OR NOT v_public_section_policy OR NOT v_owner_section_policy THEN
    RAISE EXCEPTION 'RC927_EXPECTED_PUBLIC_OWNER_AND_ADMIN_POLICIES_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname='public'
       AND tablename IN ('digital_pages','digital_page_sections')
       AND policyname IN ('digital_pages_confirmed_auth_identity','digital_page_sections_confirmed_auth_identity')
  ) THEN
    RAISE EXCEPTION 'RC927_POLICY_ALREADY_EXISTS';
  END IF;
END;
$rc927_preflight$;

-- The public renderer uses a stateless anon-key client. Remove authenticated
-- from these broad published-row policies so it cannot read all internal columns.
ALTER POLICY digital_pages_public_read
  ON public.digital_pages
  TO anon;

ALTER POLICY digital_page_sections_public_read
  ON public.digital_page_sections
  TO anon;

-- Anonymous Auth sessions also use the Postgres "authenticated" role.
-- Require an explicit false claim for every authenticated read and write.
CREATE POLICY digital_pages_confirmed_auth_identity
ON public.digital_pages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  (SELECT auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
)
WITH CHECK (
  (SELECT auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
);

CREATE POLICY digital_page_sections_confirmed_auth_identity
ON public.digital_page_sections
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  (SELECT auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
)
WITH CHECK (
  (SELECT auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
);

COMMENT ON POLICY digital_pages_confirmed_auth_identity
  ON public.digital_pages IS
  'RC927: authenticated access requires an explicit confirmed Auth identity; raw anon public rendering remains allowlisted by RC480.';

COMMENT ON POLICY digital_page_sections_confirmed_auth_identity
  ON public.digital_page_sections IS
  'RC927: authenticated access requires an explicit confirmed Auth identity; raw anon published-section rendering remains public.';

COMMIT;