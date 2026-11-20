-- RC493 anonymous Auth sessions cannot read private CRM/project/notification rows.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous$
DECLARE v_table text; v_count integer;
DECLARE v_tables text[] := ARRAY['marketing_leads','marketing_projects','notifications'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_count;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'RC493_ANONYMOUS_PRIVATE_READ_SUCCEEDED:%:%',v_table,v_count;
    END IF;
  END LOOP;
END;
$anonymous$;

-- A missing is_anonymous claim is unknown, not proof of a confirmed user.
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
DO $missing_claim$
DECLARE v_table text; v_count integer;
DECLARE v_tables text[] := ARRAY['marketing_leads','marketing_projects','notifications'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_count;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'RC493_MISSING_ANONYMOUS_CLAIM_READ_SUCCEEDED:%:%',v_table,v_count;
    END IF;
  END LOOP;
END;
$missing_claim$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed$
DECLARE v_table text; v_count integer;
DECLARE v_tables text[] := ARRAY['marketing_leads','marketing_projects','notifications'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_count;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'RC493_CONFIRMED_OWNER_READ_REGRESSED:%:%',v_table,v_count;
    END IF;
  END LOOP;
END;
$confirmed$;
RESET ROLE;
ROLLBACK;
SELECT 'RC493 private CRM/project/notification anonymous Auth read boundary: PASS' AS result;
