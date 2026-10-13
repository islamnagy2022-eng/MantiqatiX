-- Exactly one conflicting callback may win; the other must be rejected without overwriting it.
do $test$
declare
  v_payment text;
  v_event_status text;
  v_count integer;
begin
  select payment_status into v_payment
  from public.digital_page_orders
  where id = '10000000-0000-4000-8000-000000006064';

  select count(*), min(status) into v_count, v_event_status
  from public.digital_page_payment_events
  where external_event_id = 'paymob:s06-conflicting-race';

  if v_count <> 1 then
    raise exception 'conflicting concurrent callbacks persisted % events, expected exactly 1', v_count;
  end if;
  if not (
    (v_payment = 'PAID' and v_event_status = 'SUCCEEDED')
    or (v_payment = 'FAILED' and v_event_status = 'FAILED')
  ) then
    raise exception 'order/event state mismatch after conflicting callback race: order %, event %', v_payment, v_event_status;
  end if;
end
$test$;

select 'S06 conflicting callback race: PASS' as result;
