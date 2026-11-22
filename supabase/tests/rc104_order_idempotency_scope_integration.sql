-- RC104 behavioral integration tests. Run only in disposable PostgreSQL.
do $test$
declare
  customer_one uuid := '10000000-0000-4000-8000-000000000001';
  customer_two uuid := '10000000-0000-4000-8000-000000000002';
  result jsonb;
  rejected boolean;
begin
  -- Exact same customer/business/branch replay returns the original order.
  perform set_config('request.jwt.claim.sub', customer_one::text, false);
  result := public.create_order_backend(
    '30000000-0000-4000-8000-000000000099',
    'tenant-a',
    '20000000-0000-4000-8000-000000000001',
    'branch-a',
    customer_one,
    'same-key-rc104',
    0,0,0,0,0,'EGP','Customer One','01000000000','Test address',
    '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
    null,'{}'::jsonb
  );
  if result->>'id' <> '30000000-0000-4000-8000-000000000001' or result->>'idempotent' <> 'true' then
    raise exception 'TEST_FAILED: same-scope idempotent replay did not return original order';
  end if;

  -- The verified Edge Function invokes the backend-only RPC with service_role after auth.getUser(token).
  -- It has no end-user auth.uid() claim, but it passes the verified customer ID.
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
  result := public.create_order_backend(
    '30000000-0000-4000-8000-000000000095',
    'tenant-a',
    '20000000-0000-4000-8000-000000000001',
    'branch-a',
    customer_one,
    'same-key-rc104',
    0,0,0,0,0,'EGP','Customer One','01000000000','Test address',
    '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
    null,'{}'::jsonb
  );
  if result->>'id' <> '30000000-0000-4000-8000-000000000001' or result->>'idempotent' <> 'true' then
    raise exception 'TEST_FAILED: verified service-role Edge Function path could not invoke order RPC';
  end if;


  -- A verified service-role Edge invocation must be able to create a NEW order,
  -- not only replay an existing order. The actor is supplied after Edge auth.getUser().
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
  result := public.create_order_backend(
    '30000000-0000-4000-8000-000000000095',
    'tenant-a',
    '20000000-0000-4000-8000-000000000001',
    'branch-a',
    customer_one,
    'new-service-role-order-key',
    0,0,0,0,0,'EGP','Customer One','01000000000','New service-role order',
    '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
    null,'{}'::jsonb
  );
  if result->>'id' <> '30000000-0000-4000-8000-000000000095' or result->>'idempotent' <> 'false' then
    raise exception 'TEST_FAILED: verified service-role path could not create a new order';
  end if;
  if not exists (
    select 1 from public.orders
    where id='30000000-0000-4000-8000-000000000095'
      and customer_id=customer_one
      and client_idempotency_key='new-service-role-order-key'
      and total_amount=125
  ) then
    raise exception 'TEST_FAILED: service-role order did not persist with verified actor and server pricing';
  end if;

  -- A normal authenticated caller cannot impersonate another customer by changing p_customer_id.
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', customer_one::text, false);
  rejected := false;
  begin
    perform public.create_order_backend(
      '30000000-0000-4000-8000-000000000094',
      'tenant-a',
      '20000000-0000-4000-8000-000000000001',
      'branch-a',
      customer_two,
      'actor-spoof-key-rc105',
      0,0,0,0,0,'EGP','Customer Two','01000000001','Spoof attempt',
      '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
      null,'{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'CUSTOMER_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: authenticated caller impersonated another customer'; end if;

  -- A different authenticated customer must not receive the stored order or pricing snapshot.
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', customer_two::text, false);
  rejected := false;
  begin
    perform public.create_order_backend(
      '30000000-0000-4000-8000-000000000098',
      'tenant-a',
      '20000000-0000-4000-8000-000000000001',
      'branch-a',
      customer_two,
      'same-key-rc104',
      0,0,0,0,0,'EGP','Customer Two','01000000001','Other address',
      '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
      null,'{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_CONFLICT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: different customer replayed another customer order'; end if;

  -- The same customer cannot reuse a key to replay an order for another branch.
  perform set_config('request.jwt.claim.sub', customer_one::text, false);
  rejected := false;
  begin
    perform public.create_order_backend(
      '30000000-0000-4000-8000-000000000097',
      'tenant-a',
      '20000000-0000-4000-8000-000000000001',
      'branch-b',
      customer_one,
      'same-key-rc104',
      0,0,0,0,0,'EGP','Customer One','01000000000','Other branch address',
      '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
      null,'{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_CONFLICT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: idempotency key replay crossed branch scope'; end if;

  -- The same customer cannot replay the key against another business either.
  rejected := false;
  begin
    perform public.create_order_backend(
      '30000000-0000-4000-8000-000000000096',
      'tenant-a',
      '20000000-0000-4000-8000-000000000002',
      null,
      customer_one,
      'same-key-rc104',
      0,0,0,0,0,'EGP','Customer One','01000000000','Other business address',
      '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
      null,'{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_CONFLICT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: idempotency key replay crossed business scope'; end if;

  if (select count(*) from public.orders where tenant_id='tenant-a' and client_idempotency_key='same-key-rc104') <> 1 then
    raise exception 'TEST_FAILED: idempotency conflict created a duplicate order';
  end if;
end;
$test$;

select 'RC104 order idempotency ownership/scope: PASS' as result;


-- RC498: authenticated browser/Edge clients may call the same RPC with their own JWT.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);

DO $rc498_authenticated_order$
DECLARE
  v_oid oid := to_regprocedure('public.create_order_backend(uuid, character varying, uuid, character varying, uuid, character varying, numeric, numeric, numeric, numeric, numeric, character varying, text, text, text, jsonb, text, jsonb)');
  v_config text[];
  v_result jsonb;
BEGIN
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC498_AUTHENTICATED_EXECUTE_MISSING';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC498_ANON_EXECUTE_PRESENT';
  END IF;
  IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC498_SERVICE_ROLE_EXECUTE_MISSING';
  END IF;
  SELECT proconfig INTO v_config FROM pg_proc WHERE oid=v_oid;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(v_config, ARRAY[]::text[])) setting
    WHERE setting='search_path=pg_catalog, public, extensions, pg_temp'
  ) THEN
    RAISE EXCEPTION 'RC498_SEARCH_PATH_INVALID: %', v_config;
  END IF;

  v_result := public.create_order_backend(
    '30000000-0000-4000-8000-000000000091',
    'tenant-a',
    '20000000-0000-4000-8000-000000000001',
    'branch-a',
    auth.uid(),
    'authenticated-order-key-rc498',
    0,0,0,0,0,'EGP','Customer One','01000000000','Authenticated customer address',
    '[{"catalogItemId":"40000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
    null,'{}'::jsonb
  );
  IF v_result->>'id' <> '30000000-0000-4000-8000-000000000091'
     OR v_result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'RC498_AUTHENTICATED_ORDER_CREATE_FAILED: %', v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
     WHERE id='30000000-0000-4000-8000-000000000091'
       AND customer_id=auth.uid()
       AND total_amount=125
  ) THEN
    RAISE EXCEPTION 'RC498_AUTHENTICATED_ORDER_NOT_PERSISTED_WITH_SERVER_PRICE';
  END IF;
END
$rc498_authenticated_order$;

RESET ROLE;

SELECT 'RC498 authenticated order RPC ACL, identity and pricing: PASS' AS result;
