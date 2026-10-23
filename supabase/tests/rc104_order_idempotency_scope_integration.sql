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
