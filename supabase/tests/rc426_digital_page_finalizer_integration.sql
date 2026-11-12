-- RC426 provider-order finalizer integration; disposable PostgreSQL only.
do $test$
declare
  user_one uuid := '10000000-0000-4000-8000-000000004261';
  user_two uuid := '10000000-0000-4000-8000-000000004262';
  order_one uuid := '10000000-0000-4000-8000-000000004263';
  order_two uuid := '10000000-0000-4000-8000-000000004264';
  finalized boolean;
  rejected boolean;
begin
  if has_function_privilege('anon','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'legacy four-argument finalizer must be revoked from API roles';
  end if;
  if has_function_privilege('anon','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE') then
    raise exception 'new finalizer must not be executable by anon or service_role';
  end if;
  if not has_function_privilege('authenticated','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE') then
    raise exception 'authenticated users must execute the owner-bound finalizer';
  end if;

  insert into public.digital_page_orders(id,user_id,payment_status,metadata)
  values
    (order_one,user_one,'PENDING','{"payment_intent_claim":{"token":"claim-one"}}'::jsonb),
    (order_two,user_two,'PENDING','{"payment_intent_claim":{"token":"claim-two"}}'::jsonb);

  perform set_config('request.jwt.claim.sub',user_one::text,false);
  finalized := public.finalize_digital_page_payment_intent_backend(
    order_one,user_one,'claim-one','intent-one','provider-order-one'
  );
  if finalized is not true then raise exception 'valid owner finalization should succeed'; end if;
  if not exists(
    select 1 from public.digital_page_orders
    where id=order_one and user_id=user_one and provider='PAYMOB'
      and provider_intent_id='intent-one' and provider_order_id='provider-order-one'
      and payment_status='PENDING' and not (metadata ? 'payment_intent_claim')
  ) then
    raise exception 'provider intent/order binding or claim release was not persisted';
  end if;

  -- Wrong caller cannot finalize another user's order.
  perform set_config('request.jwt.claim.sub',user_two::text,false);
  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(
      order_one,user_one,'claim-one','intent-forged','provider-order-forged'
    );
    raise exception 'TEST_FAILED: cross-user finalization unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-user finalization was not rejected'; end if;

  -- A missing provider order is never persisted.
  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(
      order_two,user_two,'claim-two','intent-two','  '
    );
    raise exception 'TEST_FAILED: missing provider order unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'PAYMOB_PROVIDER_CORRELATION_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'missing provider order was not rejected'; end if;

  -- A mismatched claim token cannot consume another active claim.
  finalized := public.finalize_digital_page_payment_intent_backend(
    order_two,user_two,'wrong-claim','intent-two','provider-order-two'
  );
  if finalized is true then raise exception 'mismatched claim token unexpectedly finalized'; end if;
  if exists(
    select 1 from public.digital_page_orders
    where id=order_two and (provider_intent_id is not null or provider_order_id is not null)
  ) then
    raise exception 'mismatched claim token mutated provider correlation';
  end if;
end;
$test$;

select 'RC426 digital-page provider-order finalizer integration: PASS' as result;
