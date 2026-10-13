-- Behavioral integration test for RC432. Run only against a disposable PostgreSQL database.
do $test$
declare
  u uuid := '10000000-0000-4000-8000-000000000001';
  other_u uuid := '10000000-0000-4000-8000-000000000002';
  r uuid := '20000000-0000-4000-8000-000000000001';
  r2 uuid := '20000000-0000-4000-8000-000000000002';
  r3 uuid := '20000000-0000-4000-8000-000000000003';
  b numeric;
  n integer;
  conflict_seen boolean;
begin
  insert into public.smm_wallets(user_id,balance) values(u,100),(other_u,50);

  if public.smm_debit_wallet(u,30,r) is distinct from true then
    raise exception 'first debit should succeed';
  end if;
  if public.smm_debit_wallet(u,30,r) is distinct from true then
    raise exception 'same debit retry should be idempotent';
  end if;
  select balance into b from public.smm_wallets where user_id=u;
  if b <> 70 then raise exception 'duplicate debit changed balance: %',b; end if;
  select count(*) into n from public.smm_wallet_transactions where reference_id=r and type='DEBIT';
  if n <> 1 then raise exception 'expected one debit ledger entry, got %',n; end if;

  conflict_seen := false;
  begin
    perform public.smm_debit_wallet(u,20,r);
  exception when others then
    if sqlerrm='IDEMPOTENCY_CONFLICT' then conflict_seen := true; else raise; end if;
  end;
  if not conflict_seen then raise exception 'debit amount mismatch was not rejected'; end if;

  if public.smm_debit_wallet(u,80,r2) is distinct from false then
    raise exception 'insufficient balance should return false';
  end if;
  select balance into b from public.smm_wallets where user_id=u;
  if b <> 70 then raise exception 'insufficient debit changed balance: %',b; end if;

  if public.smm_refund_wallet(u,30,r,'integration refund') is distinct from true then
    raise exception 'first refund should succeed';
  end if;
  if public.smm_refund_wallet(u,30,r,'integration refund retry') is distinct from true then
    raise exception 'same refund retry should be idempotent';
  end if;
  select balance into b from public.smm_wallets where user_id=u;
  if b <> 100 then raise exception 'duplicate refund changed balance: %',b; end if;
  select count(*) into n from public.smm_wallet_transactions where reference_id=r and type='REFUND';
  if n <> 1 then raise exception 'expected one refund ledger entry, got %',n; end if;

  conflict_seen := false;
  begin
    perform public.smm_refund_wallet(other_u,30,r,'mismatched refund');
  exception when others then
    if sqlerrm='IDEMPOTENCY_CONFLICT' then conflict_seen := true; else raise; end if;
  end;
  if not conflict_seen then raise exception 'cross-user refund conflict was not rejected'; end if;
  select balance into b from public.smm_wallets where user_id=other_u;
  if b <> 50 then raise exception 'cross-user conflict changed other wallet: %',b; end if;

  insert into public.smm_admins(user_id) values(u);
  if public.smm_admin_credit_wallet(u,other_u,20,'integration credit',r2) is distinct from true then
    raise exception 'first admin credit should succeed';
  end if;
  if public.smm_admin_credit_wallet(u,other_u,20,'integration credit retry',r2) is distinct from true then
    raise exception 'same admin credit retry should be idempotent';
  end if;
  select balance into b from public.smm_wallets where user_id=other_u;
  if b <> 70 then raise exception 'duplicate admin credit changed balance: %',b; end if;
  select count(*) into n from public.smm_wallet_transactions where reference_id=r2 and type='CREDIT';
  if n <> 1 then raise exception 'expected one admin credit ledger entry, got %',n; end if;

  conflict_seen := false;
  begin
    perform public.smm_admin_credit_wallet(u,other_u,10,'mismatched credit',r2);
  exception when others then
    if sqlerrm='IDEMPOTENCY_CONFLICT' then conflict_seen := true; else raise; end if;
  end;
  if not conflict_seen then raise exception 'admin credit amount mismatch was not rejected'; end if;

  conflict_seen := false;
  begin
    perform public.smm_admin_credit_wallet(other_u,u,10,'unauthorized credit',r3);
  exception when others then
    if sqlerrm='NOT_AUTHORIZED' then conflict_seen := true; else raise; end if;
  end;
  if not conflict_seen then raise exception 'non-admin credit was not rejected'; end if;

  if not has_function_privilege('service_role','public.smm_admin_credit_wallet(uuid,uuid,numeric,text)','EXECUTE') then
    raise exception 'legacy RPC must remain available during staged Edge Function rollout';
  end if;
  if not has_function_privilege('service_role','public.smm_admin_credit_wallet(uuid,uuid,numeric,text,uuid)','EXECUTE') then
    raise exception 'service_role must execute idempotent admin credit RPC';
  end if;
  if has_function_privilege('anon','public.smm_debit_wallet(uuid,numeric,uuid)','EXECUTE') then
    raise exception 'anon must not execute smm_debit_wallet';
  end if;
  if has_function_privilege('authenticated','public.smm_debit_wallet(uuid,numeric,uuid)','EXECUTE') then
    raise exception 'authenticated must not execute smm_debit_wallet';
  end if;
  if not has_function_privilege('service_role','public.smm_debit_wallet(uuid,numeric,uuid)','EXECUTE') then
    raise exception 'service_role must execute smm_debit_wallet';
  end if;
  if has_function_privilege('anon','public.smm_refund_wallet(uuid,numeric,uuid,text)','EXECUTE') then
    raise exception 'anon must not execute smm_refund_wallet';
  end if;
  if has_function_privilege('authenticated','public.smm_refund_wallet(uuid,numeric,uuid,text)','EXECUTE') then
    raise exception 'authenticated must not execute smm_refund_wallet';
  end if;
  if not has_function_privilege('service_role','public.smm_refund_wallet(uuid,numeric,uuid,text)','EXECUTE') then
    raise exception 'service_role must execute smm_refund_wallet';
  end if;
end;
$test$;

select 'RC432 SMM wallet idempotency integration: PASS' as result;
