-- Demonstrate the pre-RC465 tenant-only read boundary on synthetic data.
SET ROLE authenticated;

DO $baseline$
DECLARE
  v_visible_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);

  SELECT count(*) INTO v_visible_count FROM public.orders;
  IF v_visible_count <> 6 THEN
    RAISE EXCEPTION 'RC465_BASELINE_NOT_REPRODUCED: expected scoped OWNER to see all 6 tenant-a rows before fix, saw %',v_visible_count;
  END IF;
END;
$baseline$;

RESET ROLE;
SELECT 'RC465 vulnerable tenant-wide baseline reproduced: PASS' AS result;
