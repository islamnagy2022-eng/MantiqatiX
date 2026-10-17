-- RC428/RC429/RC430 integration tests; run only in disposable PostgreSQL.
do $test$
declare
  v_result jsonb;
  v_status text;
  v_events integer;
  v_subscriptions integer;
  v_normal uuid := '30000000-0000-4000-8000-000000000001';
  v_normal_second uuid := '30000000-0000-4000-8000-000000000002';
  v_order uuid := '20000000-0000-4000-8000-000000000001';
  v_order_second uuid := '20000000-0000-4000-8000-000000000002';
  v_business uuid := '50000000-0000-4000-8000-000000000001';
  v_business_owner uuid := '60000000-0000-4000-8000-000000000001';
  v_sub_failure uuid := '40000000-0000-4000-8000-000000000001';
  v_sub_success uuid := '40000000-0000-4000-8000-000000000002';
begin
  if has_function_privilege('anon','public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RC428_FAIL: untrusted roles can execute failure processor';
  end if;
  if has_function_privilege('anon','public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE') then
    raise exception 'RC429_FAIL: untrusted roles can execute subscription failure processor';
  end if;
  if has_function_privilege('anon','public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE') then
    raise exception 'RC430_FAIL: untrusted roles can execute subscription success processor';
  end if;

  insert into public.orders(id,tenant_id,status,pricing_hash,pricing_version,pricing_authority,total,currency)
  values
    (v_order,'tenant-a','PENDING','hash-a',1,'SERVER',100,'EGP'),
    (v_order_second,'tenant-a','PENDING','hash-a',1,'SERVER',100,'EGP');
  insert into public.payment_intents(id,tenant_id,order_id,provider,provider_order_id,amount,currency,status,pricing_version,pricing_hash)
  values
    (v_normal,'tenant-a',v_order,'PAYMOB','provider-order-a',100,'EGP','PENDING',1,'hash-a'),
    (v_normal_second,'tenant-a',v_order_second,'PAYMOB','provider-order-a',100,'EGP','PENDING',1,'hash-a');

  v_result := public.process_verified_provider_payment_failure(
    'paymob:TX-FAIL-A','tenant-a','PAYMOB','paymob:TX-FAIL-A',v_normal::text,'TRANSACTION',true,
    100,'EGP','TX-FAIL-A','provider-order-a','{"case":"normal-failure"}'::jsonb
  );
  if v_result->>'status' <> 'FAILED' or coalesce((v_result->>'idempotent')::boolean,true) then
    raise exception 'RC428_FAIL: pending intent did not transition atomically to FAILED: %',v_result;
  end if;

  v_result := public.process_verified_provider_payment_failure(
    'paymob:TX-FAIL-A','tenant-a','PAYMOB','paymob:TX-FAIL-A',v_normal::text,'TRANSACTION',true,
    100,'EGP','TX-FAIL-A','provider-order-a','{"case":"normal-failure"}'::jsonb
  );
  if coalesce((v_result->>'idempotent')::boolean,false) is not true then
    raise exception 'RC428_FAIL: duplicate failure callback not idempotent: %',v_result;
  end if;

  begin
    perform public.process_verified_provider_payment_failure(
      'paymob:TX-FAIL-A','tenant-a','PAYMOB','paymob:TX-FAIL-A',v_normal_second::text,'TRANSACTION',true,
      100,'EGP','TX-FAIL-A','provider-order-a','{"case":"cross-intent-replay"}'::jsonb
    );
    raise exception 'RC428_FAIL: cross-intent event replay unexpectedly succeeded';
  exception when others then
    if position('EXTERNAL_EVENT_REPLAY_MISMATCH' in sqlerrm)=0 then raise; end if;
  end;

  update public.payment_intents set status='SUCCEEDED' where id=v_normal_second;
  v_result := public.process_verified_provider_payment_failure(
    'paymob:TX-LATE-FAIL','tenant-a','PAYMOB','paymob:TX-LATE-FAIL',v_normal_second::text,'TRANSACTION',true,
    100,'EGP','TX-LATE-FAIL','provider-order-a','{"case":"late-failure"}'::jsonb
  );
  select status into v_status from public.payment_intents where id=v_normal_second;
  if v_status <> 'SUCCEEDED' or coalesce((v_result->>'already_final')::boolean,false) is not true then
    raise exception 'RC428_FAIL: late failure downgraded a successful payment: %, %',v_status,v_result;
  end if;

  insert into public.businesses(id,tenant_id) values (v_business,'tenant-sub');
  insert into public.subscription_payment_intents(
    id,business_id,amount,currency,status,provider,provider_order_id,tier_code,billing_cycle,sector,created_by
  ) values
    (v_sub_failure,v_business,250,'EGP','PENDING','PAYMOB','subscription-order-failure','PRO','MONTHLY','COFFEE',v_business_owner),
    (v_sub_success,v_business,250,'EGP','PENDING','PAYMOB','subscription-order-success','PRO','MONTHLY','COFFEE',v_business_owner);

  v_result := public.process_verified_subscription_payment_failure(
    'paymob-sub:TX-SUB-FAIL','paymob:TX-SUB-FAIL',v_sub_failure,'TX-SUB-FAIL',250,'EGP',
    'subscription-order-failure',true,'{"case":"subscription-failure"}'::jsonb
  );
  if v_result->>'status' <> 'FAILED' or coalesce((v_result->>'idempotent')::boolean,true) then
    raise exception 'RC429_FAIL: subscription failure did not transition atomically: %',v_result;
  end if;
  v_result := public.process_verified_subscription_payment_failure(
    'paymob-sub:TX-SUB-FAIL','paymob:TX-SUB-FAIL',v_sub_failure,'TX-SUB-FAIL',250,'EGP',
    'subscription-order-failure',true,'{"case":"subscription-failure"}'::jsonb
  );
  if coalesce((v_result->>'idempotent')::boolean,false) is not true then
    raise exception 'RC429_FAIL: duplicate subscription failure not idempotent: %',v_result;
  end if;

  insert into public.user_memberships(business_id,user_id,status,role)
  values(v_business,v_business_owner,'ACTIVE','OWNER');
  v_result := public.process_verified_subscription_payment_backend(
    'paymob-sub:TX-SUB-SUCCESS','paymob:TX-SUB-SUCCESS',v_sub_success,'TX-SUB-SUCCESS',250,'EGP',
    'subscription-order-success',true,'{"case":"subscription-success"}'::jsonb
  );
  select status into v_status from public.subscription_payment_intents where id=v_sub_success;
  select count(*) into v_subscriptions from public.business_subscriptions where source_payment_intent_id=v_sub_success;
  if v_status <> 'SUCCEEDED' or v_subscriptions <> 1 or v_result->>'status' <> 'ACTIVE' then
    raise exception 'RC430_FAIL: subscription success did not atomically finalize/activate: status %, subscriptions %, result %',v_status,v_subscriptions,v_result;
  end if;

  v_result := public.process_verified_subscription_payment_backend(
    'paymob-sub:TX-SUB-SUCCESS','paymob:TX-SUB-SUCCESS',v_sub_success,'TX-SUB-SUCCESS',250,'EGP',
    'subscription-order-success',true,'{"case":"subscription-success"}'::jsonb
  );
  if coalesce((v_result->>'idempotent')::boolean,false) is not true then
    raise exception 'RC430_FAIL: duplicate subscription success not idempotent: %',v_result;
  end if;

  v_result := public.process_verified_subscription_payment_failure(
    'paymob-sub:TX-SUB-LATE-FAIL','paymob:TX-SUB-LATE-FAIL',v_sub_success,'TX-SUB-LATE-FAIL',250,'EGP',
    'subscription-order-success',true,'{"case":"late-subscription-failure"}'::jsonb
  );
  select status into v_status from public.subscription_payment_intents where id=v_sub_success;
  if v_status <> 'SUCCEEDED' or coalesce((v_result->>'already_final')::boolean,false) is not true then
    raise exception 'RC429_FAIL: late failure downgraded a successful subscription: %, %',v_status,v_result;
  end if;

  begin
    perform public.process_verified_subscription_payment_backend(
      'paymob-sub:TX-SUB-SUCCESS','paymob:TX-SUB-SUCCESS',v_sub_success,'TX-SUB-SUCCESS',250,'EGP',
      'wrong-provider-order',true,'{"case":"subscription-success-replay"}'::jsonb
    );
    raise exception 'RC430_FAIL: mismatched provider order unexpectedly succeeded';
  exception when others then
    if position('SUBSCRIPTION_PROVIDER_ORDER_MISMATCH' in sqlerrm)=0 then raise; end if;
  end;

  select count(*) into v_events from public.payment_provider_events;
  if v_events <> 5 then
    raise exception 'RC428-430_FAIL: unexpected event count %, expected 5',v_events;
  end if;
end;
$test$;

select 'RC428/RC429/RC430 Paymob atomic transition integration: PASS' as result;
