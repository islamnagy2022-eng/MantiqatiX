-- RC427 behavioral integration tests. Disposable PostgreSQL only.
do $test$
declare
  rejected boolean := false;
begin
  insert into public.payment_intents(id,order_id,status) values
    ('10000000-0000-4000-8000-000000004271','20000000-0000-4000-8000-000000004271','CREATED'),
    ('10000000-0000-4000-8000-000000004272','20000000-0000-4000-8000-000000004272','FAILED');

  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='uq_payment_intents_one_active_per_order') then
    raise exception 'RC427 partial unique index was not created';
  end if;

  begin
    insert into public.payment_intents(id,order_id,status)
    values('10000000-0000-4000-8000-000000004273','20000000-0000-4000-8000-000000004271','PENDING');
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'second active intent for one order was not rejected'; end if;

  -- Terminal failure does not block a later active attempt for the same order.
  insert into public.payment_intents(id,order_id,status)
  values('10000000-0000-4000-8000-000000004274','20000000-0000-4000-8000-000000004272','PENDING');

  rejected := false;
  begin
    insert into public.payment_intents(id,order_id,status)
    values('10000000-0000-4000-8000-000000004275','20000000-0000-4000-8000-000000004272','SUCCEEDED');
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'SUCCEEDED must remain inside the guarded active-intent set'; end if;
end;
$test$;
select 'RC427 one-active-payment-intent integration: PASS' as result;
