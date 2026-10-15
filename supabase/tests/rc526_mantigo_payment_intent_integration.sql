-- RC526 RPC behavior tests. Disposable PostgreSQL only.
do $test$
declare
  v_ledger uuid := '52600000-0000-4000-8000-000000000001';
  v_claim_one boolean;
  v_claim_two boolean;
  v_wrong_finalize boolean;
  v_finalized boolean;
  v_status text;
  v_provider text;
  v_intent text;
  v_order text;
  v_secret text;
  v_metadata jsonb;
begin
  if has_function_privilege('anon','public.claim_mantigo_payment_intent_backend(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.claim_mantigo_payment_intent_backend(uuid,text)','EXECUTE') then
    raise exception 'RC526_CLAIM_RPC_MUST_BE_SERVICE_ROLE_ONLY';
  end if;
  if not has_function_privilege('service_role','public.claim_mantigo_payment_intent_backend(uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.finalize_mantigo_payment_intent_backend(uuid,text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RC526_SERVICE_ROLE_GRANTS_MISSING';
  end if;
  if has_function_privilege('anon','public.finalize_mantigo_payment_intent_backend(uuid,text,text,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.finalize_mantigo_payment_intent_backend(uuid,text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RC526_FINALIZE_RPC_MUST_BE_SERVICE_ROLE_ONLY';
  end if;

  insert into public.mantigo_financial_ledger(id,ride_id,customer_id,gross_amount,payment_status,metadata)
  values(v_ledger,'ride-rc526','52600000-0000-4000-8000-000000000002',125,'REQUIRED','{"preserved":"yes"}'::jsonb);

  select public.claim_mantigo_payment_intent_backend(v_ledger,'claim-one') into v_claim_one;
  select public.claim_mantigo_payment_intent_backend(v_ledger,'claim-two') into v_claim_two;
  if v_claim_one is not true or v_claim_two is not false then
    raise exception 'RC526_CLAIM_MUST_ALLOW_ONLY_ONE_WINNER';
  end if;

  select public.finalize_mantigo_payment_intent_backend(
    v_ledger,'wrong-claim','intent-1','order-1','secret-1','["card"]'::jsonb
  ) into v_wrong_finalize;
  if v_wrong_finalize is not false then
    raise exception 'RC526_WRONG_CLAIM_MUST_NOT_FINALIZE';
  end if;

  select public.finalize_mantigo_payment_intent_backend(
    v_ledger,'claim-one','intent-1','order-1','secret-1','["card"]'::jsonb
  ) into v_finalized;
  if v_finalized is not true then
    raise exception 'RC526_VALID_CLAIM_MUST_FINALIZE';
  end if;

  select payment_status,provider,provider_intent_id,metadata->>'paymob_intention_order_id',
         metadata->>'paymob_client_secret',metadata
    into v_status,v_provider,v_intent,v_order,v_secret,v_metadata
  from public.mantigo_financial_ledger where id=v_ledger;

  if v_status <> 'PENDING' or v_provider <> 'PAYMOB' or v_intent <> 'intent-1'
     or v_order <> 'order-1' or v_secret <> 'secret-1'
     or v_metadata ? 'paymob_intent_claim'
     or v_metadata->>'preserved' <> 'yes' then
    raise exception 'RC526_FINALIZED_LEDGER_CONTRACT_MISMATCH';
  end if;

  if public.claim_mantigo_payment_intent_backend(v_ledger,'claim-three') is not false then
    raise exception 'RC526_FINAL_LEDGER_MUST_NOT_BE_RECLAIMED';
  end if;
end
$test$;


-- Prove claim exclusivity with two independent PostgreSQL sessions.
-- Session A keeps its transaction open after claiming; session B blocks on the same
-- ledger row, then observes the committed claim and must lose.
create extension if not exists dblink;

do $concurrency$
declare
  v_ledger uuid := '52600000-0000-4000-8000-000000000003';
  v_first boolean;
  v_second boolean;
  v_sent integer;
begin
  insert into public.mantigo_financial_ledger(id,ride_id,customer_id,gross_amount,payment_status,metadata)
  values(v_ledger,'ride-rc526-concurrent','52600000-0000-4000-8000-000000000004',125,'REQUIRED','{}'::jsonb);

  perform public.dblink_connect('rc526_claim_a','dbname=' || current_database());
  perform public.dblink_connect('rc526_claim_b','dbname=' || current_database());
  perform public.dblink_exec('rc526_claim_a','begin');
  perform public.dblink_exec('rc526_claim_b','begin');

  select claimed into v_first
  from public.dblink(
    'rc526_claim_a',
    format('select public.claim_mantigo_payment_intent_backend(%L::uuid,%L::text)',v_ledger::text,'concurrent-token-a')
  ) as result(claimed boolean);

  if v_first is not true then
    raise exception 'RC526_CONCURRENT_CLAIM_FIRST_SESSION_MUST_WIN';
  end if;

  select public.dblink_send_query(
    'rc526_claim_b',
    format('select public.claim_mantigo_payment_intent_backend(%L::uuid,%L::text)',v_ledger::text,'concurrent-token-b')
  ) into v_sent;
  if v_sent <> 1 then
    raise exception 'RC526_CONCURRENT_CLAIM_SECOND_SESSION_DID_NOT_START';
  end if;

  -- The second session is blocked on the row lock until session A commits.
  perform public.dblink_exec('rc526_claim_a','commit');

  select claimed into v_second
  from public.dblink_get_result('rc526_claim_b') as result(claimed boolean);

  perform public.dblink_exec('rc526_claim_b','commit');
  perform public.dblink_disconnect('rc526_claim_a');
  perform public.dblink_disconnect('rc526_claim_b');

  if v_second is not false then
    raise exception 'RC526_CONCURRENT_CLAIM_MUST_HAVE_EXACTLY_ONE_WINNER';
  end if;
end
$concurrency$;

select 'RC526 MantiGO payment-intent concurrent claim/finalize integration: PASS' as result;
