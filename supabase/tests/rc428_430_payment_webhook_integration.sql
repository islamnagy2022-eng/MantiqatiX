-- RC428-RC430 behavioral integration tests. Disposable PostgreSQL only.
do $test$
declare
  tenant text := 'tenant-428-430';
  business_id uuid := '10000000-0000-4000-8000-000000004300';
  actor uuid := '20000000-0000-4000-8000-000000004300';
  order_id uuid := '30000000-0000-4000-8000-000000004300';
  intent_id uuid := '40000000-0000-4000-8000-000000004300';
  sub_fail_id uuid := '50000000-0000-4000-8000-000000004300';
  sub_success_id uuid := '60000000-0000-4000-8000-000000004300';
  result jsonb;
  rejected boolean;
begin
  insert into public.orders(id,tenant_id,status,pricing_hash,pricing_version,pricing_authority,total,currency)
  values(order_id,tenant,'PENDING','price-hash',1,'SERVER',100,'EGP');
  insert into public.payment_intents(id,tenant_id,order_id,provider,status,provider_order_id,pricing_hash,pricing_version,amount,currency)
  values(intent_id,tenant,order_id,'PAYMOB','PENDING','paymob-order-428','price-hash',1,100,'EGP');

  rejected := false;
  begin
    perform public.process_verified_provider_payment_failure(
      'evt-428-bad','tenant-428-430','PAYMOB','paymob:tx-428-bad',intent_id::text,
      'TRANSACTION',false,100,'EGP','tx-428-bad','paymob-order-428','{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'PAYMENT_FAILURE_SIGNATURE_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC428 must reject unverified signatures'; end if;

  result := public.process_verified_provider_payment_failure(
    'evt-428','tenant-428-430','PAYMOB','paymob:tx-428',intent_id::text,
    'TRANSACTION',true,100,'EGP','tx-428','paymob-order-428','{}'::jsonb
  );
  if result->>'status' <> 'FAILED' or (select status from public.payment_intents where id=intent_id) <> 'FAILED' then
    raise exception 'RC428 did not atomically fail the pending intent';
  end if;
  result := public.process_verified_provider_payment_failure(
    'evt-428-replay','tenant-428-430','PAYMOB','paymob:tx-428',intent_id::text,
    'TRANSACTION',true,100,'EGP','tx-428','paymob-order-428','{}'::jsonb
  );
  if result->>'idempotent' <> 'true' then raise exception 'RC428 identical replay was not idempotent'; end if;

  insert into public.businesses(id,tenant_id) values(business_id,tenant);
  insert into public.subscription_payment_intents(id,business_id,tier_code,billing_cycle,sector,amount,currency,status,provider,provider_order_id,created_by)
  values
    (sub_fail_id,business_id,'BASIC','MONTHLY','sector-a',100,'EGP','PENDING','PAYMOB','paymob-sub-fail',actor),
    (sub_success_id,business_id,'PRO','ANNUAL','sector-a',1000,'EGP','PENDING','PAYMOB','paymob-sub-success',actor);

  rejected := false;
  begin
    perform public.process_verified_subscription_payment_failure(
      'evt-429-bad','paymob:sub-fail-bad',sub_fail_id,'sub-fail-bad',100,'EGP',
      'wrong-order',true,'{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC429 must reject mismatched provider order'; end if;

  result := public.process_verified_subscription_payment_failure(
    'evt-429','paymob:sub-fail',sub_fail_id,'sub-fail',100,'EGP',
    'paymob-sub-fail',true,'{}'::jsonb
  );
  if result->>'status' <> 'FAILED' or (select status from public.subscription_payment_intents where id=sub_fail_id) <> 'FAILED' then
    raise exception 'RC429 did not fail subscription intent';
  end if;
  result := public.process_verified_subscription_payment_failure(
    'evt-429-replay','paymob:sub-fail',sub_fail_id,'sub-fail',100,'EGP',
    'paymob-sub-fail',true,'{}'::jsonb
  );
  if result->>'idempotent' <> 'true' then raise exception 'RC429 identical replay was not idempotent'; end if;

  rejected := false;
  begin
    perform public.process_verified_subscription_payment_backend(
      'evt-430-bad','paymob:sub-success-bad',sub_success_id,'sub-success-bad',1000,'EGP',
      'wrong-order',true,'{}'::jsonb
    );
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC430 must reject mismatched provider order'; end if;

  insert into public.user_memberships(user_id,business_id,status,role)
  values(actor,business_id,'ACTIVE','OWNER');
  result := public.process_verified_subscription_payment_backend(
    'evt-430','paymob:sub-success',sub_success_id,'sub-success',1000,'EGP',
    'paymob-sub-success',true,'{}'::jsonb
  );
  if result->>'status' <> 'ACTIVE' or result->>'ok' <> 'true' then
    raise exception 'RC430 did not activate the subscription: %',result;
  end if;
  if (select status from public.subscription_payment_intents where id=sub_success_id) <> 'SUCCEEDED' then
    raise exception 'RC430 did not finalize subscription payment intent';
  end if;
  if not exists(select 1 from public.business_subscriptions where business_id=business_id and status='ACTIVE' and source_payment_intent_id=sub_success_id) then
    raise exception 'RC430 did not create an active subscription';
  end if;
  result := public.process_verified_subscription_payment_backend(
    'evt-430-replay','paymob:sub-success',sub_success_id,'sub-success',1000,'EGP',
    'paymob-sub-success',true,'{}'::jsonb
  );
  if result->>'idempotent' <> 'true' then raise exception 'RC430 identical replay was not idempotent'; end if;
end;
$test$;
select 'RC428-RC430 payment webhook integration: PASS' as result;
