-- RC428–RC430 behavioral integration. Disposable PostgreSQL 16 only.
\set ON_ERROR_STOP on

do $test$
declare
  actor_one uuid := '10000000-0000-4000-8000-000000004281';
  actor_two uuid := '10000000-0000-4000-8000-000000004282';
  actor_three uuid := '10000000-0000-4000-8000-000000004283';
  business_one uuid := '20000000-0000-4000-8000-000000004281';
  business_two uuid := '20000000-0000-4000-8000-000000004282';
  business_three uuid := '20000000-0000-4000-8000-000000004283';
  business_four uuid := '20000000-0000-4000-8000-000000004284';
  order_one uuid := '30000000-0000-4000-8000-000000004281';
  order_two uuid := '30000000-0000-4000-8000-000000004282';
  sub_success uuid := '40000000-0000-4000-8000-000000004281';
  sub_failure uuid := '40000000-0000-4000-8000-000000004282';
  sub_legal uuid := '40000000-0000-4000-8000-000000004283';
  sub_no_owner uuid := '40000000-0000-4000-8000-000000004284';
  sub_atomic uuid := '40000000-0000-4000-8000-000000004285';
  result jsonb;
  rejected boolean;
  n integer;
  v_status text;
  v_subscription_count integer;
begin
  -- The database processor is callable only through the trusted server role.
  if has_function_privilege('anon',
    'public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated',
    'public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RC428 service-role-only ACL contract failed';
  end if;
  if has_function_privilege('anon',
    'public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
    or has_function_privilege('authenticated',
    'public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE') then
    raise exception 'RC429 service-role-only ACL contract failed';
  end if;
  if has_function_privilege('anon',
    'public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
    or has_function_privilege('authenticated',
    'public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)','EXECUTE') then
    raise exception 'RC430 service-role-only ACL contract failed';
  end if;

  insert into public.businesses(id,tenant_id) values
    (business_one,'tenant-sub-one'),
    (business_two,'tenant-sub-two'),
    (business_three,'tenant-sub-three'),
    (business_four,'tenant-sub-four');

  insert into public.user_memberships(user_id,business_id,status,role) values
    (actor_one,business_one,'ACTIVE','BUSINESS_OWNER'),
    (actor_two,business_two,'ACTIVE','OWNER'),
    (actor_three,business_four,'ACTIVE','BUSINESS_OWNER');

  insert into public.orders(id,tenant_id,status,total,currency,pricing_version,pricing_hash,pricing_authority) values
    (order_one,'tenant-a','PENDING',100,'EGP',7,'pricing-hash-a','catalog_v1'),
    (order_two,'tenant-a','PENDING',100,'EGP',7,'pricing-hash-a','catalog_v1');

  insert into public.payment_intents(
    id,tenant_id,order_id,amount,currency,status,provider,provider_order_id,pricing_version,pricing_hash
  ) values
    ('pi-failure','tenant-a',order_one,100,'EGP','PENDING','PAYMOB','paymob-order-failure',7,'pricing-hash-a'),
    ('pi-final','tenant-a',order_two,100,'EGP','SUCCEEDED','PAYMOB','paymob-order-final',7,'pricing-hash-a'),
    ('pi-atomic','tenant-a',order_one,100,'EGP','PENDING','PAYMOB','paymob-order-atomic',7,'pricing-hash-a');

  insert into public.subscription_payment_intents(
    id,business_id,tier_code,billing_cycle,sector,amount,currency,status,provider,
    provider_order_id,created_by
  ) values
    (sub_success,business_one,'GOLD','MONTHLY','HEALTH',200,'EGP','PENDING','PAYMOB','sub-order-success',actor_one),
    (sub_failure,business_one,'GOLD','MONTHLY','HEALTH',200,'EGP','PENDING','PAYMOB','sub-order-failure',actor_one),
    (sub_legal,business_two,'SILVER','ANNUAL','FOOD',500,'EGP','PENDING','PAYMOB','sub-order-legal',actor_two),
    (sub_no_owner,business_three,'BASIC','MONTHLY','OTHER',80,'EGP','PENDING','PAYMOB','sub-order-no-owner',actor_three),
    (sub_atomic,business_four,'GOLD','MONTHLY','RETAIL',300,'EGP','PENDING','PAYMOB','sub-order-atomic',actor_three);

  -- RC428 rejects an unverified signature before touching event or payment state.
  rejected := false;
  begin
    perform public.process_verified_provider_payment_failure(
      'evt-r428-bad-signature','tenant-a','PAYMOB','paymob:txn-bad-signature',
      'pi-failure','TRANSACTION',false,100,'EGP','txn-bad-signature','paymob-order-failure','{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC428 accepted an unverified signature';
  exception when others then
    if sqlerrm <> 'PAYMENT_FAILURE_SIGNATURE_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC428 signature denial was not observed'; end if;

  -- RC428 binds signed provider order, amount, currency, pricing and tenant.
  rejected := false;
  begin
    perform public.process_verified_provider_payment_failure(
      'evt-r428-wrong-order','tenant-a','PAYMOB','paymob:txn-wrong-order',
      'pi-failure','TRANSACTION',true,100,'EGP','txn-wrong-order','wrong-provider-order','{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC428 accepted a mismatched provider order';
  exception when others then
    if sqlerrm <> 'PAYMENT_PROVIDER_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC428 provider-order mismatch was not rejected'; end if;

  rejected := false;
  begin
    perform public.process_verified_provider_payment_failure(
      'evt-r428-wrong-amount','tenant-a','PAYMOB','paymob:txn-wrong-amount',
      'pi-failure','TRANSACTION',true,99,'EGP','txn-wrong-amount','paymob-order-failure','{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC428 accepted a mismatched amount';
  exception when others then
    if sqlerrm <> 'PROVIDER_FINANCIAL_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC428 amount mismatch was not rejected'; end if;

  rejected := false;
  begin
    perform public.process_verified_provider_payment_failure(
      'evt-r428-wrong-tenant','tenant-other','PAYMOB','paymob:txn-wrong-tenant',
      'pi-failure','TRANSACTION',true,100,'EGP','txn-wrong-tenant','paymob-order-failure','{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC428 accepted a mismatched tenant';
  exception when others then
    if sqlerrm <> 'TENANT_OR_PROVIDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC428 tenant mismatch was not rejected'; end if;

  -- A valid failure writes the provider event and intent transition atomically.
  result := public.process_verified_provider_payment_failure(
    'evt-r428-failure','tenant-a','PAYMOB','paymob:txn-failure',
    'pi-failure','TRANSACTION',true,100,'EGP','txn-failure','paymob-order-failure',
    '{"callback":"verified-failure"}'::jsonb
  );
  if result->>'status' <> 'FAILED' or result->>'idempotent' <> 'false' then
    raise exception 'RC428 first failure returned unexpected result: %',result;
  end if;
  if (select status from public.payment_intents where id='pi-failure') <> 'FAILED' then
    raise exception 'RC428 did not transition the payment intent to FAILED';
  end if;
  select count(*) into n from public.payment_provider_events where external_event_id='paymob:txn-failure';
  if n <> 1 then raise exception 'RC428 should persist exactly one failure event'; end if;

  result := public.process_verified_provider_payment_failure(
    'evt-r428-failure-replay','tenant-a','PAYMOB','paymob:txn-failure',
    'pi-failure','TRANSACTION',true,100,'EGP','txn-failure','paymob-order-failure',
    '{"callback":"verified-failure"}'::jsonb
  );
  if result->>'idempotent' <> 'true' or result->>'status' <> 'FAILED' then
    raise exception 'RC428 exact replay was not idempotent: %',result;
  end if;

  -- A verified late failure may be recorded but cannot downgrade a successful intent.
  result := public.process_verified_provider_payment_failure(
    'evt-r428-late-failure','tenant-a','PAYMOB','paymob:txn-late-failure',
    'pi-final','TRANSACTION',true,100,'EGP','txn-late-failure','paymob-order-final','{}'::jsonb
  );
  if result->>'already_final' <> 'true' or result->>'status' <> 'SUCCEEDED' then
    raise exception 'RC428 late failure did not preserve the final state: %',result;
  end if;
  if (select status from public.payment_intents where id='pi-final') <> 'SUCCEEDED' then
    raise exception 'RC428 late failure downgraded a successful intent';
  end if;

  -- RC429 rejects invalid signatures, provider-order mismatch, and amount mismatch.
  rejected := false;
  begin
    perform public.process_verified_subscription_payment_failure(
      'evt-r429-no-signature','paymob:sub-no-signature',sub_failure,'sub-no-signature',200,'EGP',
      'sub-order-failure',false,'{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC429 accepted an unverified signature';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PROVIDER_SIGNATURE_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC429 signature denial was not observed'; end if;

  rejected := false;
  begin
    perform public.process_verified_subscription_payment_failure(
      'evt-r429-wrong-order','paymob:sub-wrong-order',sub_failure,'sub-wrong-order',200,'EGP',
      'wrong-sub-order',true,'{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC429 accepted a mismatched provider order';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC429 provider-order mismatch was not rejected'; end if;

  rejected := false;
  begin
    perform public.process_verified_subscription_payment_failure(
      'evt-r429-wrong-amount','paymob:sub-wrong-amount',sub_failure,'sub-wrong-amount',199,'EGP',
      'sub-order-failure',true,'{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC429 accepted a mismatched amount';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC429 amount mismatch was not rejected'; end if;

  result := public.process_verified_subscription_payment_failure(
    'evt-r429-failure','paymob:sub-failure',sub_failure,'sub-failure',200,'EGP',
    'sub-order-failure',true,'{"failure":"verified"}'::jsonb
  );
  if result->>'status' <> 'FAILED' or result->>'idempotent' <> 'false' then
    raise exception 'RC429 failure processing returned unexpected result: %',result;
  end if;
  if (select status from public.subscription_payment_intents where id=sub_failure) <> 'FAILED' then
    raise exception 'RC429 did not mark the subscription payment intent FAILED';
  end if;
  select count(*) into n from public.payment_provider_events where external_event_id='paymob:sub-failure';
  if n <> 1 then raise exception 'RC429 did not persist exactly one provider event'; end if;

  result := public.process_verified_subscription_payment_failure(
    'evt-r429-failure-replay','paymob:sub-failure',sub_failure,'sub-failure',200,'EGP',
    'sub-order-failure',true,'{"failure":"verified"}'::jsonb
  );
  if result->>'idempotent' <> 'true' or result->>'status' <> 'FAILED' then
    raise exception 'RC429 exact replay was not idempotent: %',result;
  end if;

  -- RC430 success correlates the same provider identifiers and activates a subscription once.
  result := public.process_verified_subscription_payment_backend(
    'evt-r430-success','paymob:sub-success',sub_success,'sub-success',200,'EGP',
    'sub-order-success',true,'{"success":"verified"}'::jsonb
  );
  if result->>'status' <> 'ACTIVE' or result->>'ok' <> 'true' then
    raise exception 'RC430 success did not activate the subscription: %',result;
  end if;
  if (select status from public.subscription_payment_intents where id=sub_success) <> 'SUCCEEDED' then
    raise exception 'RC430 did not finalize the subscription intent';
  end if;
  select count(*) into v_subscription_count from public.business_subscriptions
  where source_payment_intent_id=sub_success;
  if v_subscription_count <> 1 then
    raise exception 'RC430 should create exactly one business subscription, got %',v_subscription_count;
  end if;

  result := public.process_verified_subscription_payment_backend(
    'evt-r430-success-replay','paymob:sub-success',sub_success,'sub-success',200,'EGP',
    'sub-order-success',true,'{"success":"replay"}'::jsonb
  );
  if result->>'idempotent' <> 'true' then
    raise exception 'RC430 exact replay was not idempotent: %',result;
  end if;
  select count(*) into v_subscription_count from public.business_subscriptions
  where source_payment_intent_id=sub_success;
  if v_subscription_count <> 1 then
    raise exception 'RC430 replay duplicated the business subscription';
  end if;

  -- RC430 never downgrades a paid intent when a later failure callback arrives.
  result := public.process_verified_subscription_payment_failure(
    'evt-r429-late-failure','paymob:sub-late-failure',sub_success,'sub-late-failure',200,'EGP',
    'sub-order-success',true,'{}'::jsonb
  );
  if result->>'already_final' <> 'true' or result->>'status' <> 'SUCCEEDED' then
    raise exception 'RC429 late failure did not preserve RC430 success: %',result;
  end if;
  if (select status from public.subscription_payment_intents where id=sub_success) <> 'SUCCEEDED' then
    raise exception 'RC429 late failure downgraded RC430 success';
  end if;

  -- A provider event replayed for a different subscription intent must fail closed.
  rejected := false;
  begin
    perform public.process_verified_subscription_payment_failure(
      'evt-r429-cross-intent','paymob:sub-failure',sub_success,'sub-failure',200,'EGP',
      'sub-order-success',true,'{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC429 accepted cross-intent event replay';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC429 cross-intent event replay was not rejected'; end if;

  -- If legal clearance is unavailable after a verified payment, preserve paid-but-pending status.
  perform set_config('mantiqatix_test.legal_fail','true',true);
  result := public.process_verified_subscription_payment_backend(
    'evt-r430-legal','paymob:sub-legal',sub_legal,'sub-legal',500,'EGP',
    'sub-order-legal',true,'{}'::jsonb
  );
  perform set_config('mantiqatix_test.legal_fail','false',true);
  if result->>'status' <> 'PAID_PENDING_LEGAL' or result->>'ok' <> 'false' then
    raise exception 'RC430 did not preserve paid-pending-legal state: %',result;
  end if;
  if (select status from public.subscription_payment_intents where id=sub_legal) <> 'PAID_PENDING_LEGAL' then
    raise exception 'RC430 legal failure status was not persisted';
  end if;
  select count(*) into v_subscription_count from public.business_subscriptions
  where source_payment_intent_id=sub_legal;
  if v_subscription_count <> 0 then raise exception 'RC430 activated a subscription without legal clearance'; end if;

  -- Missing owner also remains paid-pending-legal and must not create an active subscription.
  result := public.process_verified_subscription_payment_backend(
    'evt-r430-no-owner','paymob:sub-no-owner',sub_no_owner,'sub-no-owner',80,'EGP',
    'sub-order-no-owner',true,'{}'::jsonb
  );
  if result->>'status' <> 'PAID_PENDING_LEGAL' or result->>'reason' <> 'OWNER_NOT_FOUND' then
    raise exception 'RC430 missing-owner state was not handled safely: %',result;
  end if;
  select count(*) into v_subscription_count from public.business_subscriptions
  where source_payment_intent_id=sub_no_owner;
  if v_subscription_count <> 0 then raise exception 'RC430 created a subscription without an active owner'; end if;

  -- RC428 event + intent mutation are atomic: injected update failure leaves no event.
  perform set_config('mantiqatix_test.rc428_fail','true',true);
  rejected := false;
  begin
    perform public.process_verified_provider_payment_failure(
      'evt-r428-atomic','tenant-a','PAYMOB','paymob:txn-atomic',
      'pi-atomic','TRANSACTION',true,100,'EGP','txn-atomic','paymob-order-atomic','{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC428 injected update failure unexpectedly committed';
  exception when others then
    if sqlerrm <> 'RC428_TEST_ATOMIC_UPDATE_FAILURE' then raise; end if;
    rejected := true;
  end;
  perform set_config('mantiqatix_test.rc428_fail','false',true);
  if not rejected then raise exception 'RC428 atomic failure trigger did not fire'; end if;
  select count(*) into n from public.payment_provider_events where external_event_id='paymob:txn-atomic';
  select status into v_status from public.payment_intents where id='pi-atomic';
  if n <> 0 or v_status <> 'PENDING' then
    raise exception 'RC428 failed operation left partial state: events %, status %',n,v_status;
  end if;

  -- RC429 event + status mutation are atomic under an injected update failure.
  -- Re-arm one subscription intent for the isolated atomic rollback assertion.
  update public.subscription_payment_intents set status='PENDING' where id=sub_failure;
  perform set_config('mantiqatix_test.rc429_fail','true',true);
  rejected := false;
  begin
    perform public.process_verified_subscription_payment_failure(
      'evt-r429-atomic','paymob:sub-atomic',sub_failure,
      'sub-atomic',200,'EGP','sub-order-failure',true,'{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC429 injected update failure unexpectedly committed';
  exception when others then
    if sqlerrm <> 'RC429_TEST_ATOMIC_UPDATE_FAILURE' then raise; end if;
    rejected := true;
  end;
  perform set_config('mantiqatix_test.rc429_fail','false',true);
  if not rejected then raise exception 'RC429 atomic failure trigger did not fire'; end if;
  select count(*) into n from public.payment_provider_events where external_event_id='paymob:sub-atomic';
  select status into v_status from public.subscription_payment_intents where id=sub_failure;
  if n <> 0 or v_status <> 'PENDING' then
    raise exception 'RC429 failed operation left partial state: events %, status %',n,v_status;
  end if;

  -- RC430 event, intent status and subscription creation are atomic together.
  perform set_config('mantiqatix_test.rc430_fail','true',true);
  rejected := false;
  begin
    perform public.process_verified_subscription_payment_backend(
      'evt-r430-atomic','paymob:sub-atomic',sub_atomic,'sub-atomic',300,'EGP',
      'sub-order-atomic',true,'{}'::jsonb
    );
    raise exception 'TEST_FAILED: RC430 injected subscription insert failure unexpectedly committed';
  exception when others then
    if sqlerrm <> 'RC430_TEST_ATOMIC_SUBSCRIPTION_FAILURE' then raise; end if;
    rejected := true;
  end;
  perform set_config('mantiqatix_test.rc430_fail','false',true);
  if not rejected then raise exception 'RC430 atomic subscription trigger did not fire'; end if;
  select count(*) into n from public.payment_provider_events where external_event_id='paymob:sub-atomic';
  select status into v_status from public.subscription_payment_intents where id=sub_atomic;
  select count(*) into v_subscription_count from public.business_subscriptions where source_payment_intent_id=sub_atomic;
  if n <> 0 or v_status <> 'PENDING' or v_subscription_count <> 0 then
    raise exception 'RC430 failure left partial state: events %, intent %, subscriptions %',n,v_status,v_subscription_count;
  end if;

  raise notice 'RC428–RC430 Paymob webhook atomicity integration: PASS';
end;
$test$;

select 'RC428–RC430 Paymob webhook atomicity integration: PASS' as result;
