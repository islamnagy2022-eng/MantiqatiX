-- RC425 behavioral integration tests; run only in disposable PostgreSQL.
do $test$
declare
  v_result jsonb;
  v_customer uuid := '10000000-0000-4000-8000-000000000001';
  v_ledger public.mantigo_financial_ledger%rowtype;
  v_notifications integer;
  v_events integer;
  v_status text;
begin
  if has_function_privilege('anon','public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'anon must not execute MantiGo payment processor';
  end if;
  if has_function_privilege('authenticated','public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'authenticated must not execute MantiGo payment processor';
  end if;
  if not has_function_privilege('service_role','public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)','EXECUTE') then
    raise exception 'service_role must execute MantiGo payment processor';
  end if;

  insert into public.mantigo_financial_ledger
    (id,ride_id,customer_id,provider,metadata,gross_amount,currency,payment_status)
  values
    ('ledger-success','ride-success',v_customer,'PAYMOB','{"paymob_intention_order_id":"9001"}',100,'EGP','PENDING'),
    ('ledger-recovery','ride-recovery',v_customer,'PAYMOB','{"paymob_intention_order_id":"9002"}',75,'EGP','PENDING'),
    ('ledger-binding','ride-binding',v_customer,'PAYMOB','{"paymob_intention_order_id":"9003"}',50,'EGP','PENDING');

  -- A valid verified success is atomic across event, ledger, and notification.
  v_result := public.process_verified_mantigo_payment_backend(
    'ledger-success','paymob:TX-SUCCESS','PAID',true,100,'EGP','TX-SUCCESS',
    '{"provider":"PAYMOB","transaction_id":"TX-SUCCESS","merchant_order_id":"ledger-success","provider_order_id":"9001","amount_cents":"10000","currency":"EGP","success":true}'::jsonb
  );
  if v_result->>'status' <> 'PAID' or v_result->>'idempotent' <> 'false' then
    raise exception 'first success did not produce the expected result: %',v_result;
  end if;
  select * into v_ledger from public.mantigo_financial_ledger where id='ledger-success';
  if v_ledger.payment_status <> 'PAID' or v_ledger.provider_transaction_id <> 'TX-SUCCESS' or v_ledger.payment_confirmed_at is null then
    raise exception 'ledger success state was not fully persisted';
  end if;
  select count(*) into v_events from public.mantigo_payment_provider_events where ledger_id='ledger-success';
  select count(*) into v_notifications from public.notifications where entity_id='ride-success';
  if v_events <> 1 or v_notifications <> 1 then
    raise exception 'success must create exactly one event and one notification (events %, notifications %)',v_events,v_notifications;
  end if;

  -- Exact provider-event replay is idempotent and does not duplicate notifications.
  v_result := public.process_verified_mantigo_payment_backend(
    'ledger-success','paymob:TX-SUCCESS','PAID',true,100,'EGP','TX-SUCCESS',
    '{"provider":"PAYMOB","transaction_id":"TX-SUCCESS","merchant_order_id":"ledger-success","provider_order_id":"9001","amount_cents":"10000","currency":"EGP","success":true}'::jsonb
  );
  if v_result->>'idempotent' <> 'true' then raise exception 'exact replay was not idempotent: %',v_result; end if;
  select count(*) into v_notifications from public.notifications where entity_id='ride-success';
  if v_notifications <> 1 then raise exception 'exact replay duplicated notification'; end if;

  -- Reusing the same provider event with a conflicting final status must fail.
  begin
    perform public.process_verified_mantigo_payment_backend(
      'ledger-success','paymob:TX-SUCCESS','FAILED',true,100,'EGP','TX-SUCCESS',
      '{"provider":"PAYMOB","transaction_id":"TX-SUCCESS","merchant_order_id":"ledger-success","provider_order_id":"9001","amount_cents":"10000","currency":"EGP","success":false}'::jsonb
    );
    raise exception 'conflicting event replay unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_PAYMENT_EVENT_REPLAY_STATUS_MISMATCH%' then raise; end if;
  end;

  -- A provider event already bound to one ledger cannot be replayed against another ledger.
  begin
    perform public.process_verified_mantigo_payment_backend(
      'ledger-binding','paymob:TX-SUCCESS','PAID',true,50,'EGP','TX-SUCCESS',
      '{"provider":"PAYMOB","transaction_id":"TX-SUCCESS","merchant_order_id":"ledger-binding","provider_order_id":"9003","amount_cents":"5000","currency":"EGP","success":true}'::jsonb
    );
    raise exception 'cross-ledger event replay unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH%' then raise; end if;
  end;

  -- Signature must be verified by the Edge Function before any state mutation.
  begin
    perform public.process_verified_mantigo_payment_backend(
      'ledger-binding','paymob:TX-NOSIG','PAID',false,50,'EGP','TX-NOSIG',
      '{"provider":"PAYMOB","transaction_id":"TX-NOSIG","merchant_order_id":"ledger-binding","provider_order_id":"9003","amount_cents":"5000","currency":"EGP","success":true}'::jsonb
    );
    raise exception 'unverified callback unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_PAYMENT_SIGNATURE_REQUIRED%' then raise; end if;
  end;

  -- Locked ledger metadata is authoritative for Paymob order correlation.
  begin
    perform public.process_verified_mantigo_payment_backend(
      'ledger-binding','paymob:TX-WRONG-ORDER','PAID',true,50,'EGP','TX-WRONG-ORDER',
      '{"provider":"PAYMOB","transaction_id":"TX-WRONG-ORDER","merchant_order_id":"ledger-binding","provider_order_id":"wrong-order","amount_cents":"5000","currency":"EGP","success":true}'::jsonb
    );
    raise exception 'wrong provider order unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_PAYMENT_PAYLOAD_BINDING_MISMATCH%' then raise; end if;
  end;

  -- Raw amount must bind to the amount passed to the processor.
  begin
    perform public.process_verified_mantigo_payment_backend(
      'ledger-binding','paymob:TX-WRONG-AMOUNT','PAID',true,50,'EGP','TX-WRONG-AMOUNT',
      '{"provider":"PAYMOB","transaction_id":"TX-WRONG-AMOUNT","merchant_order_id":"ledger-binding","provider_order_id":"9003","amount_cents":"4900","currency":"EGP","success":true}'::jsonb
    );
    raise exception 'payload amount mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_PAYMENT_PAYLOAD_AMOUNT_MISMATCH%' then raise; end if;
  end;

  -- Processor amount must also match the locked ledger amount.
  begin
    perform public.process_verified_mantigo_payment_backend(
      'ledger-binding','paymob:TX-LEDGER-AMOUNT','PAID',true,49,'EGP','TX-LEDGER-AMOUNT',
      '{"provider":"PAYMOB","transaction_id":"TX-LEDGER-AMOUNT","merchant_order_id":"ledger-binding","provider_order_id":"9003","amount_cents":"4900","currency":"EGP","success":true}'::jsonb
    );
    raise exception 'ledger amount mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%MANTIGO_AMOUNT_CURRENCY_MISMATCH%' then raise; end if;
  end;

  select count(*) into v_events from public.mantigo_payment_provider_events where ledger_id='ledger-binding';
  select payment_status into v_status from public.mantigo_financial_ledger where id='ledger-binding';
  if v_events <> 0 or v_status <> 'PENDING' then
    raise exception 'rejected callback mutated event ledger or payment state';
  end if;

  -- A failed payment can recover through a distinct verified success event.
  v_result := public.process_verified_mantigo_payment_backend(
    'ledger-recovery','paymob:TX-FAIL','FAILED',true,75,'EGP','TX-FAIL',
    '{"provider":"PAYMOB","transaction_id":"TX-FAIL","merchant_order_id":"ledger-recovery","provider_order_id":"9002","amount_cents":"7500","currency":"EGP","success":false}'::jsonb
  );
  if v_result->>'status' <> 'FAILED' then raise exception 'failed callback did not mark ledger failed: %',v_result; end if;
  v_result := public.process_verified_mantigo_payment_backend(
    'ledger-recovery','paymob:TX-RECOVER','PAID',true,75,'EGP','TX-RECOVER',
    '{"provider":"PAYMOB","transaction_id":"TX-RECOVER","merchant_order_id":"ledger-recovery","provider_order_id":"9002","amount_cents":"7500","currency":"EGP","success":true}'::jsonb
  );
  if v_result->>'status' <> 'PAID' then raise exception 'distinct success did not recover failed payment: %',v_result; end if;
  select count(*) into v_events from public.mantigo_payment_provider_events where ledger_id='ledger-recovery';
  select count(*) into v_notifications from public.notifications where entity_id='ride-recovery';
  if v_events <> 2 or v_notifications <> 2 then
    raise exception 'failure then recovery should persist two events and two notifications (events %, notifications %)',v_events,v_notifications;
  end if;
end;
$test$;

select 'RC425 MantiGo Paymob atomicity integration: PASS' as result;
