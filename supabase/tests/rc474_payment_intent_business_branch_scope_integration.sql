-- RC474 business/branch scope regression. Disposable PostgreSQL only.
DO $test$
DECLARE
  customer uuid := '10000000-0000-4000-8000-000000004741';
  mixed_scope_actor uuid := '10000000-0000-4000-8000-000000004742';
  cross_branch_actor uuid := '10000000-0000-4000-8000-000000004743';
  non_finance_actor uuid := '10000000-0000-4000-8000-000000004744';
  branch_finance uuid := '10000000-0000-4000-8000-000000004745';
  business_finance uuid := '10000000-0000-4000-8000-000000004746';
  tenant_finance uuid := '10000000-0000-4000-8000-000000004747';
  no_scope_actor uuid := '10000000-0000-4000-8000-000000004748';
  order_customer uuid := '20000000-0000-4000-8000-000000004741';
  order_mixed uuid := '20000000-0000-4000-8000-000000004742';
  order_branch uuid := '20000000-0000-4000-8000-000000004743';
  order_null_customer uuid := '20000000-0000-4000-8000-000000004744';
  order_branch_finance uuid := '20000000-0000-4000-8000-000000004745';
  order_business_finance uuid := '20000000-0000-4000-8000-000000004746';
  order_tenant_finance uuid := '20000000-0000-4000-8000-000000004747';
  order_no_scope uuid := '20000000-0000-4000-8000-000000004748';
  business_a uuid := '30000000-0000-4000-8000-000000004741';
  business_b uuid := '30000000-0000-4000-8000-000000004742';
  branch_a varchar := 'BRANCH-A';
  branch_b varchar := 'BRANCH-B';
  rejected boolean;
  result jsonb;
  intent_id text;
