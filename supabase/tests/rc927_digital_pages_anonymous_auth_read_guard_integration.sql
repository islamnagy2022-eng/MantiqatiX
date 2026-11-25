-- RC927 disposable regression: deny direct SELECT to Anonymous Auth claims
-- and missing identity claims without breaking raw anon published-page reads.
SET ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous_auth$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.digital_pages
  WHERE slug='published-menu' AND status='PUBLISHED';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_PUBLISHED_PAGE_READ_SUCCEEDED:%',v_count;
  END IF;

  SELECT count(created_by) INTO v_count
  FROM public.digital_pages
  WHERE slug='published-menu';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_ANON_AUTH_INTERNAL_COLUMN_READ_SUCCEEDED:%',v_count;
  END IF;
END;
$anonymous_auth$;

-- A missing/NULL is_anonymous claim must fail closed as well.
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',
  true
);
DO $missing_claim$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.digital_pages
  WHERE slug='published-menu' AND status='PUBLISHED';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC927_MISSING_CLAIM_PUBLISHED_PAGE_READ_SUCCEEDED:%',v_count;
  END IF;
END;
$missing_claim$;

-- Explicitly confirmed users retain access to the existing published-page
-- row contract, including owner/internal columns needed by authenticated UI.
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed_auth$
DECLARE
  v_count integer;
  v_creator uuid;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.digital_pages
  WHERE slug='published-menu' AND status='PUBLISHED';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_AUTH_PUBLISHED_PAGE_READ_REGRESSED:%',v_count;
  END IF;

  SELECT created_by INTO v_creator
  FROM public.digital_pages
  WHERE slug='published-menu';
  IF v_creator IS DISTINCT FROM '40000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'RC927_CONFIRMED_AUTH_INTERNAL_COLUMN_READ_REGRESSED';
  END IF;
END;
$confirmed_auth$;
RESET ROLE;

-- Raw anon remains the public storefront role and still receives only
-- RC480's explicit public-renderer column allowlist.
SET ROLE anon;
DO $raw_anon$
DECLARE
  v_count integer;
  v_denied boolean:=false;
  v_internal uuid;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.digital_pages
  WHERE slug='published-menu' AND status='PUBLISHED';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_PUBLIC_PAGE_READ_REGRESSED:%',v_count;
  END IF;

  BEGIN
    SELECT created_by INTO v_internal
    FROM public.digital_pages
    WHERE slug='published-menu';
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'RC927_RAW_ANON_INTERNAL_COLUMN_BECAME_READABLE';
  END IF;
END;
$raw_anon$;
RESET ROLE;

SELECT 'RC927 digital-pages Anonymous Auth read guard: PASS' AS result;
