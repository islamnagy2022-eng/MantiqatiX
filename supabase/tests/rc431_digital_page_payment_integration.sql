-- RC431 behavioral integration tests. Disposable PostgreSQL only.
do $test$
declare
  order_one uuid := '10000000-0000-4000-8000-000000004311';
  order_two uuid := '10000000-0000-4000-8000-000000004312';
  result jsonb;
  rejected boolean;
  n integer;
begin
  if has_function_privilege('anon','public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE') then
    raise exception 'anon must not execute the digital-page payment RPC';
  end if;
  if has_function_privilege('authenticated','public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE') then
    raise exception 'authenticated must not execute the digital-page payment RPC';
  end if;
  if has_function_privilege('service_role','public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)','EXECUTE') is not true then
    raise exception 'service_role must execute the digital-page payment RPC';
  end if;

  insert into public.digital_page_orders(id,provider,amount,currency,provider_order_id,payment_status,fulfillment_status)
  values
    (order_one,'PAYMOB',125.00,'EGP','paymob-order-one','PENDING','REQUESTED'),
    (order_two,'PAYMOB',125.00,'EGP','paymob-order-two','PENDING','REQUESTED');

  -- A validly verified transaction must not be assigned using a forged merchant reference
  -- when the signed provider order belongs to a different order.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      order_two,'paymob:tx-one','TRANSACTION','SUCCEEDED',true,125.00,'EGP',
      'tx-one','paymob-order-one','{}'::jsonb
    );
    raise exception 'TEST_FAILED: mismatched provider order unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'mismatched provider order was not rejected'; end if;
  if (select payment_status from public.digital_page_orders where id=order_two) <> 'PENDING' then
    raise exception 'provider-order mismatch changed the order status';
  end if;
  if exists(select 1 from public.digital_page_payment_events where external_event_id='paymob:tx-one') then
    raise exception 'provider-order mismatch persisted a payment event';
  end if;

  -- Event identity is bound to the provider transaction ID.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      order_one,'paymob:another-tx','TRANSACTION','SUCCEEDED',true,125.00,'EGP',
      'tx-one','paymob-order-one','{}'::jsonb
    );
    raise exception 'TEST_FAILED: event/transaction mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'event/transaction mismatch was not rejected'; end if;

  -- Missing status and invalid amount fail before recording an event.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      order_one,'paymob:tx-null','TRANSACTION',null,true,125.00,'EGP',
      'tx-null','paymob-order-one','{}'::jsonb
    );
    raise exception 'TEST_FAILED: NULL status unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_EVENT_STATUS_INVALID' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'NULL status was not rejected'; end if;

  -- Correct order + amount/currency + event ID transitions atomically.
  result := public.process_verified_digital_page_payment_backend(
    order_one,'paymob:tx-one','TRANSACTION','SUCCEEDED',true,125.00,'EGP',
    'tx-one','paymob-order-one','{"test":"success"}'::jsonb
  );
  if result->>'payment_status' <> 'PAID' or result->>'fulfillment_status' <> 'IN_REVIEW' then
    raise exception 'valid success callback returned unexpected state: %',result;
  end if;
  if (select payment_status from public.digital_page_orders where id=order_one) <> 'PAID' then
    raise exception 'valid success callback did not mark order PAID';
  end if;
  select count(*) into n from public.digital_page_payment_events where external_event_id='paymob:tx-one';
  if n <> 1 then raise exception 'expected exactly one persisted provider event, got %',n; end if;

  -- Same event/status is idempotent; same event with a conflicting status is rejected.
  result := public.process_verified_digital_page_payment_backend(
    order_one,'paymob:tx-one','TRANSACTION','SUCCEEDED',true,125.00,'EGP',
    'tx-one','paymob-order-one','{"test":"replay"}'::jsonb
  );
  if result->>'idempotent' <> 'true' then raise exception 'same-status replay was not idempotent'; end if;

  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      order_one,'paymob:tx-one','TRANSACTION','FAILED',true,125.00,'EGP',
      'tx-one','paymob-order-one','{}'::jsonb
    );
    raise exception 'TEST_FAILED: conflicting replay status unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'conflicting replay status was not rejected'; end if;
  if (select payment_status from public.digital_page_orders where id=order_one) <> 'PAID' then
    raise exception 'conflicting replay downgraded a paid order';
  end if;

  -- A different late event cannot downgrade a final order.
  result := public.process_verified_digital_page_payment_backend(
    order_one,'paymob:tx-late','TRANSACTION','FAILED',true,125.00,'EGP',
    'tx-late','paymob-order-one','{}'::jsonb
  );
  if result->>'already_final' <> 'true' or result->>'payment_status' <> 'PAID' then
    raise exception 'late failure did not preserve final PAID state: %',result;
  end if;
  if (select payment_status from public.digital_page_orders where id=order_one) <> 'PAID' then
    raise exception 'late failure changed final payment state';
  end if;

  -- A different order cannot reuse an event ID already associated with order one.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      order_two,'paymob:tx-one','TRANSACTION','SUCCEEDED',true,125.00,'EGP',
      'tx-one','paymob-order-two','{}'::jsonb
    );
    raise exception 'TEST_FAILED: event reuse across orders unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-order event reuse was not rejected'; end if;
  if (select payment_status from public.digital_page_orders where id=order_two) <> 'PENDING' then
    raise exception 'cross-order event reuse changed the second order';
  end if;
end
$test$;

select 'RC431 digital-page payment binding integration: PASS' as result;
