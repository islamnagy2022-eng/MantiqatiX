-- RC426 behavioral integration tests. Disposable PostgreSQL only.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000004261';
  order_ok uuid := '20000000-0000-4000-8000-000000004261';
  order_stale uuid := '20000000-0000-4000-8000-000000004262';
  result boolean;
  rejected boolean;
begin
  if has_function_privilege('anon','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE') then
    raise exception 'anon must not execute RC426 finalizer';
  end if;
  if has_function_privilege('authenticated','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE') is not true then
    raise exception 'authenticated must execute RC426 finalizer';
  end if;
  if has_function_privilege('service_role','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)','EXECUTE') then
    raise exception 'service_role must not inherit direct RC426 finalizer access';
  end if;

  insert into public.digital_page_orders(id,user_id,payment_status,metadata)
  values
    (order_ok,actor,'PENDING',jsonb_build_object('payment_intent_claim',jsonb_build_object('token','claim-ok'))),
    (order_stale,actor,'PENDING',jsonb_build_object('payment_intent_claim',jsonb_build_object('token','claim-current')));

  perform set_config('request.jwt.claim.sub',actor::text,true);
  result := public.finalize_digital_page_payment_intent_backend(order_ok,actor,'claim-ok','intent-ok','order-ok');
  if result is distinct from true then raise exception 'valid provider correlation should finalize'; end if;
  if not exists(select 1 from public.digital_page_orders where id=order_ok and provider='PAYMOB'
    and provider_intent_id='intent-ok' and provider_order_id='order-ok'
    and payment_status='PENDING' and metadata->'payment_intent_claim' is null) then
    raise exception 'successful finalization did not persist correlation and clear claim';
  end if;

  result := public.finalize_digital_page_payment_intent_backend(order_stale,actor,'stale-token','intent-stale','order-stale');
  if result is distinct from false then raise exception 'stale claim token must not finalize'; end if;
  if exists(select 1 from public.digital_page_orders where id=order_stale and provider_intent_id is not null) then
    raise exception 'stale claim unexpectedly changed the order';
  end if;

  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(order_stale,actor,'claim-current','intent-stale','  ');
  exception when others then
    if sqlerrm <> 'PAYMOB_PROVIDER_CORRELATION_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'blank provider order ID must be rejected'; end if;

  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(order_stale,'30000000-0000-4000-8000-000000004261','claim-current','intent-stale','order-stale');
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-user finalization must be rejected'; end if;
end;
$test$;
select 'RC426 digital-page provider-order binding integration: PASS' as result;
