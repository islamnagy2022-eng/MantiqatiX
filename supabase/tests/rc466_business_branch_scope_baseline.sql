-- Demonstrate the pre-RC466 tenant-wide branch-read bypass using synthetic data.
SET ROLE authenticated;

DO $baseline$
DECLARE
  v_business_count integer;
  v_branch_count integer;
BEGIN
  -- A branch-scoped OWNER can see every business and branch in tenant-a before the scope fix.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO v_business_count FROM public.businesses;
  SELECT count(*) INTO v_branch_count FROM public.branches;
  IF v_business_count <> 3 OR v_branch_count <> 4 THEN
    RAISE EXCEPTION 'RC466_BASELINE_NOT_REPRODUCED: scoped OWNER expected 3 tenant-a businesses and 4 tenant-a branches; got % / %',v_business_count,v_branch_count;
  END IF;

  -- Even a tenant-level CUSTOMER could enumerate all branches in its tenant through the permissive tenant-only member-read policy.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO v_branch_count FROM public.branches;
  IF v_branch_count <> 4 THEN
    RAISE EXCEPTION 'RC466_BASELINE_NOT_REPRODUCED: unscoped CUSTOMER expected 4 tenant-a branches before fix; got %',v_branch_count;
  END IF;
END;
$baseline$;

RESET ROLE;
SELECT 'RC466 vulnerable tenant-wide branch baseline reproduced: PASS' AS result;
