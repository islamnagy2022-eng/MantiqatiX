-- RC459 integration: stage the provider-order-bound finalizer while keeping
-- the currently deployed four-argument caller compatible until Edge Function v6.
do $test$
declare
  user_a constant uuid := '45900000-0000-4000-8000-000000000001';
  user_b constant uuid := '45900000-0000-4000-8000-000000000002';
  order_legacy constant uuid := '45900000-0000-4000-8000-000000000011';
  order_bound constant uuid := '45900000-0000-4000-8000-000000000012';
  function_signature text;
  function_oid oid;
  function_config text[];
  rejected boolean;
  finalized boolean;
  owner_name text;
begin
  -- Both signatures are SECURITY DEFINER, postgres-owned and use an empty search_path.
  foreach function_signature in array array[
    'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)',
    'public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)'
  ]
  loop
    function_oid := function_signature::regprocedure::oid;
    select p.proconfig,r.rolname
      into function_config,owner_name
    from pg_catalog.pg_proc p
    join pg_catalog.pg_roles r on r.oid=p.proowner
    where p.oid=function_oid;

    if owner_name <> 'postgres' then
      raise exception 'RC459_FUNCTION_OWNER_CHANGED: % owner %',function_signature,owner_name;
    end if;
    if not exists (
      select 1
      from pg_catalog.unnest(coalesce(function_config,array[]::text[])) as cfg(setting)
      where cfg.setting like 'search_path=%'
        and pg_catalog.regexp_replace(pg_catalog.split_part(cfg.setting,'=',2),'"','','g')=''
    ) then
      raise exception 'RC459_EMPTY_SEARCH_PATH_NOT_SET: % config %',function_signature,function_config;
    end if;
    if not pg_catalog.has_function_privilege('authenticated',function_oid,'EXECUTE') then
      raise exception 'RC459_AUTHENTICATED_EXECUTE_REMOVED: %',function_signature;
    end if;
    if pg_catalog.has_function_privilege('anon',function_oid,'EXECUTE')
       or pg_catalog.has_function_privilege('service_role',function_oid,'EXECUTE') then
      raise exception 'RC459_UNEXPECTED_CLIENT_OR_SERVICE_GRANT: %',function_signature;
    end if;
    if exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          (select p.proacl from pg_catalog.pg_proc p where p.oid=function_oid),
          pg_catalog.acldefault('f',(select p.proowner from pg_catalog.pg_proc p where p.oid=function_oid))
        )
      ) acl
      where acl.grantee=0 and acl.privilege_type='EXECUTE'
    ) then
      raise exception 'RC459_PUBLIC_EXECUTE_PRESENT: %',function_signature;
    end if;
  end loop;

  insert into public.digital_page_orders(
    id,user_id,provider,amount,currency,provider_order_id,payment_status,
    fulfillment_status,provider_transaction_id,metadata
  ) values
    (
      order_legacy,user_a,'PAYMOB',75,'EGP',null,'PENDING','REQUESTED',null,
      jsonb_build_object('payment_intent_claim',jsonb_build_object('token','legacy-claim'))
    ),
    (
      order_bound,user_a,'PAYMOB',125,'EGP',null,'PENDING','REQUESTED',null,
      jsonb_build_object('payment_intent_claim',jsonb_build_object('token','bound-claim'))
    );

  -- Existing deployed v5 (four arguments) remains compatible during staged cutover.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);
  select public.finalize_digital_page_payment_intent_backend(
    order_legacy,user_a,'legacy-claim','paymob-intent-legacy'
  ) into finalized;
  if finalized is not true then
    raise exception 'RC459_LEGACY_FOUR_ARGUMENT_CALL_BROKEN';
  end if;
  if (select provider_order_id from public.digital_page_orders where id=order_legacy) is not null then
    raise exception 'RC459_LEGACY_CALL_SHOULD_NOT_INVENT_PROVIDER_ORDER_ID';
  end if;

  -- Caller identity cannot be spoofed by supplying another actor ID.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_b::text,true);
  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(
      order_bound,user_a,'bound-claim','paymob-intent-bound','paymob-order-bound'
    );
    raise exception 'RC459_TEST_FAILED_ACTOR_MISMATCH';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_ACTOR_MISMATCH_NOT_REJECTED'; end if;

  -- Missing provider correlation must fail closed and leave the claim intact.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);
  rejected := false;
  begin
    perform public.finalize_digital_page_payment_intent_backend(
      order_bound,user_a,'bound-claim','paymob-intent-bound','  '
    );
    raise exception 'RC459_TEST_FAILED_MISSING_PROVIDER_ORDER';
  exception when others then
    if sqlerrm <> 'PAYMOB_PROVIDER_CORRELATION_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_MISSING_PROVIDER_ORDER_NOT_REJECTED'; end if;
  if not exists (
    select 1 from public.digital_page_orders
    where id=order_bound and metadata->'payment_intent_claim'->>'token'='bound-claim'
  ) then raise exception 'RC459_INVALID_FINALIZE_MUTATED_CLAIM'; end if;

  -- Current main's five-argument caller persists the provider order ID atomically.
  select public.finalize_digital_page_payment_intent_backend(
    order_bound,user_a,'bound-claim','paymob-intent-bound','paymob-order-bound'
  ) into finalized;
  if finalized is not true then raise exception 'RC459_PROVIDER_BOUND_FINALIZE_FAILED'; end if;
  if not exists (
    select 1 from public.digital_page_orders
    where id=order_bound
      and provider='PAYMOB'
      and provider_intent_id='paymob-intent-bound'
      and provider_order_id='paymob-order-bound'
      and payment_status='PENDING'
      and not (metadata ? 'payment_intent_claim')
  ) then
    raise exception 'RC459_PROVIDER_ORDER_BINDING_NOT_PERSISTED';
  end if;

  -- A different authenticated user cannot finalize the same order.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_b::text,true);
  select public.finalize_digital_page_payment_intent_backend(
    order_bound,user_b,'bound-claim','paymob-intent-other','paymob-order-other'
  ) into finalized;
  if finalized is true then raise exception 'RC459_CROSS_USER_FINALIZE_SUCCEEDED'; end if;
  if (select provider_order_id from public.digital_page_orders where id=order_bound) <> 'paymob-order-bound' then
    raise exception 'RC459_CROSS_USER_FINALIZE_CHANGED_PROVIDER_BINDING';
  end if;
end;
$test$;

select 'RC459 digital-page provider-order finalizer integration: PASS' as result;
