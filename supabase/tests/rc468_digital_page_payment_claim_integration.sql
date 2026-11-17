-- RC468 disposable integration tests. Caller and row fixtures only.
begin;

do $test$
declare
  user_a constant uuid := '46800000-0000-4000-8000-000000000001';
  user_b constant uuid := '46800000-0000-4000-8000-000000000002';
  order_id constant uuid := '46800000-0000-4000-8000-000000000011';
  product_id constant uuid := '46800000-0000-4000-8000-000000000021';
  token_a constant text := '46800000-0000-4000-8000-0000000000aa';
  token_b constant text := '46800000-0000-4000-8000-0000000000bb';
  claim_status text;
  result boolean;
  fn oid;
  cfg text[];
  rejected boolean;
begin
  -- Search path and effective execute contract.
  for fn in select unnest(array[
    'public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)'::regprocedure::oid,
    'public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)'::regprocedure::oid,
    'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)'::regprocedure::oid
  ]) loop
    select proconfig into cfg from pg_catalog.pg_proc where oid=fn;
    if not exists(select 1 from pg_catalog.unnest(coalesce(cfg,array[]::text[])) x where x like 'search_path=%' and regexp_replace(split_part(x,'=',2),'"','','g')='') then
      raise exception 'RC468_EMPTY_SEARCH_PATH_MISSING: %',fn::regprocedure;
    end if;
    if not has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'RC468_AUTH_EXECUTE_MISSING: %',fn::regprocedure;
    end if;
    if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'RC468_UNEXPECTED_EXECUTE: %',fn::regprocedure;
    end if;
    if exists(select 1 from pg_catalog.aclexplode(coalesce((select proacl from pg_catalog.pg_proc where oid=fn),acldefault('f',(select proowner from pg_catalog.pg_proc where oid=fn)))) a where a.grantee=0 and a.privilege_type='EXECUTE') then
      raise exception 'RC468_PUBLIC_EXECUTE_PRESENT: %',fn::regprocedure;
    end if;
  end loop;

  if has_function_privilege('authenticated','public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'RC468_LEGACY_FINALIZER_STILL_EXECUTABLE';
  end if;

  insert into public.digital_page_products(id,page_type,code,name_ar,price)
  values(product_id,'PORTFOLIO','RC468-PORTFOLIO','RC468 test page',25);

  insert into public.digital_page_orders(
    id,user_id,product_id,amount,currency,payment_status,fulfillment_status,pricing_hash,
    provider_intent_id,provider_order_id,title,page_type,idempotency_key,metadata
  ) values (
    order_id,user_a,product_id,25,'EGP','PENDING','REQUESTED','rc468-hash',
    null,null,'RC468 test page','PORTFOLIO','rc468-idem','{}'::jsonb
  );

  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);

  -- Reject null, blank, malformed tokens before claim state can be mutated.
  rejected := false;
  begin
    perform * from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem',null);
    raise exception 'RC468_NULL_TOKEN_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'PAYMENT_CLAIM_TOKEN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_NULL_TOKEN_NOT_REJECTED'; end if;

  rejected := false;
  begin
    perform * from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem','   ');
    raise exception 'RC468_BLANK_TOKEN_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'PAYMENT_CLAIM_TOKEN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_BLANK_TOKEN_NOT_REJECTED'; end if;

  rejected := false;
  begin
    perform * from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem','not-a-uuid');
    raise exception 'RC468_MALFORMED_TOKEN_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'PAYMENT_CLAIM_TOKEN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_MALFORMED_TOKEN_NOT_REJECTED'; end if;

  rejected := false;
  begin
    perform * from public.claim_digital_page_payment_intent_backend(order_id,user_a,null,token_a);
    raise exception 'RC468_NULL_IDEMPOTENCY_KEY_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_NULL_IDEMPOTENCY_KEY_NOT_REJECTED'; end if;

  rejected := false;
  begin
    perform public.release_digital_page_payment_intent_claim_backend(order_id,user_a,null);
    raise exception 'RC468_NULL_RELEASE_TOKEN_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'PAYMENT_CLAIM_TOKEN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_NULL_RELEASE_TOKEN_NOT_REJECTED'; end if;

  select r.claim_status into claim_status
  from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem',token_a) r;
  if claim_status <> 'CLAIMED' then raise exception 'RC468_VALID_CLAIM_FAILED: %',claim_status; end if;

  -- Same-token replay and a competing token both remain blocked while the claim is live.
  select r.claim_status into claim_status
  from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem',token_a) r;
  if claim_status <> 'IN_PROGRESS' then raise exception 'RC468_SAME_TOKEN_REPLAY_NOT_BLOCKED: %',claim_status; end if;

  select r.claim_status into claim_status
  from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem',token_b) r;
  if claim_status <> 'IN_PROGRESS' then raise exception 'RC468_COMPETING_TOKEN_NOT_BLOCKED: %',claim_status; end if;

  -- Another authenticated user cannot claim or release this order.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_b::text,true);
  rejected := false;
  begin
    perform * from public.claim_digital_page_payment_intent_backend(order_id,user_b,'rc468-idem',token_b);
    raise exception 'RC468_CROSS_USER_CLAIM_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_CROSS_USER_CLAIM_NOT_REJECTED'; end if;

  select public.release_digital_page_payment_intent_claim_backend(order_id,user_b,token_a) into result;
  if result is not false then raise exception 'RC468_CROSS_USER_RELEASE_CHANGED_OWNER_CLAIM'; end if;
  if not exists(select 1 from public.digital_page_orders where id=order_id and metadata->'payment_intent_claim'->>'token'=token_a) then
    raise exception 'RC468_CROSS_USER_RELEASE_REMOVED_OWNER_CLAIM';
  end if;

  -- Owner releases and reclaims; finalizer requires a valid provider correlation.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);
  select public.release_digital_page_payment_intent_claim_backend(order_id,user_a,token_a) into result;
  if result is not true then raise exception 'RC468_OWNER_RELEASE_FAILED'; end if;

  select r.claim_status into claim_status
  from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem',token_b) r;
  if claim_status <> 'CLAIMED' then raise exception 'RC468_RECLAIM_FAILED: %',claim_status; end if;

  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(order_id,user_a,null,'paymob-intent-468','paymob-order-468');
    raise exception 'RC468_NULL_FINALIZE_TOKEN_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'PAYMENT_CLAIM_TOKEN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_NULL_FINALIZE_TOKEN_NOT_REJECTED'; end if;

  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(order_id,user_a,token_b,'paymob-intent-468','');
    raise exception 'RC468_EMPTY_PROVIDER_ORDER_ACCEPTED';
  exception when others then
    if sqlerrm <> 'PAYMOB_PROVIDER_CORRELATION_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC468_EMPTY_PROVIDER_ORDER_NOT_REJECTED'; end if;

  select public.finalize_digital_page_payment_intent_backend(order_id,user_a,token_b,'paymob-intent-468','paymob-order-468') into result;
  if result is not true then raise exception 'RC468_FINALIZE_FAILED'; end if;
  if not exists(select 1 from public.digital_page_orders where id=order_id and provider='PAYMOB' and provider_intent_id='paymob-intent-468' and provider_order_id='paymob-order-468' and payment_status='PENDING' and not (metadata ? 'payment_intent_claim')) then
    raise exception 'RC468_PROVIDER_CORRELATION_NOT_PERSISTED';
  end if;

  -- A finalized order cannot be claimed again; it resolves to EXISTING.
  select r.claim_status into claim_status
  from public.claim_digital_page_payment_intent_backend(order_id,user_a,'rc468-idem',token_a) r;
  if claim_status <> 'EXISTING' then raise exception 'RC468_FINALIZED_ORDER_RECLAIMED: %',claim_status; end if;
end;
$test$;

rollback;
select 'RC468 digital-page payment claim hardening integration: PASS' as result;
