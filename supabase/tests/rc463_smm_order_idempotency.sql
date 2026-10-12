-- RC463 idempotency contract. Disposable PostgreSQL only; all test data rolls back.
begin;
do $test$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  p uuid;
  s uuid;
  first_order uuid;
  duplicate_rejected boolean := false;
  malformed_rejected boolean := false;
begin
  insert into auth.users(id) values (u1),(u2);
  insert into public.smm_providers(name,api_url) values ('rc463-test-provider','https://provider.example/api') returning id into p;
  insert into public.smm_services(provider_id,external_service_id,platform,category,name,provider_cost,selling_price,min_quantity,max_quantity)
    values (p,'rc463-test-service','test','test','RC463 test service',1,2,1,100) returning id into s;

  insert into public.smm_orders(user_id,service_id,target_url,quantity,selling_price,status,idempotency_key)
    values (u1,s,'https://target.example/a',10,0.02,'SUBMITTING','rc463-idempotency-key-001')
    returning id into first_order;

  begin
    insert into public.smm_orders(user_id,service_id,target_url,quantity,selling_price,status,idempotency_key)
      values (u1,s,'https://target.example/a',10,0.02,'SUBMITTING','rc463-idempotency-key-001');
  exception when unique_violation then
    duplicate_rejected := true;
  end;
  if not duplicate_rejected then
    raise exception 'RC463_FAIL: same-user duplicate idempotency key was accepted';
  end if;

  -- Idempotency scope is per user, so another user may independently use the same key.
  insert into public.smm_orders(user_id,service_id,target_url,quantity,selling_price,status,idempotency_key)
    values (u2,s,'https://target.example/a',10,0.02,'SUBMITTING','rc463-idempotency-key-001');

  begin
    insert into public.smm_orders(user_id,service_id,target_url,quantity,selling_price,status,idempotency_key)
      values (u1,s,'https://target.example/a',10,0.02,'SUBMITTING','bad');
  exception when check_violation then
    malformed_rejected := true;
  end;
  if not malformed_rejected then
    raise exception 'RC463_FAIL: malformed idempotency key was accepted';
  end if;

  if (select count(*) from public.smm_orders where id=first_order) <> 1 then
    raise exception 'RC463_FAIL: original idempotent order was not preserved';
  end if;
end;
$test$;
rollback;
select 'RC463 SMM order idempotency: PASS' as result;
