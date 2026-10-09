-- Behavioral tests for RC435. Run only in a disposable PostgreSQL database.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  other_actor uuid := '10000000-0000-4000-8000-000000000002';
  business uuid := '20000000-0000-4000-8000-000000000001';
  intent_id uuid := '30000000-0000-4000-8000-000000000001';
  intent_id_2 uuid := '30000000-0000-4000-8000-000000000002';
  result jsonb;
  rejected boolean;
begin
  insert into public.businesses(id,tenant_id,status) values(business,'tenant-a','ACTIVE');
  insert into public.user_memberships(user_id,tenant_id,business_id,role,status) values(actor,'tenant-a',business,'OWNER','ACTIVE');
  insert into public.subscription_payment_intents(id,business_id,created_by,status)
  values(intent_id,business,actor,'CREATED'),(intent_id_2,business,actor,'CREATED');

  result := public.claim_subscription_provider_intent_creation_backend(intent_id,actor);
  if (result->>'claimed')::boolean is distinct from true then raise exception 'first claim should succeed'; end if;
  if (result->'intent'->>'status') <> 'PENDING' then raise exception 'claim must transition intent to PENDING'; end if;

  result := public.claim_subscription_provider_intent_creation_backend(intent_id,actor);
  if (result->>'claimed')::boolean is distinct from false or (result->>'outcome_unknown')::boolean is distinct from true then
    raise exception 'retry without provider correlation must be unknown, not a second claim';
  end if;

  update public.subscription_payment_intents
  set provider_intent_id='paymob-intent-1',provider_order_id='paymob-order-1'
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

  rejected := false;
  begin
    perform public.claim_subscription_provider_intent_creation_backend(intent_id_2,other_actor);
  exception when others then
    if sqlerrm='SUBSCRIPTION_PAYMENT_INTENT_FORBIDDEN' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-user claim for CREATED intent was not rejected'; end if;

  update public.subscription_payment_intents set status='FAILED' where id=intent_id_2;
  result := public.claim_subscription_provider_intent_creation_backend(intent_id_2,actor);
  if (result->>'claimed')::boolean is distinct from false then raise exception 'terminal intent must not be claimed'; end if;

  if has_function_privilege('anon','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'anon must not execute RC435 claim RPC';
  end if;
  if has_function_privilege('authenticated','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'authenticated must not execute service-role RC435 claim RPC';
  end if;
  if not has_function_privilege('service_role','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE') then
    raise exception 'service_role must execute RC435 claim RPC';
  end if;
end;
$test$;

select 'RC435 subscription intention claim integration: PASS' as result;
