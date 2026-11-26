-- RC927 adversarial digital-page authorization regression.
-- Runs only after the complete disposable PostgreSQL 17 forward replay.
-- Depends on the deterministic provider/Auth fixture seeded by RC926 integration.
DO $fixture$
DECLARE
  v_owner uuid := 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b';
  v_provider uuid := '10000000-0000-4000-8000-000000000001';
  v_auth_exists boolean;
  v_provider_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id=v_owner) INTO v_auth_exists;
  IF NOT v_auth_exists THEN
    RAISE EXCEPTION 'RC927_DISPOSABLE_OWNER_AUTH_USER_FIXTURE_MISSING';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles
     WHERE id=v_provider AND owner_user_id=v_owner
  ) INTO v_provider_exists;
  IF NOT v_provider_exists THEN
    RAISE EXCEPTION 'RC927_RC926_PROVIDER_FIXTURE_MISSING';
  END IF;

  -- Public page: used to prove that the raw anon renderer still works.
  INSERT INTO public.digital_pages
    (id,page_type,business_id,provider_profile_id,slug,title,subtitle,description,
     seo_title,seo_description,theme,status,version,published_at,created_by,updated_by)
  VALUES
    ('50000000-0000-4000-8000-000000000001','MENU',NULL,v_provider,
     'rc927-public-page','RC927 Public Page','Public subtitle','Public description',
     'RC927 SEO title','RC927 SEO description',
     '{"layout":"clean","primary_color":"#202020"}'::jsonb,
     'PUBLISHED',1,now(),v_owner,v_owner)
  ON CONFLICT (id) DO UPDATE
    SET provider_profile_id=EXCLUDED.provider_profile_id,
        slug=EXCLUDED.slug,title=EXCLUDED.title,subtitle=EXCLUDED.subtitle,
        description=EXCLUDED.description,seo_title=EXCLUDED.seo_title,
        seo_description=EXCLUDED.seo_description,theme=EXCLUDED.theme,
        status='PUBLISHED',published_at=now(),
        created_by=EXCLUDED.created_by,updated_by=EXCLUDED.updated_by;

  -- Draft owner page: used to prove confirmed owner edit compatibility.
  INSERT INTO public.digital_pages
    (id,page_type,business_id,provider_profile_id,slug,title,subtitle,description,
     seo_title,seo_description,theme,status,version,published_at,created_by,updated_by)
  VALUES
    ('50000000-0000-4000-8000-000000000003','PORTFOLIO',NULL,v_provider,
     'rc927-owner-draft','RC927 Owner Draft','Private subtitle','Private description',
     'Private SEO title','Private SEO description',
     '{"layout":"clean","primary_color":"#404040"}'::jsonb,
     'DRAFT',1,NULL,v_owner,v_owner)
  ON CONFLICT (id) DO UPDATE
    SET provider_profile_id=EXCLUDED.provider_profile_id,
        slug=EXCLUDED.slug,title=EXCLUDED.title,subtitle=EXCLUDED.subtitle,
        description=EXCLUDED.description,seo_title=EXCLUDED.seo_title,
        seo_description=EXCLUDED.seo_description,theme=EXCLUDED.theme,
        status='DRAFT',published_at=NULL,
        created_by=EXCLUDED.created_by,updated_by=EXCLUDED.updated_by;

  INSERT INTO public.digital_page_sections
    (id,page_id,section_type,sort_order,title,content,data,active)
  VALUES
    ('50000000-0000-4000-8000-000000000002',
     '50000000-0000-4000-8000-000000000001',
     'MENU',1,'RC927 Public Menu','Public menu content',
     '{"items":[{"name":"Test item","price":"10"}]}'::jsonb,true)
  ON CONFLICT (id) DO UPDATE
    SET page_id=EXCLUDED.page_id,section_type=EXCLUDED.section_type,
        sort_order=EXCLUDED.sort_order,title=EXCLUDED.title,
        content=EXCLUDED.content,data=EXCLUDED.data,active=true;

  INSERT INTO public.digital_page_sections
    (id,page_id,section_type,sort_order,title,content,data,active)
  VALUES
    ('50000000-0000-4000-8000-000000000004',
     '50000000-0000-4000-8000-000000000003',
     'ABOUT',1,'RC927 Owner Section','Private draft section',
     '{"owner_only":true}'::jsonb,true)
  ON CONFLICT (id) DO UPDATE
    SET page_id=EXCLUDED.page_id,section_type=EXCLUDED.section_type,
        sort_order=EXCLUDED.sort_order,title=EXCLUDED.title,
        content=EXCLUDED.content,data=EXCLUDED.data,active=true;
