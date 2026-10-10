-- RC442 behavior and privilege tests. Run only in disposable PostgreSQL.
do $test$
declare
  admin_id uuid := '20000000-0000-4000-8000-000000000001';
  owner_id uuid := '20000000-0000-4000-8000-000000000002';
  outsider_id uuid := '20000000-0000-4000-8000-000000000003';
  v_business_id uuid := '30000000-0000-4000-8000-000000000001';
  v_business_id2 uuid := '30000000-0000-4000-8000-000000000002';
  result jsonb;
  rejected boolean;
  actions_before integer;
begin
  if has_table_privilege('authenticated','public.approval_actions','INSERT')
     or has_table_privilege('authenticated','public.approval_actions','UPDATE')
     or has_table_privilege('authenticated','public.approval_actions','DELETE') then
    raise exception 'TEST_FAILED: authenticated retains direct write privileges on approval_actions';
  end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='approval_actions' and policyname='approval_actions_member_insert') then
    raise exception 'TEST_FAILED: direct member insert policy still exists';
  end if;
  if has_function_privilege('anon','private.review_business_approval_atomic(uuid,character varying,character varying)','EXECUTE')
     or has_function_privilege('authenticated','private.review_business_approval_atomic(uuid,character varying,character varying)','EXECUTE')
     or not has_function_privilege('service_role','private.review_business_approval_atomic(uuid,character varying,character varying)','EXECUTE') then
    raise exception 'TEST_FAILED: approval RPC execution ACL is incorrect';
  end if;
  if (select coalesce(array_to_string(proconfig,','),'') not like '%search_path=pg_catalog%'
      from pg_proc where oid='private.review_business_approval_atomic(uuid,character varying,character varying)'::regprocedure) then
    raise exception 'TEST_FAILED: approval RPC must pin search_path to pg_catalog';
  end if;

  insert into public.businesses(id,tenant_id,status) values
    (v_business_id,'TENANT-A','PENDING'),
    (v_business_id2,'TENANT-A','PENDING');
  insert into public.user_memberships(id,user_id,tenant_id,role,status)
    values ('MEM-ADMIN',admin_id,'TENANT-A','ADMIN','ACTIVE');
  insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status)
    values ('MEM-CUSTOMER-EXISTING',owner_id,'TENANT-A',v_business_id2,null,'CUSTOMER','ACTIVE');
  insert into public.approval_requests(id,tenant_id,business_id,request_type,entity_type,entity_id,requested_by,status)
    values
      ('APR-APPROVE','TENANT-A',v_business_id,'CREATE','BUSINESS',v_business_id::text,owner_id,'PENDING'),
      ('APR-REJECT','TENANT-A',v_business_id,'CREATE','BUSINESS',v_business_id::text,owner_id,'PENDING'),
      ('APR-OUTSIDER','TENANT-A',v_business_id,'CREATE','BUSINESS',v_business_id::text,owner_id,'PENDING'),
      ('APR-EXISTING-ROLE','TENANT-A',v_business_id2,'CREATE','BUSINESS',v_business_id2::text,owner_id,'PENDING');

  result := private.review_business_approval_atomic(admin_id,'APR-APPROVE','APPROVE');
  if result->>'status' <> 'APPROVED' then raise exception 'TEST_FAILED: approved transition result incorrect'; end if;
  if (select status from public.approval_requests where id='APR-APPROVE') <> 'APPROVED'
     or (select status from public.businesses where id=v_business_id) <> 'ACTIVE'
     or not exists(select 1 from public.user_memberships m where m.user_id=owner_id and m.business_id=v_business_id and m.role='BUSINESS_OWNER' and m.status='ACTIVE') then
    raise exception 'TEST_FAILED: approval state changes were not applied';
  end if;
  if (select count(*) from public.approval_actions where approval_request_id='APR-APPROVE' and action='APPROVE' and acted_by=admin_id) <> 1 then
    raise exception 'TEST_FAILED: successful approval must create exactly one audit row';
  end if;

  result := private.review_business_approval_atomic(admin_id,'APR-REJECT','REJECT');
  if result->>'status' <> 'REJECTED'
     or (select status from public.approval_requests where id='APR-REJECT') <> 'REJECTED'
     or (select count(*) from public.approval_actions where approval_request_id='APR-REJECT' and action='REJECT' and acted_by=admin_id) <> 1 then
    raise exception 'TEST_FAILED: rejection and audit row must be atomic';
  end if;

  select count(*) into actions_before from public.approval_actions where approval_request_id='APR-OUTSIDER';
  rejected := false;
  begin
    perform private.review_business_approval_atomic(outsider_id,'APR-OUTSIDER','APPROVE');
    raise exception 'TEST_FAILED: outsider approval unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'TEST_FAILED: outsider approval unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'forbidden' then raise; end if;
    rejected := true;
  end;
  if not rejected
     or (select status from public.approval_requests where id='APR-OUTSIDER') <> 'PENDING'
     or (select count(*) from public.approval_actions where approval_request_id='APR-OUTSIDER') <> actions_before then
    raise exception 'TEST_FAILED: unauthorized approval changed state or audit history';
  end if;

  rejected := false;
  begin
    perform private.review_business_approval_atomic(admin_id,'APR-APPROVE','REJECT');
    raise exception 'TEST_FAILED: duplicate resolution unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'TEST_FAILED: duplicate resolution unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'approval_already_resolved' then raise; end if;
    rejected := true;
  end;
  if not rejected or (select count(*) from public.approval_actions where approval_request_id='APR-APPROVE') <> 1 then
    raise exception 'TEST_FAILED: duplicate resolution must not create another audit row';
  end if;

  -- An existing non-owner membership must not suppress the required owner membership or allow activation.
  rejected := false;
  begin
    perform private.review_business_approval_atomic(admin_id,'APR-EXISTING-ROLE','APPROVE');
    raise exception 'TEST_FAILED: approval with conflicting requester membership unexpectedly succeeded';
  exception when others then
    if sqlerrm='TEST_FAILED: approval with conflicting requester membership unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'requester_membership_role_conflict' then raise; end if;
    rejected := true;
  end;
  if not rejected
     or (select status from public.approval_requests where id='APR-EXISTING-ROLE') <> 'PENDING'
     or (select status from public.businesses where id=v_business_id2) <> 'PENDING'
     or exists(select 1 from public.approval_actions where approval_request_id='APR-EXISTING-ROLE') then
    raise exception 'TEST_FAILED: conflicting requester membership must fail closed without activation or audit';
  end if;
end;
$test$;

select 'RC442 approval audit atomicity integration: PASS' as result;
