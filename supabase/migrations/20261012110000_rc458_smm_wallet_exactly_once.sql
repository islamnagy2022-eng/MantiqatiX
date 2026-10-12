-- RC458: make SMM wallet debit/refund RPCs idempotent per order reference.
-- Source-only. Do not apply until the complete production migration lineage is reconciled.
begin;

create unique index if not exists smm_wallet_transactions_debit_reference_uidx
  on public.smm_wallet_transactions (user_id, reference_id)
  where reference_id is not null and type = 'DEBIT';

create unique index if not exists smm_wallet_transactions_refund_reference_uidx
  on public.smm_wallet_transactions (user_id, reference_id)
  where reference_id is not null and type = 'REFUND';

create or replace function public.smm_debit_wallet(
  p_user uuid,
  p_amount numeric,
  p_reference uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_balance numeric;
  v_existing_amount numeric;
begin
  if p_user is null or p_reference is null or p_amount is null or p_amount <= 0 then
    return false;
  end if;

  -- Serialize all ledger mutations for this wallet before checking the reference.
  select w.balance into v_balance
  from public.smm_wallets as w
  where w.user_id = p_user
  for update;

  if not found then
    return false;
  end if;

  select t.amount into v_existing_amount
  from public.smm_wallet_transactions as t
  where t.user_id = p_user and t.reference_id = p_reference and t.type = 'DEBIT';

  if found then
    -- A retry of the same operation is a success only when the amount matches.
    return v_existing_amount = p_amount;
  end if;

  if v_balance < p_amount then
    return false;
  end if;

  update public.smm_wallets
  set balance = balance - p_amount, updated_at = pg_catalog.now()
  where user_id = p_user;

  insert into public.smm_wallet_transactions(user_id, amount, type, reference_id, description)
  values (p_user, p_amount, 'DEBIT', p_reference, 'SMM order wallet debit');

  return true;
end;
$function$;

create or replace function public.smm_refund_wallet(
  p_user uuid,
  p_amount numeric,
  p_reference uuid,
  p_description text default 'SMM order refund'
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_balance numeric;
  v_debit_amount numeric;
  v_existing_amount numeric;
begin
  if p_user is null or p_reference is null or p_amount is null or p_amount <= 0 then
    return false;
  end if;

  -- A wallet row lock serializes duplicate refund attempts for the same user.
  select w.balance into v_balance
  from public.smm_wallets as w
  where w.user_id = p_user
  for update;

  if not found then
    return false;
  end if;

  select t.amount into v_existing_amount
  from public.smm_wallet_transactions as t
  where t.user_id = p_user and t.reference_id = p_reference and t.type = 'REFUND';

  if found then
    return v_existing_amount = p_amount;
  end if;

  -- Refunds are allowed only for a matching, previously recorded debit.
  select t.amount into v_debit_amount
  from public.smm_wallet_transactions as t
  where t.user_id = p_user and t.reference_id = p_reference and t.type = 'DEBIT';

  if not found or v_debit_amount <> p_amount then
    return false;
  end if;

  update public.smm_wallets
  set balance = balance + p_amount, updated_at = pg_catalog.now()
  where user_id = p_user;

  insert into public.smm_wallet_transactions(user_id, amount, type, reference_id, description)
  values (p_user, p_amount, 'REFUND', p_reference, coalesce(nullif(pg_catalog.btrim(p_description), ''), 'SMM order refund'));

  return true;
end;
$function$;

revoke all on function public.smm_debit_wallet(uuid, numeric, uuid) from public, anon, authenticated;
revoke all on function public.smm_refund_wallet(uuid, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.smm_debit_wallet(uuid, numeric, uuid) to service_role;
grant execute on function public.smm_refund_wallet(uuid, numeric, uuid, text) to service_role;

commit;
