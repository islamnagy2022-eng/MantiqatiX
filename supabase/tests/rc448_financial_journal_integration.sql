-- RC448 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000564';
  other_actor uuid := '10000000-0000-4000-8000-000000000565';
  same_tenant_other_business_actor uuid := '10000000-0000-4000-8000-000000000566';
  branch_actor uuid := '10000000-0000-4000-8000-000000000567';
  business uuid := '20000000-0000-4000-8000-000000000564';
  other_business uuid := '20000000-0000-4000-8000-000000000566';
  other_tenant_business uuid := '20000000-0000-4000-8000-000000000565';
  entry jsonb;
  lines jsonb;
  result jsonb;
  rejected boolean;
  n integer;
begin
  if has_function_privilege('authenticated','public.post_financial_journal_backend(uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'authenticated role must not execute the backend journal RPC directly';
  end if;
  if has_function_privilege('anon','public.post_financial_journal_backend(uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'anon role must not execute the backend journal RPC';
  end if;
  if has_function_privilege('service_role','public.post_financial_journal_backend(uuid,jsonb,jsonb)','EXECUTE') is not true then
    raise exception 'service_role must be able to execute the backend journal RPC';
  end if;

  insert into public.user_memberships(user_id,tenant_id,organization_id,business_id,branch_id,role,status)
  values (actor,'tenant-a','org-a',business,null,'ACCOUNTANT','ACTIVE'),
         (other_actor,'tenant-b','org-b',other_tenant_business,null,'ACCOUNTANT','ACTIVE'),
         (same_tenant_other_business_actor,'tenant-a','org-a',other_business,null,'ACCOUNTANT','ACTIVE'),
         (branch_actor,'tenant-a','org-a',business,'branch-a','ACCOUNTANT','ACTIVE');
  insert into public.chart_of_accounts(id,tenant_id,is_active)
  values ('cash','tenant-a',true),('revenue','tenant-a',true),('inactive','tenant-a',false);

  entry := jsonb_build_object(
    'id','rc448-journal-001','tenant_id','tenant-a','business_id',business,
    'entry_number','RC448-001','reference_type','MANUAL','description','isolated test',
    'status','POSTED','total_debit',100,'total_credit',100
  );
  lines := jsonb_build_array(
    jsonb_build_object('account_id','cash','debit',100,'credit',0),
    jsonb_build_object('account_id','revenue','debit',0,'credit',100)
  );

  -- The trusted service role can post for the actor after DB-side membership validation.
  perform set_config('request.jwt.claim.role','service_role',false);
  perform set_config('request.jwt.claim.sub','',false);
  result := public.post_financial_journal_backend(actor,entry,lines);
  if result->>'status' <> 'POSTED' or (result->>'line_count')::int <> 2 then
    raise exception 'authorized journal posting returned unexpected result';
  end if;
  select count(*) into n from public.journal_entry_lines where journal_entry_id='rc448-journal-001';
  if n <> 2 then raise exception 'expected exactly two journal lines, got %',n; end if;
  if not exists(select 1 from public.journal_entries where id='rc448-journal-001' and organization_id='org-a') then
    raise exception 'business organization must be derived when omitted from the request';
  end if;
  select count(*) into n from public.general_ledger where journal_entry_id='rc448-journal-001';
  if n <> 2 then raise exception 'expected exactly two ledger rows, got %',n; end if;

  -- A client-supplied organization cannot contradict the target business.
  rejected := false;
  begin
    perform public.post_financial_journal_backend(actor,
      jsonb_set(jsonb_set(entry,'{id}','"rc448-journal-org-scope-001"'),'{organization_id}','"org-b"'),lines);
    raise exception 'TEST_FAILED: organization mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'BUSINESS_ORGANIZATION_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'organization mismatch was not rejected'; end if;

  -- A membership for another business in the same tenant must not post to this business.
  rejected := false;
  begin
    perform public.post_financial_journal_backend(same_tenant_other_business_actor,
      jsonb_set(entry,'{id}','"rc448-journal-business-scope-001"'),lines);
    raise exception 'TEST_FAILED: same-tenant cross-business actor unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'FINANCIAL_MEMBERSHIP_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'same-tenant cross-business actor was not rejected'; end if;

  -- A branch-scoped membership cannot post against another branch, even within its business.
  rejected := false;
  begin
    perform public.post_financial_journal_backend(branch_actor,
      jsonb_set(jsonb_set(entry,'{id}','"rc448-journal-branch-scope-001"'),'{branch_id}','"branch-b"'),lines);
    raise exception 'TEST_FAILED: branch-scoped actor unexpectedly posted to another branch';
  exception when others then
    if sqlerrm <> 'FINANCIAL_MEMBERSHIP_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'branch-scoped actor was not rejected'; end if;

  -- Replayed journal IDs fail closed and must not append duplicate lines.
  rejected := false;
  begin
    perform public.post_financial_journal_backend(actor,entry,lines);
    raise exception 'TEST_FAILED: duplicate journal ID unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'JOURNAL_ID_ALREADY_EXISTS' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'duplicate journal ID was not rejected'; end if;
  select count(*) into n from public.journal_entry_lines where journal_entry_id='rc448-journal-001';
  if n <> 2 then raise exception 'duplicate replay changed existing journal lines'; end if;

  -- A service-role call cannot post for an actor lacking membership in the requested tenant.
  rejected := false;
  begin
    perform public.post_financial_journal_backend(other_actor,entry,jsonb_build_array(
      jsonb_build_object('account_id','cash','debit',100,'credit',0),
      jsonb_build_object('account_id','revenue','debit',0,'credit',100)
    ));
    raise exception 'TEST_FAILED: cross-tenant actor unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'FINANCIAL_MEMBERSHIP_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-tenant actor was not rejected'; end if;

  -- Non-service callers cannot supply another user's actor ID.
  perform set_config('request.jwt.claim.role','authenticated',false);
  perform set_config('request.jwt.claim.sub',other_actor::text,false);
  rejected := false;
  begin
    perform public.post_financial_journal_backend(actor,
      jsonb_set(entry,'{id}','"rc448-journal-002"'),
      jsonb_build_array(
        jsonb_build_object('account_id','cash','debit',100,'credit',0),
        jsonb_build_object('account_id','revenue','debit',0,'credit',100)
      ));
    raise exception 'TEST_FAILED: actor mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'USER_CONTEXT_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'actor mismatch was not rejected'; end if;

  -- A balanced header cannot hide unbalanced detail lines.
  perform set_config('request.jwt.claim.role','service_role',false);
  perform set_config('request.jwt.claim.sub','',false);
  rejected := false;
  begin
    perform public.post_financial_journal_backend(actor,
      jsonb_set(entry,'{id}','"rc448-journal-003"'),
      jsonb_build_array(
        jsonb_build_object('account_id','cash','debit',100,'credit',0),
        jsonb_build_object('account_id','revenue','debit',0,'credit',90)
      ));
    raise exception 'TEST_FAILED: unbalanced detail lines unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'JOURNAL_LINE_TOTAL_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'unbalanced detail lines were not rejected'; end if;

  -- Inactive accounts are never accepted for posting.
  rejected := false;
  begin
    perform public.post_financial_journal_backend(actor,
      jsonb_set(entry,'{id}','"rc448-journal-004"'),
      jsonb_build_array(
        jsonb_build_object('account_id','inactive','debit',100,'credit',0),
        jsonb_build_object('account_id','revenue','debit',0,'credit',100)
      ));
    raise exception 'TEST_FAILED: inactive account unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'ACCOUNT_NOT_ACTIVE_FOR_TENANT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'inactive account was not rejected'; end if;
end
$test$;

do $balance_test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000564';
  entry jsonb;
  lines jsonb;
  v_cash numeric;
  v_revenue numeric;
  v_cash_steps numeric[];
begin
  perform set_config('request.jwt.claim.role','service_role',false);
  perform set_config('request.jwt.claim.sub','',false);
  entry := jsonb_build_object('id','rc448-journal-002','tenant_id','tenant-a','business_id','20000000-0000-4000-8000-000000000564','entry_number','RC448-002','status','POSTED','total_debit',50,'total_credit',50);
  lines := jsonb_build_array(
    jsonb_build_object('account_id','cash','debit',30,'credit',0),
    jsonb_build_object('account_id','cash','debit',20,'credit',0),
    jsonb_build_object('account_id','revenue','debit',0,'credit',50)
  );
  perform public.post_financial_journal_backend(actor,entry,lines);
  select running_balance into v_cash from public.general_ledger where tenant_id='tenant-a' and account_id='cash' order by posted_at desc,id desc limit 1;
  select array_agg(gl.running_balance order by jel.line_number) into v_cash_steps
  from public.general_ledger gl
  join public.journal_entry_lines jel on jel.id=gl.journal_line_id
  where gl.journal_entry_id='rc448-journal-002' and gl.account_id='cash';
  select running_balance into v_revenue from public.general_ledger where tenant_id='tenant-a' and account_id='revenue' order by posted_at desc,id desc limit 1;
  if v_cash_steps is distinct from array[130::numeric,150::numeric] then
    raise exception 'TEST_FAILED: repeated-account lines did not accumulate in line order: %',v_cash_steps;
  end if;
  if v_cash <> 150 or v_revenue <> -150 then
    raise exception 'TEST_FAILED: running balances are not cumulative (cash %, revenue %)',v_cash,v_revenue;
  end if;
end;
$balance_test$;

select 'RC448 financial journal integration: PASS' as result;
