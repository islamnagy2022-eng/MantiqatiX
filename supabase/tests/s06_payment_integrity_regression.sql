-- S06 adversarial payment-integrity regressions; disposable PostgreSQL only.
do $test$
declare
  target uuid := '10000000-0000-4000-8000-000000006061';
  rejected boolean;
  n integer;
  result jsonb;
begin
  insert into public.digital_page_orders
    (id,provider,amount,currency,provider_order_id,payment_status,fulfillment_status)
  values
    (target,'PAYMOB',249.50,'EGP','s06-provider-order','PENDING','REQUESTED');

  -- A caller cannot bypass the provider-signature verification boundary.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      target,'paymob:s06-bad-signature','TRANSACTION','SUCCEEDED',false,249.50,'EGP',
      's06-bad-signature','s06-provider-order','{"suite":"S06"}'::jsonb
    );
    raise exception 'TEST_FAILED: unverified callback unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_SIGNATURE_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'unverified callback was not rejected'; end if;

  -- Zero and negative provider amounts must fail before an event is persisted.
  foreach n in array array[0, -1] loop
    rejected := false;
    begin
      perform public.process_verified_digital_page_payment_backend(
        target,'paymob:s06-amount-'||n::text,'TRANSACTION','SUCCEEDED',true,n,'EGP',
        's06-amount-'||n::text,'s06-provider-order','{"suite":"S06"}'::jsonb
      );
      raise exception 'TEST_FAILED: invalid amount % unexpectedly succeeded', n;
    exception when others then
      if sqlerrm <> 'DIGITAL_PAGE_AMOUNT_CURRENCY_INVALID' then raise; end if;
      rejected := true;
    end;
    if not rejected then raise exception 'invalid amount % was not rejected',n; end if;
  end loop;

  -- An event identifier must be derived from the exact provider transaction ID.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      target,'paymob:s06-event-A','TRANSACTION','SUCCEEDED',true,249.50,'EGP',
      's06-transaction-B','s06-provider-order','{"suite":"S06"}'::jsonb
    );
    raise exception 'TEST_FAILED: mismatched event/transaction unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'event/transaction mismatch was not rejected'; end if;

  -- Provider order reference must bind the callback to the stored order.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      target,'paymob:s06-provider-order-mismatch','TRANSACTION','SUCCEEDED',true,249.50,'EGP',
      's06-provider-order-mismatch','wrong-provider-order','{"suite":"S06"}'::jsonb
    );
    raise exception 'TEST_FAILED: provider order mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'provider order mismatch was not rejected'; end if;

  -- The provider amount and currency must match the stored order snapshot.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      target,'paymob:s06-amount-currency-mismatch','TRANSACTION','SUCCEEDED',true,248.50,'USD',
      's06-amount-currency-mismatch','s06-provider-order','{"suite":"S06"}'::jsonb
    );
    raise exception 'TEST_FAILED: amount/currency mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'amount/currency mismatch was not rejected'; end if;

  select count(*) into n from public.digital_page_payment_events
    where digital_page_order_id=target;
  if n <> 0 then raise exception 'rejected callbacks persisted % provider events',n; end if;
  if (select payment_status from public.digital_page_orders where id=target) <> 'PENDING' then
    raise exception 'rejected callbacks changed the order payment state';
  end if;
  -- A valid success event is applied once; an exact replay is idempotent.
  result := public.process_verified_digital_page_payment_backend(
    target,'paymob:s06-success-1','TRANSACTION','SUCCEEDED',true,249.50,'EGP',
    's06-success-1','s06-provider-order','{"suite":"S06","case":"success"}'::jsonb
  );
  if result->>'payment_status' <> 'PAID' then
    raise exception 'success callback did not mark order PAID: %', result;
  end if;

  result := public.process_verified_digital_page_payment_backend(
    target,'paymob:s06-success-1','TRANSACTION','SUCCEEDED',true,249.50,'EGP',
    's06-success-1','s06-provider-order','{"suite":"S06","case":"replay"}'::jsonb
  );
  if result->>'idempotent' <> 'true' then
    raise exception 'duplicate success event was not idempotent: %', result;
  end if;

  -- Reusing the same provider event ID with a different status must be rejected.
  rejected := false;
  begin
    perform public.process_verified_digital_page_payment_backend(
      target,'paymob:s06-success-1','TRANSACTION','FAILED',true,249.50,'EGP',
      's06-success-1','s06-provider-order','{"suite":"S06","case":"status-conflict"}'::jsonb
    );
    raise exception 'TEST_FAILED: conflicting event replay unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'conflicting event replay was not rejected'; end if;

  -- A distinct late failure event is recorded but cannot downgrade a paid order.
  result := public.process_verified_digital_page_payment_backend(
    target,'paymob:s06-late-failure','TRANSACTION','FAILED',true,249.50,'EGP',
    's06-late-failure','s06-provider-order','{"suite":"S06","case":"late-failure"}'::jsonb
  );
  if result->>'already_final' <> 'true' or result->>'payment_status' <> 'PAID' then
    raise exception 'late failure changed final payment state: %', result;
  end if;

  if (select payment_status from public.digital_page_orders where id=target) <> 'PAID' then
    raise exception 'late failure callback downgraded PAID order';
  end if;
  select count(*) into n from public.digital_page_payment_events
    where digital_page_order_id=target;
  if n <> 2 then
    raise exception 'expected 2 unique events (success and late failure; replay ignored), got %', n;
  end if;

end
$test$;

select 'S06 payment-integrity adversarial regressions: PASS' as result;
