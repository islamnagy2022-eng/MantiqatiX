-- RC465 behavioral integration tests. Run only in disposable PostgreSQL.
SET ROLE authenticated;

DO $test$
DECLARE
  v_ids uuid[];
  v_expected uuid[];
BEGIN
  -- Fully unscoped OWNER retains tenant-wide order visibility.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  v_expected := ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000006'
  ]::uuid[];
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: unscoped OWNER expected tenant-a orders only; got %',v_ids;
  END IF;

  -- Business/branch-scoped OWNER sees only its exact branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  v_expected := ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000004'
  ]::uuid[];
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: scoped OWNER crossed business/branch boundary; got %',v_ids;
  END IF;

  -- BUSINESS_OWNER was omitted by RC109; it now receives only its exact scope.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: BUSINESS_OWNER exact-scope visibility incorrect; got %',v_ids;
  END IF;

  -- Branch-scoped MANAGER sees no sibling-branch or other-business orders.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: branch-scoped MANAGER visibility incorrect; got %',v_ids;
  END IF;

  -- Business-scoped (branch NULL) membership matches only branchless orders under RC103's exact-branch contract.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  v_expected := ARRAY['30000000-0000-4000-8000-000000000006']::uuid[];
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: unbranched business membership crossed branch scope; got %',v_ids;
  END IF;

  -- Scoped OWNER for another business sees only that business/branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000009',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  v_expected := ARRAY['30000000-0000-4000-8000-000000000003']::uuid[];
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: business-scoped OWNER crossed business boundary; got %',v_ids;
  END IF;

  -- Service provider branch access is restricted to the assigned branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  v_expected := ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000004'
  ]::uuid[];
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: branch-scoped provider crossed branch boundary; got %',v_ids;
  END IF;

  -- Inactive membership grants no operational order visibility.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: inactive membership received order visibility: %',v_ids;
  END IF;

  -- Customer-owned reads remain cross-tenant and limited to the caller's own orders.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  v_expected := ARRAY[
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000007'
  ]::uuid[];
  IF v_ids IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'TEST_FAILED: customer own-order cross-tenant contract changed; got %',v_ids;
  END IF;

  -- Anonymous sessions cannot use customer or member read policies.
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":true}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.orders;
  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: anonymous session received order visibility: %',v_ids;
  END IF;

  IF pg_catalog.has_table_privilege(current_user,'public.orders','INSERT')
     OR pg_catalog.has_table_privilege(current_user,'public.orders','UPDATE')
     OR pg_catalog.has_table_privilege(current_user,'public.orders','DELETE') THEN
    RAISE EXCEPTION 'TEST_FAILED: RC465 unexpectedly granted client order writes';
  END IF;
END;
$test$;

RESET ROLE;
SELECT 'RC465 orders read business/branch scope: PASS' AS result;
