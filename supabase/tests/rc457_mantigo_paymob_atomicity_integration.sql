-- RC457 atomic MantiGO Paymob webhook behavioral tests; disposable PostgreSQL only.
do $test$
declare
  v_result jsonb;
  v_count integer;
  v_status text;
begin
  if has_function_privilege('anon','public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'anon must not execute the atomic payment RPC';
  end if;
  if has_function_privilege('authenticated','public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'authenticated must not execute the atomic payment RPC';
  end if;
  if not has_function_privilege('service_role','public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'service_role must execute the atomic payment RPC';
  end if;

  insert into public.mantigo_financial_ledger(id,provider,gross_amount,currency,payment_status) values
    ('ledger-paid','PAYMOB',125.00,'EGP','PENDING'),
    ('ledger-wrong-target','PAYMOB',125.00,'EGP','PENDING'),
    ('ledger-legacy','PAYMOB',90.00,'EGP','PENDING'),
    ('ledger-fail-closed','PAYMOB',70.00,'EGP','PENDING'),
    ('ledger-failed','PAYMOB',55.00,'EGP','PENDING');

  -- A successful callback persists event and ledger transition together.
  v_result:=public.process_verified_mantigo_paymob_event('ledger-paid','paymob:txn-1','PAID',true,125.00,'EGP','txn-1','{"test":"success"}'::jsonb);
  if v_result->>'status' <> 'PAID' or v_result->>'idempotent' <> 'false' then
    raise exception 'first success result was unexpected: %',v_result;
  end if;
  select payment_status into v_status from public.mantigo_financial_ledger where id='ledger-paid';
  if v_status <> 'PAID' then raise exception 'ledger did not transition to PAID'; end if;
  select count(*) into v_count from public.payment_provider_events where external_event_id='paymob:txn-1';
  if v_count <> 1 then raise exception 'expected exactly one persisted provider event'; end if;

  -- Exact duplicate is idempotent and does not duplicate event rows.
  v_result:=public.process_verified_mantigo_paymob_event('ledger-paid','paymob:txn-1','PAID',true,125.00,'EGP','txn-1','{}'::jsonb);
  if v_result->>'idempotent' <> 'true' then raise exception 'exact replay was not idempotent: %',v_result; end if;
  select count(*) into v_count from public.payment_provider_events where external_event_id='paymob:txn-1';
  if v_count <> 1 then raise exception 'exact replay duplicated the event'; end if;

  -- Same external event cannot be rebound to another ledger.
  begin
    perform public.process_verified_mantigo_paymob_event('ledger-wrong-target','paymob:txn-1','PAID',true,125.00,'EGP','txn-1','{}'::jsonb);
    raise exception 'wrong-ledger replay unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_EVENT_BINDING_CONFLICT%' then raise; end if;
  end;

  -- Same event ID with a contradictory status is rejected.
  begin
    perform public.process_verified_mantigo_paymob_event('ledger-paid','paymob:txn-1','FAILED',true,125.00,'EGP','txn-1','{}'::jsonb);
    raise exception 'contradictory replay status unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_EVENT_STATUS_CONFLICT%' then raise; end if;
  end;

  -- Amount/currency mismatch must not persist an event.
  begin
    perform public.process_verified_mantigo_paymob_event('ledger-wrong-target','paymob:bad-amount','PAID',true,999.00,'EGP','bad-amount','{}'::jsonb);
    raise exception 'amount mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_AMOUNT_CURRENCY_MISMATCH%' then raise; end if;
  end;
  select count(*) into v_count from public.payment_provider_events where external_event_id='paymob:bad-amount';
  if v_count <> 0 then raise exception 'amount mismatch persisted an event'; end if;

  -- Recovery for a legacy partial write: existing verified event repairs a pending ledger.
  insert into public.payment_provider_events(tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
  values('MNTY-PLATFORM','PAYMOB','MANTIGO_RIDE_PAYMENT','ledger-legacy','paymob:legacy','PAID',true,'{}'::jsonb,now());
  v_result:=public.process_verified_mantigo_paymob_event('ledger-legacy','paymob:legacy','PAID',true,90.00,'EGP','legacy-txn','{}'::jsonb);
  if v_result->>'recovered' <> 'true' then raise exception 'legacy event did not repair pending ledger: %',v_result; end if;
  select payment_status into v_status from public.mantigo_financial_ledger where id='ledger-legacy';
  if v_status <> 'PAID' then raise exception 'legacy partial write was not recovered'; end if;

  -- A simulated failure after event insert must roll back the event insert too.
  perform set_config('test.fail_ledger_update','on',true);
  begin
    perform public.process_verified_mantigo_paymob_event('ledger-fail-closed','paymob:txn-fail','PAID',true,70.00,'EGP','txn-fail','{}'::jsonb);
    raise exception 'simulated ledger write failure did not fire';
  exception when others then
    if sqlerrm not like '%SIMULATED_LEDGER_WRITE_FAILURE%' then raise; end if;
  end;
  perform set_config('test.fail_ledger_update','off',true);
  select count(*) into v_count from public.payment_provider_events where external_event_id='paymob:txn-fail';
  if v_count <> 0 then raise exception 'event insert was not rolled back with failed ledger transition'; end if;
  select payment_status into v_status from public.mantigo_financial_ledger where id='ledger-fail-closed';
  if v_status <> 'PENDING' then raise exception 'ledger state changed after simulated transaction failure'; end if;

  -- Failed provider status is also recorded atomically and cannot be replayed as success.
  v_result:=public.process_verified_mantigo_paymob_event('ledger-failed','paymob:txn-failed','FAILED',true,55.00,'EGP','txn-failed','{}'::jsonb);
  if v_result->>'status' <> 'FAILED' then raise exception 'failed provider event was not recorded: %',v_result; end if;
  begin
    perform public.process_verified_mantigo_paymob_event('ledger-failed','paymob:txn-failed','PAID',true,55.00,'EGP','txn-failed','{}'::jsonb);
    raise exception 'failed-to-paid contradictory replay unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_EVENT_STATUS_CONFLICT%' then raise; end if;
  end;
end;
$test$;

select 'RC457 MantiGO Paymob atomicity integration: PASS' as result;