END;
$fixture$;

DO $acl$
BEGIN
  IF pg_catalog.has_table_privilege('anon','public.digital_pages','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','slug','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','created_by','SELECT') THEN
    RAISE EXCEPTION 'RC927_RC480_ANON_PAGE_COLUMN_BOUNDARY_REGRESSED';
  END IF;
  IF has_table_privilege('anon','public.digital_pages','INSERT')
     OR has_table_privilege('anon','public.digital_pages','UPDATE')
     OR has_table_privilege('anon','public.digital_pages','DELETE')
     OR has_table_privilege('anon','public.digital_page_sections','INSERT')
     OR has_table_privilege('anon','public.digital_page_sections','UPDATE')
     OR has_table_privilege('anon','public.digital_page_sections','DELETE') THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_WRITE_PRIVILEGE_PRESENT';
  END IF;
  IF NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','UPDATE')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_page_sections','SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.digital_page_sections','UPDATE') THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_OWNER_TABLE_PRIVILEGES_REMOVED';
  END IF;
END;
$acl$;

-- Raw anon is the public renderer identity: published display columns and active
-- sections remain readable, but internal page columns and SELECT * stay blocked.
SET ROLE anon;
DO $raw_anon$
DECLARE
  v_count integer;
  v_denied boolean := false;
  v_owner uuid;
  v_row record;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.digital_pages
   WHERE slug='rc927-public-page' AND status='PUBLISHED';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_PUBLISHED_PAGE_READ_FAILED:%',v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.digital_page_sections s
    JOIN public.digital_pages p ON p.id=s.page_id
   WHERE p.slug='rc927-public-page' AND s.active=true;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_PUBLIC_SECTION_READ_FAILED:%',v_count;
  END IF;

  BEGIN
    EXECUTE 'SELECT created_by FROM public.digital_pages WHERE slug=''rc927-public-page''' INTO v_owner;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_INTERNAL_OWNER_COLUMN_READ_SUCCEEDED';
  END IF;

  v_denied := false;
  BEGIN
    EXECUTE 'SELECT * FROM public.digital_pages WHERE slug=''rc927-public-page''' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_WILDCARD_PAGE_READ_SUCCEEDED';
  END IF;
END;
$raw_anon$;
RESET ROLE;

-- Anonymous Auth carries the authenticated SQL role; it must not inherit the
-- broad published-page policy or execute owner-management writes.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"f7914ac7-4b03-4456-afdd-e386f2ac6a5b","role":"authenticated","is_anonymous":true}',false);
DO $anonymous_auth$
DECLARE
  v_count integer;
  v_affected integer;
  v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.digital_pages WHERE slug='rc927-public-page';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_PAGE_READ_SUCCEEDED:%',v_count;
  END IF;
  SELECT count(*) INTO v_count
    FROM public.digital_page_sections s
    JOIN public.digital_pages p ON p.id=s.page_id
   WHERE p.slug='rc927-public-page';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_SECTION_READ_SUCCEEDED:%',v_count;
  END IF;

  UPDATE public.digital_pages
     SET title='anonymous overwrite',updated_by='f7914ac7-4b03-4456-afdd-e386f2ac6a5b'
   WHERE slug='rc927-owner-draft';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_PAGE_UPDATE_SUCCEEDED:%',v_affected;
  END IF;

  UPDATE public.digital_page_sections SET title='anonymous section overwrite'
   WHERE id='50000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_SECTION_UPDATE_SUCCEEDED:%',v_affected;
  END IF;

  DELETE FROM public.digital_page_sections
   WHERE id='50000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_SECTION_DELETE_SUCCEEDED:%',v_affected;
  END IF;

  BEGIN
    INSERT INTO public.digital_page_sections
      (id,page_id,section_type,sort_order,title,content,data,active)
    VALUES
      ('50000000-0000-4000-8000-000000000099',
       '50000000-0000-4000-8000-000000000003',
       'ABOUT',99,'Unauthorized','Unauthorized','{}'::jsonb,true);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_SECTION_INSERT_SUCCEEDED';
  END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.digital_pages
      (id,page_type,provider_profile_id,slug,title,theme,status,version,created_by,updated_by)
    VALUES
      ('50000000-0000-4000-8000-000000000005','MENU',
       '10000000-0000-4000-8000-000000000001',
       'rc927-anon-auth-insert','Unauthorized page','{}'::jsonb,'DRAFT',1,
       'f7914ac7-4b03-4456-afdd-e386f2ac6a5b',
       'f7914ac7-4b03-4456-afdd-e386f2ac6a5b');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_PAGE_INSERT_SUCCEEDED';
  END IF;
