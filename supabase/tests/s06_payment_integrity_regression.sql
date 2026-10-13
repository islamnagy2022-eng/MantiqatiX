-- S06 adversarial payment-integrity regressions; disposable PostgreSQL only.
do $test$
declare
  target uuid := '10000000-0000-4000-8000-000000006061';
  rejected boolean;
  n integer;
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

  select count(*) into n from public.digital_page_payment_events
    where digital_page_order_id=target;
  if n <> 0 then raise exception 'rejected callbacks persisted % provider events',n; end if;
  if (select payment_status from public.digital_page_orders where id=target) <> 'PENDING' then
    raise exception 'rejected callbacks changed the order payment state';
  end if;
end
$test$;

select 'S06 payment-integrity adversarial regressions: PASS' as result;
