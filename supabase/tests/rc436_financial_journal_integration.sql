-- Behavioral tests for RC436. Run only in a disposable PostgreSQL database.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  other_actor uuid := '10000000-0000-4000-8000-000000000002';
  business uuid := '20000000-0000-4000-8000-000000000001';
  entry jsonb;
  lines jsonb;
  result jsonb;
  n integer;
  rejected boolean;
begin
  insert into public.user_memberships(id,user_id,tenant_id,business_id,role,status)
  values('membership-1',actor,'tenant-a',business,'ACCOUNTANT','ACTIVE');
  insert into public.chart_of_accounts(id,tenant_id,is_active)
  values('acct-cash','tenant-a',true),('acct-revenue','tenant-a',true);

  entry:=pg_catalog.jsonb_build_object(
    'id','journal-0001','tenant_id','tenant-a','organization_id','org-a','business_id',business,
    'branch_id','branch-a','entry_number','JE-0001','reference_type','MANUAL','reference_id','ref-0001',
    'description','Integration journal','status','POSTED','entry_date','2026-10-09','total_debit',100,'total_credit',100
  );
  lines:=pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('account_id','acct-cash','debit',100,'credit',0,'description','cash'),
    pg_catalog.jsonb_build_object('account_id','acct-revenue','debit',0,'credit',100,'description','revenue')
  );

  result:=public.post_financial_journal_atomic_backend(actor,entry,lines);
  if (result->>'idempotent')::boolean is distinct from false then raise exception 'first journal should be a new posting'; end if;
  select count(*) into n from public.journal_entry_lines where journal_entry_id='journal-0001';
  if n<>2 then raise exception 'expected two journal lines, got %',n; end if;
  select count(*) into n from public.general_ledger where journal_entry_id='journal-0001';
  if n<>2 then raise exception 'expected two ledger rows, got %',n; end if;
  if (select total_debit from public.journal_entries where id='journal-0001')<>100 then raise exception 'header debit total not stored'; end if;
  if (select count(distinct line_number) from public.journal_entry_lines where journal_entry_id='journal-0001')<>2 then raise exception 'line numbers must be unique'; end if;

  result:=public.post_financial_journal_atomic_backend(actor,entry,lines);
  if (result->>'idempotent')::boolean is distinct from true then raise exception 'same journal retry must be idempotent'; end if;
  select count(*) into n from public.journal_entry_lines where journal_entry_id='journal-0001';
  if n<>2 then raise exception 'idempotent retry duplicated journal lines'; end if;
  select count(*) into n from public.general_ledger where journal_entry_id='journal-0001';
  if n<>2 then raise exception 'idempotent retry duplicated ledger rows'; end if;

  rejected:=false;
  begin
    perform public.post_financial_journal_atomic_backend(other_actor,entry,lines);
  exception when others then
    if sqlerrm='FINANCIAL_MEMBERSHIP_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'actor without finance membership was not rejected'; end if;

  rejected:=false;
  begin
    perform public.post_financial_journal_atomic_backend(actor,
      entry||pg_catalog.jsonb_build_object('total_credit',90),
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('account_id','acct-cash','debit',100,'credit',0),
        pg_catalog.jsonb_build_object('account_id','acct-revenue','debit',0,'credit',90)
      ));
  exception when others then
    if sqlerrm='UNBALANCED_JOURNAL' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'unbalanced journal was not rejected'; end if;

  rejected:=false;
  begin
    perform public.post_financial_journal_atomic_backend(actor,
      pg_catalog.jsonb_build_object('id','journal-rollback','tenant_id','tenant-a','business_id',business,'entry_number','JE-ROLLBACK','description','rollback','status','POSTED','total_debit',7,'total_credit',7),
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('account_id','acct-cash','debit',7,'credit',0),
        pg_catalog.jsonb_build_object('account_id','acct-revenue','debit',0,'credit',7)
      ));
  exception when others then
    if sqlerrm='RC436_FORCED_LEDGER_FAILURE' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'forced ledger failure did not abort posting'; end if;
  if exists(select 1 from public.journal_entries where id='journal-rollback')
     or exists(select 1 from public.journal_entry_lines where journal_entry_id='journal-rollback')
     or exists(select 1 from public.general_ledger where journal_entry_id='journal-rollback') then
    raise exception 'failed ledger insert left a partial journal';
  end if;

  rejected:=false;
  begin
    perform public.post_financial_journal_atomic_backend(actor,
      pg_catalog.jsonb_build_object('id','journal-0002','tenant_id','tenant-a','business_id',business,'entry_number','JE-0001','description','duplicate entry number','status','POSTED','total_debit',1,'total_credit',1),
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('account_id','acct-cash','debit',1,'credit',0),
        pg_catalog.jsonb_build_object('account_id','acct-revenue','debit',0,'credit',1)
      ));
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'duplicate tenant entry number was not rejected'; end if;

  if has_function_privilege('anon','public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'anon must not execute RC436 journal RPC';
  end if;
  if has_function_privilege('authenticated','public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'authenticated must not execute service-role RC436 journal RPC';
  end if;
  if not has_function_privilege('service_role','public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'service_role must execute RC436 journal RPC';
  end if;
end;
$test$;

select 'RC436 financial journal integration: PASS' as result;