END;
$anonymous_auth$;
RESET ROLE;

-- Missing/null is_anonymous is not interpreted as a confirmed identity.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"f7914ac7-4b03-4456-afdd-e386f2ac6a5b","role":"authenticated"}',false);
DO $missing_claim$
DECLARE
  v_count integer;
  v_affected integer;
  v_denied boolean := false;
BEGIN
  SELECT count(*) INTO v_count FROM public.digital_pages WHERE slug='rc927-public-page';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_PAGE_READ_SUCCEEDED:%',v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.digital_page_sections s
    JOIN public.digital_pages p ON p.id=s.page_id
   WHERE p.slug='rc927-public-page';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_SECTION_READ_SUCCEEDED:%',v_count;
  END IF;

  UPDATE public.digital_pages
     SET title='missing claim overwrite',updated_by='f7914ac7-4b03-4456-afdd-e386f2ac6a5b'
   WHERE slug='rc927-owner-draft';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_PAGE_UPDATE_SUCCEEDED:%',v_affected;
  END IF;

  UPDATE public.digital_page_sections SET title='missing-claim section overwrite'
   WHERE id='50000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_SECTION_UPDATE_SUCCEEDED:%',v_affected;
  END IF;

  DELETE FROM public.digital_page_sections
   WHERE id='50000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_SECTION_DELETE_SUCCEEDED:%',v_affected;
  END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.digital_page_sections
      (id,page_id,section_type,sort_order,title,content,data,active)
    VALUES
      ('50000000-0000-4000-8000-000000000098',
       '50000000-0000-4000-8000-000000000003',
       'ABOUT',98,'Missing claim','Missing claim','{}'::jsonb,true);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_SECTION_INSERT_SUCCEEDED';
  END IF;

  BEGIN
    INSERT INTO public.digital_pages
      (id,page_type,provider_profile_id,slug,title,theme,status,version,created_by,updated_by)
    VALUES
      ('50000000-0000-4000-8000-000000000006','MENU',
       '10000000-0000-4000-8000-000000000001',
       'rc927-missing-claim-insert','Unauthorized page','{}'::jsonb,'DRAFT',1,
       'f7914ac7-4b03-4456-afdd-e386f2ac6a5b',
       'f7914ac7-4b03-4456-afdd-e386f2ac6a5b');
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_PAGE_INSERT_SUCCEEDED';
  END IF;
END;
$missing_claim$;
RESET ROLE;

-- A confirmed owner retains full internal read and draft editing behavior.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"f7914ac7-4b03-4456-afdd-e386f2ac6a5b","role":"authenticated","is_anonymous":false}',false);
DO $confirmed_owner$
DECLARE
  v_creator uuid;
  v_affected integer;
