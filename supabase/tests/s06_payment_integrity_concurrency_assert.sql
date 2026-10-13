-- Verify two concurrent identical callbacks produce one event and one state transition.
do $test$
declare
  v_status text;
  v_count integer;
  v_event_status text;
begin
  select payment_status into v_status
  from public.digital_page_orders
  where id = '10000000-0000-4000-8000-000000006063';

  select count(*), min(status) into v_count, v_event_status
  from public.digital_page_payment_events
  where external_event_id = 'paymob:s06-concurrent-tx';

  if v_status is distinct from 'PAID' then
    raise exception 'concurrent duplicate callbacks did not settle order once: %', v_status;
  end if;
  if v_count <> 1 or v_event_status is distinct from 'SUCCEEDED' then
    raise exception 'concurrent duplicate callbacks persisted unexpected event count/status: %/%', v_count, v_event_status;
  end if;
end
$test$;

select 'S06 concurrent payment callback idempotency: PASS' as result;
