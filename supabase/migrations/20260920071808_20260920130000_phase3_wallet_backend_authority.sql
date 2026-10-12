
create or replace function public.create_wallet_transaction_backend(
  p_id varchar,
  p_tenant_id varchar,
  p_wallet_id varchar,
  p_transaction_type varchar,
  p_amount numeric,
  p_idempotency_key varchar,
  p_reference_type varchar,
  p_reference_id varchar,
  p_description text,
  p_journal_entry jsonb,
  p_journal_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallet_accounts%rowtype;
  v_existing public.wallet_transactions%rowtype;
  v_balance numeric := 0;
  v_is_debit boolean;
  v_after numeric;
  v_line_count integer;
  v_journal_id varchar;
begin
  perform public.assert_financial_membership(p_tenant_id);

  if p_amount <= 0 then raise exception 'WALLET_AMOUNT_MUST_BE_POSITIVE'; end if;
  if coalesce(length(trim(p_idempotency_key)),0) = 0 then raise exception 'WALLET_IDEMPOTENCY_REQUIRED'; end if;

  select * into v_wallet
  from public.wallet_accounts
  where id = p_wallet_id and tenant_id = p_tenant_id
  for update;

  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_wallet.status <> 'ACTIVE' then raise exception 'WALLET_NOT_ACTIVE'; end if;

  select * into v_existing
  from public.wallet_transactions
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_existing.wallet_id <> p_wallet_id or v_existing.amount <> p_amount then
      raise exception 'WALLET_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('id',v_existing.id,'wallet_id',v_existing.wallet_id,'status',v_existing.status,'balance_after',v_existing.balance_after,'journal_entry_id',v_existing.journal_entry_id,'idempotent',true);
  end if;

  select coalesce(sum(
    case when transaction_type in ('CREDIT','REFUND') then amount
         when transaction_type in ('DEBIT','COMMISSION_SETTLEMENT') then -amount
         else 0 end),0)
  into v_balance
  from public.wallet_transactions
  where wallet_id = p_wallet_id and status = 'CONFIRMED';

  v_is_debit := p_transaction_type in ('DEBIT','COMMISSION_SETTLEMENT');
  v_after := case when v_is_debit then v_balance - p_amount else v_balance + p_amount end;

  if v_is_debit and v_after < 0 and not v_wallet.allow_negative then
    raise exception 'WALLET_INSUFFICIENT_BALANCE';
  end if;

  v_journal_id := (p_journal_entry->>'id');
  if v_journal_id is null or length(v_journal_id)=0 then raise exception 'JOURNAL_ID_REQUIRED'; end if;

  -- Validate and post the journal before mutating wallet state.
  perform public.post_financial_journal(p_journal_entry, p_journal_lines);

  insert into public.wallet_transactions(
    id,tenant_id,wallet_id,transaction_type,amount,balance_after,idempotency_key,status,
    reference_type,reference_id,description,journal_entry_id
  ) values (
    p_id,p_tenant_id,p_wallet_id,p_transaction_type,p_amount,v_after,p_idempotency_key,'CONFIRMED',
    p_reference_type,p_reference_id,p_description,v_journal_id
  );

  return jsonb_build_object('id',p_id,'wallet_id',p_wallet_id,'status','CONFIRMED','balance_after',v_after,'journal_entry_id',v_journal_id,'idempotent',false);
end;
$$;

revoke all on function public.create_wallet_transaction_backend(varchar,varchar,varchar,varchar,numeric,varchar,varchar,varchar,text,jsonb,jsonb) from public;
grant execute on function public.create_wallet_transaction_backend(varchar,varchar,varchar,varchar,numeric,varchar,varchar,varchar,text,jsonb,jsonb) to authenticated;
