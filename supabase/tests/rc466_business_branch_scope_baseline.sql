-- Demonstrate the pre-RC466 permissive branch-read bypass using synthetic data.
SET ROLE authenticated;

DO $baseline$
DECLARE
  v_business_count integer;
  v_branch_count integer;
BEGIN
  -- A branch-scoped OWNER can see all tenant businesses and every branch across tenants.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO v_business_count FROM public.businesses;
  SELECT count(*) INTO v_branch_count FROM public.branches;
  IF v_business_count <> 3 OR v_branch_count <> 5 THEN
    RAISE EXCEPTION 'RC466_BASELINE_NOT_REPRODUCED: scoped OWNER expected 3 tenant businesses and 5 cross-tenant branches; got % / %',v_business_count,v_branch_count;
  END IF;

  -- Even a tenant-level CUSTOMER could enumerate all branches because broad ALL policies are permissive.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO v_branch_count FROM public.branches;
  IF v_branch_count <> 5 THEN
    RAISE EXCEPTION 'RC466_BASELINE_NOT_REPRODUCED: unscoped CUSTOMER expected broad branch visibility before fix; got %',v_branch_count;
  END IF;
END;
$baseline$;

RESET ROLE;
SELECT 'RC466 vulnerable permissive branch baseline reproduced: PASS' AS result;
