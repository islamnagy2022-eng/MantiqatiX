-- RC435/RC439 behavior and privilege checks. Disposable PostgreSQL 16 only.
\set ON_ERROR_STOP on

do $test$
declare
  owner_one uuid := '43500000-0000-4000-8000-000000000001';
  owner_two uuid := '43500000-0000-4000-8000-000000000002';
  staff_user uuid := '43500000-0000-4000-8000-000000000003';
  business_one uuid := '43900000-0000-4000-8000-000000000001';
  business_two uuid := '43900000-0000-4000-8000-000000000002';
  intent_one public.subscription_payment_intents%rowtype;
  intent_replay public.subscription_payment_intents%rowtype;
  claim_result jsonb;
  rejected boolean;
  n integer;
begin
  if has_function_privilege('anon',
       'public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE') then
    raise exception 'RC435 create-intent service-role ACL contract failed';
  end if;
  if has_function_privilege('anon',
       'public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'RC435 claim-intent service-role ACL contract failed';
  end if;

  insert into public.subscription_tier_prices(tier_code,monthly_price,annual_price,currency,active)
  values ('GOLD',200,2000,'EGP',true),('INACTIVE',100,1000,'EGP',false);
  insert into public.user_memberships(user_id,business_id,status,role) values
    (owner_one,business_one,'ACTIVE','OWNER'),
    (owner_two,business_two,'ACTIVE','BUSINESS_OWNER'),
    (staff_user,business_one,'ACTIVE','EMPLOYEE');

  -- Non-owner cannot create a subscription payment intent.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_one,'GOLD','MONTHLY','HEALTH','idem-staff',staff_user
    );
    raise exception 'TEST_FAILED: RC435 accepted a non-owner actor';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 non-owner denial was not observed'; end if;

  -- Legal clearance is required before a new claimable payment intent is created.
  perform set_config('mantiqatix_test.legal_fail','true',true);
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_one,'GOLD','MONTHLY','HEALTH','idem-legal-denied',owner_one
    );
    raise exception 'TEST_FAILED: RC435 bypassed legal clearance';
  exception when others then
    if sqlerrm <> 'TEST_LEGAL_CLEARANCE_DENIED' then raise; end if;
    rejected := true;
  end;
  perform set_config('mantiqatix_test.legal_fail','false',true);
  if not rejected then raise exception 'RC435 legal denial was not observed'; end if;

  -- Create one READY intent with authoritative tier pricing and pricing hash.
  select * into intent_one
  from public.create_subscription_payment_intent_claimable_backend(
    business_one,'GOLD','MONTHLY','HEALTH','idem-owner-one',owner_one
  );
  if intent_one.id is null or intent_one.status <> 'CREATED'
     or intent_one.provider_creation_state <> 'READY'
     or intent_one.amount <> 200 or intent_one.currency <> 'EGP'
     or intent_one.pricing_hash is null then
    raise exception 'RC435 new intent contract failed: %',row_to_json(intent_one);
  end if;

  -- Exact idempotent replay returns the same intent and does not create another row.
  select * into intent_replay
  from public.create_subscription_payment_intent_claimable_backend(
    business_one,'GOLD','MONTHLY','HEALTH','idem-owner-one',owner_one
  );
  if intent_replay.id <> intent_one.id then raise exception 'RC435 exact idempotency did not return original intent'; end if;
  select count(*) into n from public.subscription_payment_intents where idempotency_key='idem-owner-one';
  if n <> 1 then raise exception 'RC435 exact replay created duplicate intents'; end if;

  -- Reusing an idempotency key for a different business or plan fails closed.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_two,'GOLD','MONTHLY','HEALTH','idem-owner-one',owner_two
    );
    raise exception 'TEST_FAILED: RC435 accepted cross-business idempotency reuse';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_IDEMPOTENCY_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 cross-business idempotency denial was not observed'; end if;

  -- Inactive tier and free-commission tiers must not create payment intents.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_one,'INACTIVE','MONTHLY','HEALTH','idem-inactive',owner_one
    );
    raise exception 'TEST_FAILED: RC435 accepted an inactive tier';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_TIER_UNAVAILABLE' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 inactive tier denial was not observed'; end if;

  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_one,'FREE_COMMISSION','MONTHLY','HEALTH','idem-free',owner_one
    );
    raise exception 'TEST_FAILED: RC435 accepted a free tier for paid checkout';
  exception when others then
    if sqlerrm <> 'FREE_TIER_REQUIRES_NO_PAYMENT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 free-tier denial was not observed'; end if;

  -- Only one request can claim the READY intent. A second attempt is outcome-unknown,
  -- and must reconcile rather than creating a second provider intention.
  claim_result := public.claim_subscription_provider_intent_creation_backend(intent_one.id,owner_one);
  if claim_result->>'claimed' <> 'true' or claim_result->>'outcome_unknown' <> 'false'
     or claim_result->'intent'->>'provider_creation_state' <> 'CLAIMED'
     or claim_result->'intent'->>'status' <> 'PENDING' then
    raise exception 'RC435 initial claim failed: %',claim_result;
  end if;

  claim_result := public.claim_subscription_provider_intent_creation_backend(intent_one.id,owner_one);
  if claim_result->>'claimed' <> 'false' or claim_result->>'outcome_unknown' <> 'true' then
    raise exception 'RC435 duplicate claim was not fail-closed: %',claim_result;
  end if;

  -- Another actor cannot claim the owner's intent.
  rejected := false;
  begin
    perform public.claim_subscription_provider_intent_creation_backend(intent_one.id,owner_two);
    raise exception 'TEST_FAILED: RC435 accepted a different actor';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PAYMENT_INTENT_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 cross-actor claim denial was not observed'; end if;

  -- Once provider IDs are correlated, recovery returns the existing intent without re-claiming.
  update public.subscription_payment_intents
  set provider_intent_id='paymob-intent-435',
      provider_order_id='paymob-order-435',
      provider_creation_state='CORRELATED'
  where id=intent_one.id;
  claim_result := public.claim_subscription_provider_intent_creation_backend(intent_one.id,owner_one);
  if claim_result->>'claimed' <> 'false' or claim_result->>'outcome_unknown' <> 'false'
     or claim_result->'intent'->>'provider_order_id' <> 'paymob-order-435' then
    raise exception 'RC435 correlated intent recovery failed: %',claim_result;
  end if;

  -- RC439 adds an all-or-none ciphertext/IV/key-version tuple.
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscription_payment_intents'
      and column_name='client_secret_ciphertext'
  ) then raise exception 'RC439 ciphertext column missing'; end if;
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscription_payment_intents'
      and column_name='client_secret_iv'
  ) then raise exception 'RC439 IV column missing'; end if;
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscription_payment_intents'
      and column_name='client_secret_key_version'
  ) then raise exception 'RC439 key-version column missing'; end if;

  update public.subscription_payment_intents
  set client_secret_ciphertext='ciphertext-base64',
      client_secret_iv='iv-base64',
      client_secret_key_version='v1'
  where id=intent_one.id;

  rejected := false;
  begin
    update public.subscription_payment_intents
    set client_secret_ciphertext='partial-ciphertext',
        client_secret_iv=null,
        client_secret_key_version='v1'
    where id=intent_one.id;
    raise exception 'TEST_FAILED: RC439 accepted a partial ciphertext tuple';
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'RC439 partial tuple constraint was not enforced'; end if;

  update public.subscription_payment_intents
  set client_secret_ciphertext=null,
      client_secret_iv=null,
      client_secret_key_version=null
  where id=intent_one.id;

  raise notice 'RC435–RC439 subscription claim and encrypted checkout schema: PASS';
end;
$test$;

select 'RC435–RC439 subscription claim and encrypted checkout schema: PASS' as result;