BEGIN
  INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status,permissions) VALUES
    ('mixed-ops-a',mixed_scope_actor,'TENANT-A',business_a,branch_a,'OPERATIONS_MANAGER','ACTIVE','{}'::jsonb),
    ('mixed-finance-b',mixed_scope_actor,'TENANT-A',business_b,branch_b,'FINANCE','ACTIVE','{}'::jsonb),
    ('cross-ops-a',cross_branch_actor,'TENANT-A',business_a,branch_a,'OPERATIONS_MANAGER','ACTIVE','{}'::jsonb),
    ('cross-finance-b',cross_branch_actor,'TENANT-A',business_a,branch_b,'FINANCE','ACTIVE','{}'::jsonb),
    ('non-finance-ops',non_finance_actor,'TENANT-A',business_a,branch_a,'OPERATIONS_MANAGER','ACTIVE','{}'::jsonb),
    ('branch-finance',branch_finance,'TENANT-A',business_a,branch_a,'FINANCE','ACTIVE','{}'::jsonb),
    ('business-finance',business_finance,'TENANT-A',business_a,NULL,'ACCOUNTANT','ACTIVE','{}'::jsonb),
    ('tenant-finance',tenant_finance,'TENANT-A',NULL,NULL,'FINANCE_MANAGER','ACTIVE','{}'::jsonb);

  INSERT INTO public.orders(
    id,tenant_id,business_id,branch_id,customer_id,status,total_amount,total,currency,
    pricing_version,pricing_hash,pricing_authority
  ) VALUES
    (order_customer,'TENANT-X',business_a,branch_a,customer,'PENDING',100,100,'EGP',1,'hash-customer','SERVER'),
    (order_mixed,'TENANT-A',business_a,branch_a,customer,'PENDING',100,100,'EGP',1,'hash-mixed','SERVER'),
    (order_branch,'TENANT-A',business_a,branch_a,customer,'PENDING',100,100,'EGP',1,'hash-branch','SERVER'),
    (order_null_customer,'TENANT-A',business_a,branch_a,NULL,'PENDING',100,100,'EGP',1,'hash-null','SERVER'),
    (order_branch_finance,'TENANT-A',business_a,branch_a,customer,'PENDING',100,100,'EGP',1,'hash-branch-finance','SERVER'),
    (order_business_finance,'TENANT-A',business_a,branch_b,customer,'PENDING',100,100,'EGP',1,'hash-business-finance','SERVER'),
    (order_tenant_finance,'TENANT-A',business_b,branch_b,customer,'PENDING',100,100,'EGP',1,'hash-tenant-finance','SERVER'),
    (order_no_scope,'TENANT-A',business_a,branch_a,customer,'PENDING',100,100,'EGP',1,'hash-no-scope','SERVER');

  -- A customer can still pay their own order without provider-tenant membership.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',customer::text,true);
  result:=public.create_payment_intent_backend('TENANT-X',order_customer,100,'EGP','PAYMOB','CARD','rc474-customer-0001');
  IF result->>'status'<>'CREATED' OR coalesce((result->>'idempotent')::boolean,true) THEN
    RAISE EXCEPTION 'customer-owned cross-tenant payment intent was not created';
  END IF;
  intent_id:=result->>'id';
  result:=public.create_payment_intent_backend('TENANT-X',order_customer,100,'EGP','PAYMOB','CARD','rc474-customer-0001');
  IF result->>'id'<>intent_id OR coalesce((result->>'idempotent')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'customer-owned payment intent replay was not idempotent';
  END IF;

  -- An unrelated finance role in business B cannot combine with an operations
  -- membership in business A to authorize an order in business A.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',mixed_scope_actor::text,true);
  rejected:=false;
  BEGIN
    PERFORM public.create_payment_intent_backend('TENANT-A',order_mixed,100,'EGP','PAYMOB','CARD','rc474-mixed-0001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='ORDER_ACCESS_DENIED' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross-business finance role authorized payment intent'; END IF;

  -- A finance role for a different branch cannot be combined with an operations
  -- membership in the order branch.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',cross_branch_actor::text,true);
  rejected:=false;
  BEGIN
    PERFORM public.create_payment_intent_backend('TENANT-A',order_branch,100,'EGP','PAYMOB','CARD','rc474-branch-mismatch-0001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='ORDER_ACCESS_DENIED' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross-branch finance role authorized payment intent'; END IF;

  -- A non-finance role cannot pay an order whose customer_id is NULL.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',non_finance_actor::text,true);
  rejected:=false;
  BEGIN
    PERFORM public.create_payment_intent_backend('TENANT-A',order_null_customer,100,'EGP','PAYMOB','CARD','rc474-null-customer-0001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='ORDER_ACCESS_DENIED' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'non-finance actor authorized an order with NULL customer_id'; END IF;

  -- A finance actor scoped to the exact branch is allowed.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',branch_finance::text,true);
  result:=public.create_payment_intent_backend('TENANT-A',order_branch_finance,100,'EGP','PAYMOB','CARD','rc474-branch-finance-0001');
  IF result->>'status'<>'CREATED' THEN RAISE EXCEPTION 'same-branch finance actor was denied'; END IF;

  -- Business-wide finance is allowed for any branch of its own business.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',business_finance::text,true);
  result:=public.create_payment_intent_backend('TENANT-A',order_business_finance,100,'EGP','PAYMOB','CARD','rc474-business-finance-0001');
  IF result->>'status'<>'CREATED' THEN RAISE EXCEPTION 'business-wide finance actor was denied'; END IF;

  -- Tenant-wide finance scope remains available only when both scope columns are NULL.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',tenant_finance::text,true);
  result:=public.create_payment_intent_backend('TENANT-A',order_tenant_finance,100,'EGP','PAYMOB','CARD','rc474-tenant-finance-0001');
  IF result->>'status'<>'CREATED' THEN RAISE EXCEPTION 'tenant-wide finance actor was denied'; END IF;

  -- No target-scope membership must fail before creating an intent.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',no_scope_actor::text,true);
  rejected:=false;
  BEGIN
    PERFORM public.create_payment_intent_backend('TENANT-A',order_no_scope,100,'EGP','PAYMOB','CARD','rc474-no-scope-0001');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='TENANT_ACCESS_DENIED' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'actor without target business/branch membership was not rejected'; END IF;

  IF NOT pg_catalog.has_function_privilege('authenticated',
    'public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('service_role',
    'public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
    'public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE')
    OR pg_catalog.has_function_privilege('public',
    'public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE') THEN
    RAISE EXCEPTION 'RC474 payment intent RPC ACL contract failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=pg_catalog.to_regprocedure(
      'public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)'
    )
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""']::text[]
  ) THEN
    RAISE EXCEPTION 'RC474 payment intent SECURITY DEFINER search_path contract failed';
  END IF;
END
$test$;

SELECT 'RC474 payment intent business/branch authorization regression: PASS' AS result;
