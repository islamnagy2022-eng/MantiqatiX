-- Behavioral tests for RC435. Run only in a disposable PostgreSQL database.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  other_actor uuid := '10000000-0000-4000-8000-000000000002';
  business uuid := '20000000-0000-4000-8000-000000000001';
  intent_id uuid;
  intent_id_2 uuid;
  legacy_id uuid := '30000000-0000-4000-8000-000000000003';
  v public.subscription_payment_intents%rowtype;
  v_retry public.subscription_payment_intents%rowtype;
  result jsonb;
  rejected boolean;
begin
  insert into public.businesses(id,tenant_id,status) values(business,'tenant-a','ACTIVE');
  insert into public.user_memberships(user_id,tenant_id,business_id,role,status) values(actor,'tenant-a',business,'OWNER','ACTIVE');
  insert into public.subscription_tier_prices(tier_code,monthly_price,annual_price,currency,active) values('BASIC',100,1000,'EGP',true);

  v := public.create_subscription_payment_intent_claimable_backend(business,'BASIC','MONTHLY','sector-a','idem-key-0001',actor);
  intent_id := v.id;
  if v.status <> 'CREATED' or v.provider_creation_state <> 'READY' then raise exception 'new intent must be READY and CREATED'; end if;
  v_retry := public.create_subscription_payment_intent_claimable_backend(business,'BASIC','MONTHLY','sector-a','idem-key-0001',actor);
  if v_retry.id <> intent_id then raise exception 'same idempotency key created a second intent'; end if;

  result := public.claim_subscription_provider_intent_creation_backend(intent_id,actor);
  if (result->>'claimed')::boolean is distinct from true then raise exception 'first claim should succeed'; end if;
  if result->'intent'->>'status' <> 'PENDING' or result->'intent'->>'provider_creation_state' <> 'CLAIMED' then
    raise exception 'claim must transition intent to PENDING/CLAIMED';
  end if;

  result := public.claim_subscription_provider_intent_creation_backend(intent_id,actor);
  if (result->>'claimed')::boolean is distinct from false or (result->>'outcome_unknown')::boolean is distinct from true then
    raise exception 'retry without provider correlation must be unknown, not a second claim';
  end if;

  update public.subscription_payment_intents
  set provider_intent_id='paymob-intent-1',provider_order_id='paymob-order-1',provider_creation_state='CORRELATED'
  where id=intent_id;
  result := public.claim_subscription_provider_intent_creation_backend(intent_id,actor);
  if (result->>'claimed')::boolean is distinct from false or (result->>'outcome_unknown')::boolean is distinct from false then
    raise exception 'already correlated provider intent should not be claimed again';
  end if;
  if result->'intent'->>'provider_order_id' <> 'paymob-order-1' then raise exception 'existing provider correlation was not returned'; end if;

  rejected := false;
  begin
    perform public.claim_subscription_provider_intent_creation_backend(intent_id,other_actor);
  exception when others then
    if sqlerrm='SUBSCRIPTION_PAYMENT_INTENT_FORBIDDEN' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-user intent claim was not rejected'; end if;

  v_retry := public.create_subscription_payment_intent_claimable_backend(business,'BASIC','MONTHLY','sector-a','idem-key-0002',actor);
  intent_id_2 := v_retry.id;
  update public.subscription_payment_intents set provider_intent_id='partial-intent',provider_order_id=null,status='CREATED'
  where id=intent_id_2;
  result := public.claim_subscription_provider_intent_creation_backend(intent_id_2,actor);
  if (result->>'claimed')::boolean is distinct from false or (result->>'outcome_unknown')::boolean is distinct from true then
    raise exception 'partial provider correlation must require reconciliation';
  end if;

  insert into public.subscription_payment_intents(
    id,business_id,tier_code,billing_cycle,amount,currency,status,provider,idempotency_key,pricing_hash,created_by
  ) values(legacy_id,business,'BASIC','MONTHLY',100,'EGP','CREATED','PAYMOB','legacy-key-0003','legacy-hash',actor);
  result := public.claim_subscription_provider_intent_creation_backend(legacy_id,actor);
  if (result->>'claimed')::boolean is distinct from false or (result->>'outcome_unknown')::boolean is distinct from true then
    raise exception 'legacy unclaimed intent must not be automatically retried';
  end if;

  update public.subscription_payment_intents set status='FAILED',provider_intent_id=null,provider_order_id=null
  where id=intent_id_2;
  result := public.claim_subscription_provider_intent_creation_backend(intent_id_2,actor);
  if (result->>'claimed')::boolean is distinct from false then raise exception 'terminal intent must not be claimed'; end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscription_payment_intents' and column_name='client_secret_ciphertext')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscription_payment_intents' and column_name='client_secret_iv')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscription_payment_intents' and column_name='client_secret_key_version') then
    raise exception 'RC439 encrypted checkout columns are missing';
  end if;
  rejected := false;
  begin
    update public.subscription_payment_intents set client_secret_ciphertext='ciphertext-only' where id=intent_id_2;
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'partial encrypted checkout secret must be rejected'; end if;

  if has_function_privilege('anon','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'anon must not execute RC435 claim RPC';
  end if;
  if has_function_privilege('authenticated','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'authenticated must not execute service-role RC435 claim RPC';
  end if;
  if not has_function_privilege('service_role','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'service_role must execute RC435 claim RPC';
  end if;
  if has_function_privilege('authenticated','public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE') then
    raise exception 'authenticated must not execute claimable intent RPC directly';
  end if;
  if not has_function_privilege('service_role','public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)','EXECUTE') then
    raise exception 'service_role must execute claimable intent RPC';
  end if;
end;
$test$;

select 'RC435 subscription intention claim integration: PASS' as result;
