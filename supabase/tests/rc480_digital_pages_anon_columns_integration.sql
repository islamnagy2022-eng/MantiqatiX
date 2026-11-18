-- Run after the RC480 fixture and candidate migration in disposable PostgreSQL.
DO $before$
BEGIN
  IF has_table_privilege('anon','public.digital_pages','SELECT') THEN
    RAISE EXCEPTION 'RC480_ANON_TABLE_LEVEL_SELECT_STILL_GRANTED';
  END IF;
  IF NOT has_table_privilege('authenticated','public.digital_pages','SELECT')
     OR NOT has_table_privilege('authenticated','public.digital_pages','INSERT')
     OR NOT has_table_privilege('authenticated','public.digital_pages','UPDATE')
     OR NOT has_table_privilege('authenticated','public.digital_pages','DELETE') THEN
    RAISE EXCEPTION 'RC480_AUTHENTICATED_TABLE_PRIVILEGES_CHANGED';
  END IF;
  IF NOT has_table_privilege('service_role','public.digital_pages','SELECT') THEN
    RAISE EXCEPTION 'RC480_SERVICE_ROLE_SELECT_CHANGED';
  END IF;

  IF NOT (
    has_column_privilege('anon','public.digital_pages','id','SELECT')
    AND has_column_privilege('anon','public.digital_pages','page_type','SELECT')
    AND has_column_privilege('anon','public.digital_pages','slug','SELECT')
    AND has_column_privilege('anon','public.digital_pages','title','SELECT')
    AND has_column_privilege('anon','public.digital_pages','subtitle','SELECT')
    AND has_column_privilege('anon','public.digital_pages','description','SELECT')
    AND has_column_privilege('anon','public.digital_pages','seo_title','SELECT')
    AND has_column_privilege('anon','public.digital_pages','seo_description','SELECT')
    AND has_column_privilege('anon','public.digital_pages','status','SELECT')
    AND has_column_privilege('anon','public.digital_pages','version','SELECT')
  ) THEN
    RAISE EXCEPTION 'RC480_PUBLIC_RENDERER_COLUMN_GRANTS_MISSING';
  END IF;

  IF has_column_privilege('anon','public.digital_pages','theme','SELECT')
     OR has_column_privilege('anon','public.digital_pages','published_at','SELECT')
     OR has_column_privilege('anon','public.digital_pages','business_id','SELECT')
     OR has_column_privilege('anon','public.digital_pages','provider_profile_id','SELECT')
     OR has_column_privilege('anon','public.digital_pages','digital_page_order_id','SELECT')
     OR has_column_privilege('anon','public.digital_pages','created_by','SELECT')
     OR has_column_privilege('anon','public.digital_pages','updated_by','SELECT')
     OR has_column_privilege('anon','public.digital_pages','created_at','SELECT')
     OR has_column_privilege('anon','public.digital_pages','updated_at','SELECT') THEN
    RAISE EXCEPTION 'RC480_INTERNAL_PAGE_COLUMNS_STILL_SELECTABLE';
  END IF;
END;
$before$;

SET ROLE anon;
DO $anonymous$
DECLARE
  v_count integer;
  v_denied boolean;
  v_row record;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.digital_pages
  WHERE slug='published-menu' AND status='PUBLISHED';
  IF v_count<>1 THEN
    RAISE EXCEPTION 'RC480_PUBLIC_PUBLISHED_PAGE_READ_FAILED';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.digital_pages
  WHERE slug='draft-menu';
  IF v_count<>0 THEN
    RAISE EXCEPTION 'RC480_DRAFT_PAGE_BECAME_PUBLIC';
  END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'SELECT created_by FROM public.digital_pages LIMIT 1' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC480_ANON_CREATED_BY_READ_SUCCEEDED';
  END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'SELECT * FROM public.digital_pages LIMIT 1' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC480_ANON_WILDCARD_READ_SUCCEEDED';
  END IF;
END;
$anonymous$;
RESET ROLE;

SET ROLE authenticated;
DO $authenticated$
DECLARE
  v_creator uuid;
BEGIN
  SELECT created_by INTO v_creator
  FROM public.digital_pages
  WHERE slug='published-menu' AND status='PUBLISHED';
  IF v_creator IS DISTINCT FROM '40000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'RC480_AUTHENTICATED_OWNER_READ_REGRESSED';
  END IF;
END;
$authenticated$;
RESET ROLE;

SELECT 'RC480 anonymous digital-page column boundary: PASS' AS result;
