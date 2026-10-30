-- RC435 and RC439 subscription intent/checkout recovery integration. Disposable PostgreSQL 16 only.
\set ON_ERROR_STOP on

do $test$
declare
  owner_a uuid := '10000000-0000-4000-8000-000000004351';
  owner_b uuid := '10000000-0000-4000-8000-000000004352';
  business_a uuid := '20000000-0000-4000-8000-000000004351';
  business_b uuid := '20000000-0000-4000-8000-000000004352';
  intent_a uuid;
  intent_retry uuid;
  intent_legacy uuid := '30000000-0000-4000-8000-000000004353';
  intent_correlated uuid := '30000000-0000-4000-8000-000000004354';
  v public.subscription_payment_intents%rowtype;
  result jsonb;
  rejected boolean;
  n integer;
begin
  -- Only trusted backend execution is allowed for intent creation and provider-creation claim.
  if has_function_privilege('anon',
      'public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
      'public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE') then
    raise exception 'RC435 create-intent ACL contract failed';
  end if;
  if has_function_privilege('anon',
      'public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
      'public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'RC435 provider-creation claim ACL contract failed';
  end if;

  insert into public.businesses(id,tenant_id) values
    (business_a,'tenant-rc435-a'),(business_b,'tenant-rc435-b');
  insert into public.user_memberships(user_id,business_id,status,role) values
    (owner_a,business_a,'ACTIVE','BUSINESS_OWNER'),
    (owner_b,business_b,'ACTIVE','OWNER');
  insert into public.subscription_tier_prices(tier_code,monthly_price,annual_price,currency,active) values
    ('BASIC',100,1000,'EGP',true),
    ('GOLD',250,2500,'EGP',true),
    ('INACTIVE',50,500,'EGP',false);

  -- A valid owner can create one READY payment intent using the server-side price.
  select * into v
  from public.create_subscription_payment_intent_claimable_backend(
    business_a,'BASIC','MONTHLY','RETAIL','rc435-idem-a',owner_a
  );
  intent_a := v.id;
  if v.status <> 'CREATED' or v.provider_creation_state <> 'READY'
     or v.amount <> 100 or v.currency <> 'EGP'
     or v.pricing_hash is null or v.created_by <> owner_a then
    raise exception 'RC435 created intent does not satisfy READY pricing contract: %',row_to_json(v);
  end if;

  -- Repeated same idempotency key returns the original intent, not a second row.
  select * into v
  from public.create_subscription_payment_intent_claimable_backend(
    business_a,'BASIC','MONTHLY','RETAIL','rc435-idem-a',owner_a
  );
  if v.id <> intent_a then raise exception 'RC435 idempotent retry created a different intent'; end if;
  select count(*) into n from public.subscription_payment_intents where idempotency_key='rc435-idem-a';
  if n <> 1 then raise exception 'RC435 idempotency key did not remain unique'; end if;

  -- Reusing the key for a different business/tier/cycle must fail closed.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_b,'GOLD','MONTHLY','RETAIL','rc435-idem-a',owner_b
    );
    raise exception 'TEST_FAILED: RC435 accepted idempotency-key scope mismatch';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_IDEMPOTENCY_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 idempotency mismatch was not rejected'; end if;

  -- The free tier must not create a Paymob intent.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_a,'FREE_COMMISSION','MONTHLY','RETAIL','rc435-free-tier',owner_a
    );
    raise exception 'TEST_FAILED: RC435 created a payment intent for a free tier';
  exception when others then
    if sqlerrm <> 'FREE_TIER_REQUIRES_NO_PAYMENT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 free-tier denial was not observed'; end if;

  -- A non-owner cannot create a paid subscription intent.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_a,'BASIC','MONTHLY','RETAIL','rc435-non-owner',owner_b
    );
    raise exception 'TEST_FAILED: RC435 allowed a non-owner';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 non-owner denial was not observed'; end if;

  -- Inactive/unavailable tier cannot be purchased.
  rejected := false;
  begin
    perform public.create_subscription_payment_intent_claimable_backend(
      business_a,'INACTIVE','MONTHLY','RETAIL','rc435-inactive-tier',owner_a
    );
    raise exception 'TEST_FAILED: RC435 accepted an inactive tier';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_TIER_UNAVAILABLE' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 inactive tier denial was not observed'; end if;

  -- A single worker claims provider-intent creation; a second worker must not retry blindly.
  result := public.claim_subscription_provider_intent_creation_backend(intent_a,owner_a);
  if result->>'claimed' <> 'true' or result->>'outcome_unknown' <> 'false'
     or result->'intent'->>'provider_creation_state' <> 'CLAIMED'
     or result->'intent'->>'status' <> 'PENDING' then
    raise exception 'RC435 first claim did not transition READY to CLAIMED: %',result;
  end if;
  result := public.claim_subscription_provider_intent_creation_backend(intent_a,owner_a);
  if result->>'claimed' <> 'false' or result->>'outcome_unknown' <> 'true' then
    raise exception 'RC435 second claim did not fail closed for unknown provider outcome: %',result;
  end if;

  -- Wrong actor cannot claim a payment intent even if the caller knows its ID.
  rejected := false;
  begin
    perform public.claim_subscription_provider_intent_creation_backend(intent_a,owner_b);
    raise exception 'TEST_FAILED: RC435 allowed a different actor to claim intent';
  exception when others then
    if sqlerrm <> 'SUBSCRIPTION_PAYMENT_INTENT_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC435 wrong-actor claim denial was not observed'; end if;

  -- A legacy PENDING intent with no provider IDs is marked outcome-unknown and never retried.
  insert into public.subscription_payment_intents(
    id,business_id,tier_code,billing_cycle,amount,currency,status,provider,
    idempotency_key,created_by,provider_creation_state
  ) values(
    intent_legacy,business_a,'BASIC','MONTHLY',100,'EGP','PENDING','PAYMOB',
    'rc435-legacy',owner_a,'LEGACY_UNRECONCILED'
  );
  result := public.claim_subscription_provider_intent_creation_backend(intent_legacy,owner_a);
  if result->>'claimed' <> 'false' or result->>'outcome_unknown' <> 'true' then
    raise exception 'RC435 legacy pending intent was not marked outcome-unknown: %',result;
  end if;

  -- Once provider IDs are correlated, a repeated claim returns the existing intent safely.
  insert into public.subscription_payment_intents(
    id,business_id,tier_code,billing_cycle,amount,currency,status,provider,
    idempotency_key,created_by,provider_creation_state,provider_intent_id,provider_order_id
  ) values(
    intent_correlated,business_a,'GOLD','MONTHLY',250,'EGP','PENDING','PAYMOB',
    'rc435-correlated',owner_a,'CORRELATED','provider-intent-1','provider-order-1'
  );
  result := public.claim_subscription_provider_intent_creation_backend(intent_correlated,owner_a);
  if result->>'claimed' <> 'false' or result->>'outcome_unknown' <> 'false'
     or result->'intent'->>'provider_order_id' <> 'provider-order-1' then
    raise exception 'RC435 correlated intent did not return existing provider binding: %',result;
  end if;

  -- RC439: encrypted checkout material is an all-or-none tuple.
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscription_payment_intents'
      and column_name='client_secret_ciphertext'
  ) or not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscription_payment_intents'
      and column_name='client_secret_iv'
  ) or not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='subscription_payment_intents'
      and column_name='client_secret_key_version'
  ) then
    raise exception 'RC439 encrypted checkout columns were not created';
  end if;

  update public.subscription_payment_intents
  set client_secret_ciphertext='ciphertext-base64',
      client_secret_iv='iv-base64',
      client_secret_key_version='v1'
  where id=intent_a;
  if not exists(
    select 1 from public.subscription_payment_intents
    where id=intent_a and client_secret_ciphertext='ciphertext-base64'
      and client_secret_iv='iv-base64' and client_secret_key_version='v1'
  ) then raise exception 'RC439 complete encrypted checkout tuple was not persisted'; end if;

  rejected := false;
  begin
    update public.subscription_payment_intents
    set client_secret_ciphertext='partial-ciphertext',
        client_secret_iv=null,
        client_secret_key_version='v1'
    where id=intent_a;
    raise exception 'TEST_FAILED: RC439 accepted a partial encryption tuple';
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'RC439 partial encryption tuple was not rejected'; end if;

  update public.subscription_payment_intents
  set client_secret_ciphertext=null,client_secret_iv=null,client_secret_key_version=null
  where id=intent_a;
  if exists(
    select 1 from public.subscription_payment_intents
    where id=intent_a and (
      client_secret_ciphertext is not null or client_secret_iv is not null or client_secret_key_version is not null
    )
  ) then raise exception 'RC439 failed to clear the complete encryption tuple'; end if;

  raise notice 'RC435–RC439 subscription provider-claim and encrypted checkout recovery: PASS';
end;
$test$;

select 'RC435–RC439 subscription provider-claim and encrypted checkout recovery: PASS' as result;
