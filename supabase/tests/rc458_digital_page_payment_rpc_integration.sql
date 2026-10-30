-- RC458 regression suite. Disposable PostgreSQL only.
create temporary table digital_page_orders (
  id uuid primary key,
  user_id uuid not null
);
insert into pg_temp.digital_page_orders(id,user_id)
values ('45800000-0000-4000-8000-000000000001','45800000-0000-4000-8000-000000000002');

do $test$
declare
  user_a constant uuid := '45800000-0000-4000-8000-000000000001';
  user_b constant uuid := '45800000-0000-4000-8000-000000000002';
  order_claim constant uuid := '45800000-0000-4000-8000-000000000011';
  order_publish constant uuid := '45800000-0000-4000-8000-000000000012';
  page_id constant uuid := '45800000-0000-4000-8000-000000000021';
  claim_status text;
  released boolean;
  result jsonb;
  function_signature text;
  function_oid oid;
  function_config text[];
  rejected boolean;
  n integer;
begin
  -- RC458 is a configuration-only migration: preserve function owner and EXECUTE ACL.
  for function_signature in
    select unnest(array[
      'public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)',
      'public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)',
      'public.fulfill_digital_page_publish(uuid,uuid,uuid)'
    ])
  loop
    function_oid := function_signature::regprocedure::oid;
    select p.proconfig into function_config
    from pg_catalog.pg_proc p where p.oid=function_oid;

    if not exists (
      select 1
      from pg_catalog.unnest(coalesce(function_config,array[]::text[])) as cfg(setting)
      where cfg.setting like 'search_path=%'
        and pg_catalog.regexp_replace(pg_catalog.split_part(cfg.setting,'=',2),'"','','g')=''
    ) then
      raise exception 'RC458_EMPTY_SEARCH_PATH_NOT_SET: % config %',function_signature,function_config;
    end if;

    if not pg_catalog.has_function_privilege('authenticated',function_oid,'EXECUTE') then
      raise exception 'RC458_AUTHENTICATED_EXECUTE_REMOVED: %',function_signature;
    end if;
    if pg_catalog.has_function_privilege('anon',function_oid,'EXECUTE') then
      raise exception 'RC458_ANON_EXECUTE_GRANTED: %',function_signature;
    end if;
    if pg_catalog.has_function_privilege('service_role',function_oid,'EXECUTE') then
      raise exception 'RC458_SERVICE_ROLE_EXECUTE_UNEXPECTED: %',function_signature;
    end if;
    if exists (
      select 1 from pg_catalog.aclexplode(
        coalesce((select p.proacl from pg_catalog.pg_proc p where p.oid=function_oid), acldefault('f',(select p.proowner from pg_catalog.pg_proc p where p.oid=function_oid)))
      ) acl
      where acl.grantee=0 and acl.privilege_type='EXECUTE'
    ) then
      raise exception 'RC458_PUBLIC_EXECUTE_PRESENT: %',function_signature;
    end if;
  end loop;

  -- The claim function must keep its direct auth.uid() and order-owner checks.
  if pg_catalog.pg_get_functiondef('public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)'::regprocedure)
     not ilike '%auth.uid()%' then
    raise exception 'RC458_CLAIM_CALLER_BINDING_MISSING';
  end if;
  if pg_catalog.pg_get_functiondef('public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)'::regprocedure)
     not ilike '%v_order.user_id <> p_user_id%' then
    raise exception 'RC458_CLAIM_ORDER_OWNER_CHECK_MISSING';
  end if;

  -- The publication function must retain the explicit actor and platform-admin checks.
  if pg_catalog.pg_get_functiondef('public.fulfill_digital_page_publish(uuid,uuid,uuid)'::regprocedure)
     not ilike '%p_actor_user_id <> auth.uid()%' then
    raise exception 'RC458_PUBLISH_ACTOR_BINDING_MISSING';
  end if;
  if pg_catalog.pg_get_functiondef('public.fulfill_digital_page_publish(uuid,uuid,uuid)'::regprocedure)
     not ilike '%public.mnty_can_platform_admin()%' then
    raise exception 'RC458_PLATFORM_ADMIN_CHECK_MISSING';
  end if;

  insert into public.digital_page_orders(
    id,user_id,amount,currency,payment_status,fulfillment_status,pricing_hash,
    provider_intent_id,title,page_type,idempotency_key,metadata
  ) values (
    order_claim,user_a,10,'EGP','PENDING','REQUESTED','test-hash',null,
    'Test page','LANDING','rc458-idempotency','{}'::jsonb
  );

  -- A same-named pg_temp table must not shadow the public order table.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);
  select result_row.claim_status into claim_status
  from public.claim_digital_page_payment_intent_backend(
    order_claim,user_a,'rc458-idempotency','claim-a'
  ) result_row;
  if claim_status <> 'CLAIMED' then
    raise exception 'RC458_TEMP_SHADOW_OR_CLAIM_FAILURE: %',claim_status;
  end if;
  if (select user_id from public.digital_page_orders where id=order_claim) <> user_a then
    raise exception 'RC458_PUBLIC_ORDER_FIXTURE_CORRUPTED';
  end if;

  -- A different authenticated identity cannot claim another user's order.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_b::text,true);
  rejected := false;
  begin
    perform * from public.claim_digital_page_payment_intent_backend(
      order_claim,user_b,'rc458-idempotency','claim-b'
    );
    raise exception 'RC458_TEST_FAILED_CROSS_USER_CLAIM';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC458_CROSS_USER_CLAIM_NOT_REJECTED'; end if;

  -- A different user cannot release the owner's active claim.
  select public.release_digital_page_payment_intent_claim_backend(
    order_claim,user_b,'claim-a'
  ) into released;
  if released is true then raise exception 'RC458_CROSS_USER_RELEASE_SUCCEEDED'; end if;
  if not exists (
    select 1 from public.digital_page_orders
    where id=order_claim and metadata->'payment_intent_claim'->>'token'='claim-a'
  ) then
    raise exception 'RC458_CROSS_USER_RELEASE_REMOVED_OWNER_CLAIM';
  end if;

  -- The owner can release their own claim.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);
  select public.release_digital_page_payment_intent_claim_backend(
    order_claim,user_a,'claim-a'
  ) into released;
  if released is not true then raise exception 'RC458_OWNER_RELEASE_FAILED'; end if;
  if exists (
    select 1 from public.digital_page_orders
    where id=order_claim and metadata ? 'payment_intent_claim'
  ) then raise exception 'RC458_OWNER_RELEASE_LEFT_CLAIM'; end if;

  -- Wrong actor ID is rejected before platform-admin authorization.
  insert into public.digital_page_orders(
    id,user_id,amount,currency,payment_status,fulfillment_status,pricing_hash,
    provider_intent_id,title,page_type,idempotency_key,metadata
  ) values (
    order_publish,user_a,20,'EGP','PAID','IN_REVIEW','test-hash',null,
    'Publish test','LANDING','publish-idempotency','{}'::jsonb
  );
  insert into public.digital_pages(
    id,created_by,page_type,business_id,digital_page_order_id,status,version
  ) values (
    page_id,user_a,'LANDING',null,null,'DRAFT',1
  );

  perform pg_catalog.set_config('request.jwt.claim.sub',user_b::text,true);
  perform pg_catalog.set_config('mantiqatix_test.is_platform_admin','true',true);
  rejected := false;
  begin
    perform public.fulfill_digital_page_publish(user_a,order_publish,page_id);
    raise exception 'RC458_TEST_FAILED_ACTOR_MISMATCH';
  exception when others then
    if sqlerrm <> 'USER_CONTEXT_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC458_ACTOR_MISMATCH_NOT_REJECTED'; end if;

  -- Correct actor without platform-admin authority is rejected.
  perform pg_catalog.set_config('request.jwt.claim.sub',user_a::text,true);
  perform pg_catalog.set_config('mantiqatix_test.is_platform_admin','false',true);
  rejected := false;
  begin
    perform public.fulfill_digital_page_publish(user_a,order_publish,page_id);
    raise exception 'RC458_TEST_FAILED_NON_ADMIN_PUBLISH';
  exception when others then
    if sqlerrm <> 'PLATFORM_ADMIN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC458_NON_ADMIN_PUBLISH_NOT_REJECTED'; end if;
  if (select status from public.digital_pages where id=page_id) <> 'DRAFT' then
    raise exception 'RC458_NON_ADMIN_CHANGED_PAGE';
  end if;

  -- Authorized platform admin publishes exactly once; retries are idempotent.
  perform pg_catalog.set_config('mantiqatix_test.is_platform_admin','true',true);
  result := public.fulfill_digital_page_publish(user_a,order_publish,page_id);
  if result->>'status' <> 'PUBLISHED' or result->>'replayed' <> 'false' then
    raise exception 'RC458_PUBLISH_RESULT_UNEXPECTED: %',result;
  end if;
  if (select status from public.digital_pages where id=page_id) <> 'PUBLISHED'
     or (select fulfillment_status from public.digital_page_orders where id=order_publish) <> 'PUBLISHED' then
    raise exception 'RC458_PUBLISH_STATE_NOT_ATOMIC';
  end if;

  result := public.fulfill_digital_page_publish(user_a,order_publish,page_id);
  if result->>'status' <> 'PUBLISHED' or result->>'replayed' <> 'true' then
    raise exception 'RC458_PUBLISH_REPLAY_NOT_IDEMPOTENT: %',result;
  end if;
  select count(*) into n from public.audit_logs
  where action='DIGITAL_PAGE_PUBLISHED' and entity_id=order_publish::text;
  if n <> 1 then raise exception 'RC458_PUBLISH_AUDIT_COUNT_INVALID: %',n; end if;
end;
$test$;

select 'RC458 digital-page payment claim / publication search_path integration: PASS' as result;
