-- RC464 wallet idempotency contract. Disposable PostgreSQL only; all data rolls back.
begin;
do $test$
declare
  u uuid := gen_random_uuid();
  order_debit uuid := gen_random_uuid();
  order_refund uuid := gen_random_uuid();
  ok boolean;
  balance_now numeric;
  debit_count integer;
  refund_count integer;
begin
  insert into auth.users(id) values (u);
  insert into public.smm_wallets(user_id, balance) values (u, 100);

  select public.smm_debit_wallet(u, 30, order_debit) into ok;
  if ok is distinct from true then raise exception 'RC464_FAIL: first debit rejected'; end if;
  select public.smm_debit_wallet(u, 30, order_debit) into ok;
  if ok is distinct from true then raise exception 'RC464_FAIL: identical debit retry was not idempotently accepted'; end if;

  select balance into balance_now from public.smm_wallets where user_id = u;
  select count(*) into debit_count from public.smm_wallet_transactions
    where user_id = u and reference_id = order_debit and type = 'DEBIT';
  if balance_now <> 70 or debit_count <> 1 then
    raise exception 'RC464_FAIL: duplicate debit changed balance or duplicated ledger row (balance %, rows %)', balance_now, debit_count;
  end if;

  select public.smm_debit_wallet(u, 31, order_debit) into ok;
  if ok is distinct from false then raise exception 'RC464_FAIL: mismatched debit retry was accepted'; end if;
  select public.smm_debit_wallet(u, 1000, gen_random_uuid()) into ok;
  if ok is distinct from false then raise exception 'RC464_FAIL: insufficient-balance debit was accepted'; end if;
  select public.smm_debit_wallet(u, null, gen_random_uuid()) into ok;
  if ok is distinct from false then raise exception 'RC464_FAIL: NULL debit amount was accepted'; end if;

  select public.smm_refund_wallet(u, 30, order_debit, 'test refund') into ok;
  if ok is distinct from true then raise exception 'RC464_FAIL: matching refund rejected'; end if;
  select public.smm_refund_wallet(u, 30, order_debit, 'test refund retry') into ok;
  if ok is distinct from true then raise exception 'RC464_FAIL: identical refund retry was not idempotently accepted'; end if;

  select balance into balance_now from public.smm_wallets where user_id = u;
  select count(*) into refund_count from public.smm_wallet_transactions
    where user_id = u and reference_id = order_debit and type = 'REFUND';
  if balance_now <> 100 or refund_count <> 1 then
    raise exception 'RC464_FAIL: duplicate refund changed balance or duplicated ledger row (balance %, rows %)', balance_now, refund_count;
  end if;

  select public.smm_refund_wallet(u, 31, order_debit, 'mismatched refund') into ok;
  if ok is distinct from false then raise exception 'RC464_FAIL: mismatched refund amount was accepted'; end if;
  select public.smm_refund_wallet(u, 1, order_refund, 'no debit') into ok;
  if ok is distinct from false then raise exception 'RC464_FAIL: refund without a matching debit was accepted'; end if;
  select public.smm_refund_wallet(u, null, order_debit, 'null amount') into ok;
  if ok is distinct from false then raise exception 'RC464_FAIL: NULL refund amount was accepted'; end if;
end;
$test$;
rollback;
select 'RC464 SMM wallet debit/refund idempotency: PASS' as result;
