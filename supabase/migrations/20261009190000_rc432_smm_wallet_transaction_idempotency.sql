-- RC432: make SMM wallet debit/refund ledger entries idempotent by order reference.
-- This migration intentionally fails closed if legacy duplicate DEBIT/REFUND references exist.
do $migration$
begin
  if exists (
    select 1
    from public.smm_wallet_transactions
    where reference_id is not null and type in ('DEBIT','REFUND')
    group by reference_id,type
    having count(*) > 1
  ) then
    raise exception 'RC432 blocked: duplicate SMM wallet transaction references require manual reconciliation';
  end if;
end
$migration$;

create unique index if not exists smm_wallet_transactions_reference_type_uidx
  on public.smm_wallet_transactions(reference_id,type)
  where reference_id is not null and type in ('DEBIT','REFUND');

create or replace function public.smm_debit_wallet(p_user uuid,p_amount numeric,p_reference uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_balance numeric;
  v_txn_id uuid;
  v_existing_user uuid;
  v_existing_amount numeric;
begin
  if p_user is null or p_reference is null then
    raise exception 'INVALID_REFERENCE';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_AMOUNT';
  end if;

  select wt.user_id,wt.amount into v_existing_user,v_existing_amount
  from public.smm_wallet_transactions wt
  where wt.reference_id=p_reference and wt.type='DEBIT'
  limit 1;
  if found then
    if v_existing_user=p_user and v_existing_amount=-p_amount then return true; end if;
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  select w.balance into v_balance
  from public.smm_wallets w
  where w.user_id=p_user
  for update;
  if not found or coalesce(v_balance,0)<p_amount then return false; end if;

  insert into public.smm_wallet_transactions(user_id,amount,type,reference_id,description)
  values(p_user,-p_amount,'DEBIT',p_reference,'SMM order')
  on conflict do nothing
  returning id into v_txn_id;

  if v_txn_id is null then
    select wt.user_id,wt.amount into v_existing_user,v_existing_amount
    from public.smm_wallet_transactions wt
    where wt.reference_id=p_reference and wt.type='DEBIT'
    limit 1;
    if found and v_existing_user=p_user and v_existing_amount=-p_amount then return true; end if;
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  update public.smm_wallets
  set balance=balance-p_amount,updated_at=pg_catalog.now()
  where user_id=p_user;

  return true;
end;
$function$;

create or replace function public.smm_refund_wallet(
  p_user uuid,
  p_amount numeric,
  p_reference uuid,
  p_description text default 'SMM refund'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_txn_id uuid;
  v_existing_user uuid;
  v_existing_amount numeric;
begin
  if p_user is null or p_reference is null then
    raise exception 'INVALID_REFERENCE';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_AMOUNT';
  end if;

  select wt.user_id,wt.amount into v_existing_user,v_existing_amount
  from public.smm_wallet_transactions wt
  where wt.reference_id=p_reference and wt.type='REFUND'
  limit 1;
  if found then
    if v_existing_user=p_user and v_existing_amount=p_amount then return true; end if;
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  insert into public.smm_wallet_transactions(user_id,amount,type,reference_id,description)
  values(p_user,p_amount,'REFUND',p_reference,coalesce(p_description,'SMM refund'))
  on conflict do nothing
  returning id into v_txn_id;

  if v_txn_id is null then
    select wt.user_id,wt.amount into v_existing_user,v_existing_amount
    from public.smm_wallet_transactions wt
    where wt.reference_id=p_reference and wt.type='REFUND'
    limit 1;
    if found and v_existing_user=p_user and v_existing_amount=p_amount then return true; end if;
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  insert into public.smm_wallets(user_id,balance)
  values(p_user,p_amount)
  on conflict(user_id) do update
    set balance=public.smm_wallets.balance+excluded.balance,updated_at=pg_catalog.now();

  return true;
end;
$function$;

revoke all on function public.smm_debit_wallet(uuid,numeric,uuid) from public,anon,authenticated;
revoke all on function public.smm_refund_wallet(uuid,numeric,uuid,text) from public,anon,authenticated;
grant execute on function public.smm_debit_wallet(uuid,numeric,uuid) to service_role;
grant execute on function public.smm_refund_wallet(uuid,numeric,uuid,text) to service_role;

comment on index public.smm_wallet_transactions_reference_type_uidx is
  'RC432: one DEBIT and one REFUND ledger entry per SMM order reference; prevents duplicate balance mutations.';