BEGIN
  SELECT created_by INTO v_creator
    FROM public.digital_pages WHERE slug='rc927-owner-draft';
  IF v_creator IS DISTINCT FROM 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b'::uuid THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_OWNER_PRIVATE_PAGE_READ_REGRESSED';
  END IF;

  UPDATE public.digital_pages
     SET title='RC927 owner updated page',updated_by='f7914ac7-4b03-4456-afdd-e386f2ac6a5b'
   WHERE slug='rc927-owner-draft';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_OWNER_PAGE_UPDATE_REGRESSED:%',v_affected;
  END IF;

  UPDATE public.digital_page_sections SET title='RC927 owner updated section'
   WHERE id='50000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_OWNER_SECTION_UPDATE_REGRESSED:%',v_affected;
  END IF;

  INSERT INTO public.digital_pages
    (id,page_type,business_id,provider_profile_id,slug,title,theme,status,version,created_by,updated_by)
  VALUES
    ('50000000-0000-4000-8000-000000000005','PORTFOLIO',NULL,
     '10000000-0000-4000-8000-000000000001',
     'rc927-owner-insert','RC927 Owner Insert',
     '{"layout":"clean"}'::jsonb,'DRAFT',1,
     'f7914ac7-4b03-4456-afdd-e386f2ac6a5b',
     'f7914ac7-4b03-4456-afdd-e386f2ac6a5b');
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_OWNER_PAGE_INSERT_REGRESSED:%',v_affected;
  END IF;
END;
$confirmed_owner$;
RESET ROLE;

-- A different confirmed user cannot use public read or another provider's owner policy.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false}',false);
DO $confirmed_non_owner$
DECLARE
  v_count integer;
  v_affected integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.digital_pages WHERE slug='rc927-public-page';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_NON_OWNER_PUBLIC_PAGE_READ_SUCCEEDED:%',v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.digital_pages WHERE slug='rc927-owner-draft';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_NON_OWNER_PRIVATE_PAGE_READ_SUCCEEDED:%',v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.digital_page_sections
   WHERE id='50000000-0000-4000-8000-000000000004';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_NON_OWNER_PRIVATE_SECTION_READ_SUCCEEDED:%',v_count;
  END IF;

  UPDATE public.digital_page_sections SET title='confirmed non-owner section overwrite'
   WHERE id='50000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_NON_OWNER_SECTION_UPDATE_SUCCEEDED:%',v_affected;
  END IF;

  UPDATE public.digital_pages
     SET title='non-owner overwrite',updated_by='20000000-0000-4000-8000-000000000099'
   WHERE slug='rc927-owner-draft';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_NON_OWNER_PAGE_UPDATE_SUCCEEDED:%',v_affected;
  END IF;
END;
$confirmed_non_owner$;
RESET ROLE;

DO $policies$
DECLARE
  v_page_public_roles name[];
  v_section_public_roles name[];
  v_page_guard integer;
  v_section_guard integer;
BEGIN
  SELECT roles INTO v_page_public_roles FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename='digital_pages' AND policyname='digital_pages_public_read';
  SELECT roles INTO v_section_public_roles FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename='digital_page_sections' AND policyname='digital_page_sections_public_read';
  SELECT count(*) INTO v_page_guard FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename='digital_pages'
     AND policyname='digital_pages_confirmed_auth_identity'
     AND permissive='RESTRICTIVE' AND cmd='ALL' AND roles=ARRAY['authenticated']::name[];
  SELECT count(*) INTO v_section_guard FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename='digital_page_sections'
     AND policyname='digital_page_sections_confirmed_auth_identity'
     AND permissive='RESTRICTIVE' AND cmd='ALL' AND roles=ARRAY['authenticated']::name[];

  IF v_page_public_roles IS DISTINCT FROM ARRAY['anon']::name[]
     OR v_section_public_roles IS DISTINCT FROM ARRAY['anon']::name[] THEN
    RAISE EXCEPTION 'RC927_PUBLIC_RENDERER_POLICY_MUST_TARGET_RAW_ANON_ONLY';
  END IF;
  IF v_page_guard <> 1 OR v_section_guard <> 1 THEN
    RAISE EXCEPTION 'RC927_RESTRICTIVE_CONFIRMED_AUTH_POLICIES_MISSING';
  END IF;
END;
$policies$;

SELECT 'RC927 raw anon page rendering, anonymous/missing Auth denial and confirmed-owner compatibility: PASS' AS result;