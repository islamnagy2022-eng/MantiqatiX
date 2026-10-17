-- RC526 RPC behavior tests. Disposable PostgreSQL only.
do $test$
declare
  v_ledger text := '52600000-0000-4000-8000-000000000001';
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
  if has_function_privilege('anon','public.claim_mantigo_payment_intent_backend(text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.claim_mantigo_payment_intent_backend(text,text)','EXECUTE') then
    raise exception 'RC526_CLAIM_RPC_MUST_BE_SERVICE_ROLE_ONLY';
  end if;
  if not has_function_privilege('service_role','public.claim_mantigo_payment_intent_backend(text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.finalize_mantigo_payment_intent_backend(text,text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RC526_SERVICE_ROLE_GRANTS_MISSING';
  end if;
  if has_function_privilege('anon','public.finalize_mantigo_payment_intent_backend(text,text,text,text,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.finalize_mantigo_payment_intent_backend(text,text,text,text,text,jsonb)','EXECUTE') then
    raise exception 'RC526_FINALIZE_RPC_MUST_BE_SERVICE_ROLE_ONLY';
  end if;
  if has_function_privilege('anon','public.release_mantigo_payment_intent_claim_backend(text,text,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.release_mantigo_payment_intent_claim_backend(text,text,integer)','EXECUTE') then
    raise exception 'RC526_RELEASE_RPC_MUST_BE_SERVICE_ROLE_ONLY';
  end if;
  if not has_function_privilege('service_role','public.release_mantigo_payment_intent_claim_backend(text,text,integer)','EXECUTE') then
    raise exception 'RC526_RELEASE_SERVICE_ROLE_GRANT_MISSING';
  end if;
  if has_table_privilege('anon','public.mantigo_payment_intent_claims','SELECT')
     or has_table_privilege('authenticated','public.mantigo_payment_intent_claims','SELECT')
     or has_table_privilege('anon','public.mantigo_payment_intent_secrets','SELECT')
     or has_table_privilege('authenticated','public.mantigo_payment_intent_secrets','SELECT') then
    raise exception 'RC526_INTERNAL_PAYMENT_TABLES_MUST_NOT_BE_CLIENT_READABLE';
  end if;
  if not has_table_privilege('service_role','public.mantigo_payment_intent_claims','SELECT')
     or not has_table_privilege('service_role','public.mantigo_payment_intent_secrets','SELECT') then
    raise exception 'RC526_SERVICE_ROLE_INTERNAL_TABLE_GRANTS_MISSING';
  end if;

  insert into public.mantigo_financial_ledger(id,ride_id,customer_id,captain_id,gross_amount,payment_status,idempotency_key,metadata)
  values(v_ledger,'ride-rc526','52600000-0000-4000-8000-000000000002','52600000-0000-4000-8000-000000000007',125,'REQUIRED','RC526-test-main','{"preserved":"yes"}'::jsonb);

  select public.claim_mantigo_payment_intent_backend(v_ledger,'claim-one') into v_claim_one;
  select metadata into v_metadata from public.mantigo_financial_ledger where id=v_ledger;
  if v_metadata->'paymob_intent_claim' ? 'token'
     or v_metadata->'paymob_intent_claim' ? 'token_hash'
     or v_metadata->'paymob_intent_claim' ? 'claim_token'
     or (select claim_token from public.mantigo_payment_intent_claims where ledger_id=v_ledger) <> 'claim-one' then
    raise exception 'RC526_CLAIM_TOKEN_MUST_STAY_OUT_OF_LEDGER_METADATA';
  end if;
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

  select payment_status,provider,provider_intent_id,metadata->>'paymob_intention_order_id',metadata
    into v_status,v_provider,v_intent,v_order,v_metadata
  from public.mantigo_financial_ledger where id=v_ledger;
  select client_secret into v_secret from public.mantigo_payment_intent_secrets where ledger_id=v_ledger;

  if v_status <> 'PENDING' or v_provider <> 'PAYMOB' or v_intent <> 'intent-1'
     or v_order <> 'order-1' or v_secret <> 'secret-1'
     or v_metadata ? 'paymob_intent_claim'
     or v_metadata ? 'paymob_client_secret'
     or v_metadata->>'preserved' <> 'yes'
     or exists(select 1 from public.mantigo_payment_intent_claims where ledger_id=v_ledger) then
    raise exception 'RC526_FINALIZED_LEDGER_CONTRACT_MISMATCH';
  end if;

  if public.claim_mantigo_payment_intent_backend(v_ledger,'claim-three') is not false then
    raise exception 'RC526_FINAL_LEDGER_MUST_NOT_BE_RECLAIMED';
  end if;
end
$test$;


-- Definitive provider rejection may release the exact claim; ambiguous statuses may not.
insert into public.mantigo_financial_ledger(id,ride_id,customer_id,captain_id,gross_amount,payment_status,idempotency_key,metadata)
values('52600000-0000-4000-8000-000000000005','ride-rc526-rejection','52600000-0000-4000-8000-000000000006','52600000-0000-4000-8000-000000000008',125,'REQUIRED','RC526-test-rejection','{"preserved":"yes"}'::jsonb);

do $release_test$
declare
  v_ledger text := '52600000-0000-4000-8000-000000000005';
  v_claimed boolean;
  v_released boolean;
  v_rejected boolean := false;
  v_metadata jsonb;
begin
  select public.claim_mantigo_payment_intent_backend(v_ledger,'rejection-token') into v_claimed;
  if v_claimed is not true then raise exception 'RC526_DEFINITIVE_REJECTION_CLAIM_FAILED'; end if;

  select public.release_mantigo_payment_intent_claim_backend(v_ledger,'wrong-token',400) into v_released;
  if v_released is not false then raise exception 'RC526_WRONG_TOKEN_MUST_NOT_RELEASE'; end if;

  begin
    perform public.release_mantigo_payment_intent_claim_backend(v_ledger,'rejection-token',null);
  exception when others then
    if sqlerrm <> 'PAYMENT_INTENT_RELEASE_STATUS_NOT_DEFINITIVE' then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'RC526_NULL_STATUS_MUST_NOT_RELEASE'; end if;
  v_rejected := false;

  begin
    perform public.release_mantigo_payment_intent_claim_backend(v_ledger,'rejection-token',500);
  exception when others then
    if sqlerrm <> 'PAYMENT_INTENT_RELEASE_STATUS_NOT_DEFINITIVE' then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'RC526_AMBIGUOUS_STATUS_MUST_NOT_RELEASE'; end if;

  select public.release_mantigo_payment_intent_claim_backend(v_ledger,'rejection-token',400) into v_released;
  if v_released is not true then raise exception 'RC526_DEFINITIVE_REJECTION_MUST_RELEASE'; end if;
  if exists(select 1 from public.mantigo_payment_intent_claims where ledger_id=v_ledger) then
    raise exception 'RC526_RELEASE_MUST_DELETE_PRIVATE_CLAIM_TOKEN';
  end if;

  select metadata into v_metadata from public.mantigo_financial_ledger where id=v_ledger;
  if v_metadata ? 'paymob_intent_claim'
     or v_metadata->'paymob_intent_last_rejection'->>'http_status' <> '400'
     or v_metadata->>'preserved' <> 'yes' then
    raise exception 'RC526_RELEASE_MUST_AUDIT_REJECTION_AND_PRESERVE_METADATA';
  end if;

  select public.claim_mantigo_payment_intent_backend(v_ledger,'retry-after-rejection') into v_claimed;
  if v_claimed is not true then raise exception 'RC526_CONFIRMED_REJECTION_MUST_ALLOW_SAFE_RETRY'; end if;
end
$release_test$;

-- Prove claim exclusivity with two independent PostgreSQL sessions.
-- Session A keeps its transaction open after claiming; session B blocks on the same
-- ledger row, then observes the committed claim and must lose.
create extension if not exists dblink;

insert into public.mantigo_financial_ledger(id,ride_id,customer_id,captain_id,gross_amount,payment_status,idempotency_key,metadata)
values('52600000-0000-4000-8000-000000000003','ride-rc526-concurrent','52600000-0000-4000-8000-000000000004','52600000-0000-4000-8000-000000000009',125,'REQUIRED','RC526-test-concurrent','{}'::jsonb);

do $concurrency$
declare
  v_ledger text := '52600000-0000-4000-8000-000000000003';
  v_first boolean;
  v_second boolean;
  v_sent integer;
begin

  perform public.dblink_connect('rc526_claim_a','dbname=' || current_database());
  perform public.dblink_connect('rc526_claim_b','dbname=' || current_database());
  perform public.dblink_exec('rc526_claim_a','begin');
  perform public.dblink_exec('rc526_claim_b','begin');

  select claimed into v_first
  from public.dblink(
    'rc526_claim_a',
    format('select public.claim_mantigo_payment_intent_backend(%L::text,%L::text)',v_ledger::text,'concurrent-token-a')
  ) as result(claimed boolean);

  if v_first is not true then
    raise exception 'RC526_CONCURRENT_CLAIM_FIRST_SESSION_MUST_WIN';
  end if;

  select public.dblink_send_query(
    'rc526_claim_b',
    format('select public.claim_mantigo_payment_intent_backend(%L::text,%L::text)',v_ledger::text,'concurrent-token-b')
  ) into v_sent;
  if v_sent <> 1 then
    raise exception 'RC526_CONCURRENT_CLAIM_SECOND_SESSION_DID_NOT_START';
  end if;

  -- The second session is blocked on the row lock until session A commits.
  perform public.dblink_exec('rc526_claim_a','commit');

  select claimed into v_second
  from public.dblink_get_result('rc526_claim_b') as result(claimed boolean);
  -- dblink async results must be drained through the terminal empty result before
  -- issuing another command on the same connection.
  perform claimed
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
