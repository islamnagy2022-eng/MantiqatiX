-- RC426 and RC427 behavioral integration. Disposable PostgreSQL 16 only.
\set ON_ERROR_STOP on

do $test$
declare
  user_a uuid := '10000000-0000-4000-8000-000000004261';
  user_b uuid := '10000000-0000-4000-8000-000000004262';
  order_a uuid := '20000000-0000-4000-8000-000000004261';
  order_b uuid := '20000000-0000-4000-8000-000000004262';
  order_c uuid := '20000000-0000-4000-8000-000000004263';
  order_d uuid := '20000000-0000-4000-8000-000000004264';
  ok boolean;
  rejected boolean;
  n integer;
begin
  -- RC426: only authenticated users receive EXECUTE on the new five-argument claim finalizer.
  if not has_function_privilege('authenticated',
      'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE')
     or has_function_privilege('anon',
      'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE') then
    raise exception 'RC426 finalizer ACL contract failed';
  end if;

  insert into public.digital_page_orders(
    id,user_id,payment_status,metadata
  ) values
    (order_a,user_a,'PENDING',jsonb_build_object('payment_intent_claim',jsonb_build_object('token','claim-a'))),
    (order_b,user_a,'PENDING',jsonb_build_object('payment_intent_claim',jsonb_build_object('token','claim-b'))),
    (order_c,user_a,'PENDING',jsonb_build_object('payment_intent_claim',jsonb_build_object('token','claim-c'))),
    (order_d,user_b,'PENDING',jsonb_build_object('payment_intent_claim',jsonb_build_object('token','claim-d')));

  -- Wrong claim token must not finalize or overwrite the order.
  perform set_config('request.jwt.claim.sub',user_a::text,true);
  ok := public.finalize_digital_page_payment_intent_backend(
    order_a,user_a,'wrong-token','paymob-intent-a','paymob-order-a'
  );
  if ok is not false then raise exception 'RC426 accepted a mismatched claim token'; end if;
  if (select provider_intent_id from public.digital_page_orders where id=order_a) is not null then
    raise exception 'RC426 changed provider intent for a mismatched claim';
  end if;

  -- Missing provider correlation must fail closed.
  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(
      order_a,user_a,'claim-a',' ','paymob-order-a'
    );
    raise exception 'TEST_FAILED: RC426 accepted empty provider intent ID';
  exception when others then
    if sqlerrm <> 'PAYMOB_PROVIDER_CORRELATION_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC426 empty correlation denial was not observed'; end if;

  -- A different authenticated user cannot finalize another user's order.
  perform set_config('request.jwt.claim.sub',user_b::text,true);
  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(
      order_a,user_a,'claim-a','paymob-intent-a','paymob-order-a'
    );
    raise exception 'TEST_FAILED: RC426 accepted a different authenticated actor';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC426 actor binding denial was not observed'; end if;

  -- Correct owner + claim token + both provider IDs atomically bind the pending order.
  perform set_config('request.jwt.claim.sub',user_a::text,true);
  ok := public.finalize_digital_page_payment_intent_backend(
    order_a,user_a,'claim-a','paymob-intent-a','paymob-order-a'
  );
  if ok is not true then raise exception 'RC426 valid provider correlation was not finalized'; end if;
  if not exists(
    select 1 from public.digital_page_orders
    where id=order_a and provider='PAYMOB'
      and provider_intent_id='paymob-intent-a'
      and provider_order_id='paymob-order-a'
      and payment_status='PENDING'
      and not (metadata ? 'payment_intent_claim')
  ) then raise exception 'RC426 did not persist the expected provider binding'; end if;

  -- The same claim cannot overwrite a previously correlated order.
  ok := public.finalize_digital_page_payment_intent_backend(
    order_a,user_a,'claim-a','paymob-intent-second','paymob-order-second'
  );
  if ok is not false then raise exception 'RC426 allowed a second provider intent for one order'; end if;

  -- RC427: active states CREATED, PENDING, and SUCCEEDED are unique per order.
  if not exists(
    select 1 from pg_indexes
    where schemaname='public' and indexname='uq_payment_intents_one_active_per_order'
  ) then raise exception 'RC427 partial unique index was not created'; end if;

  insert into public.payment_intents(id,order_id,status) values
    ('30000000-0000-4000-8000-000000004261',order_b,'CREATED');

  rejected := false;
  begin
    insert into public.payment_intents(id,order_id,status) values
      ('30000000-0000-4000-8000-000000004262',order_b,'PENDING');
    raise exception 'TEST_FAILED: RC427 accepted a second active intent';
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'RC427 active-intent duplicate was not rejected'; end if;

  -- Terminal failure frees the order for a new payment attempt.
  update public.payment_intents set status='FAILED'
  where id='30000000-0000-4000-8000-000000004261';
  insert into public.payment_intents(id,order_id,status) values
    ('30000000-0000-4000-8000-000000004263',order_b,'CREATED');

  -- SUCCEEDED remains protected as active/final and cannot be duplicated.
  insert into public.payment_intents(id,order_id,status) values
    ('30000000-0000-4000-8000-000000004264',order_c,'SUCCEEDED');
  rejected := false;
  begin
    insert into public.payment_intents(id,order_id,status) values
      ('30000000-0000-4000-8000-000000004265',order_c,'CREATED');
    raise exception 'TEST_FAILED: RC427 accepted a duplicate after success';
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then raise exception 'RC427 succeeded-intent duplicate was not rejected'; end if;

  -- A terminal failed intent can coexist with a new active intent, but no two active intents can.
  insert into public.payment_intents(id,order_id,status) values
    ('30000000-0000-4000-8000-000000004266',order_d,'FAILED'),
    ('30000000-0000-4000-8000-000000004267',order_d,'PENDING');
  select count(*) into n from public.payment_intents
  where order_id=order_d and upper(status) in ('CREATED','PENDING','SUCCEEDED');
  if n <> 1 then raise exception 'RC427 active intent count invariant failed: %',n; end if;

  raise notice 'RC426–RC427 digital-page binding and single active payment intent: PASS';
end;
$test$;

select 'RC426–RC427 digital-page binding and single active payment intent: PASS' as result;
