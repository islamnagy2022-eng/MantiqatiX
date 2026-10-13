
drop function if exists public.record_refund_backend(varchar,varchar,uuid,uuid,varchar,numeric,numeric,text,varchar,jsonb,jsonb);

create or replace function public.record_refund_backend(
  p_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_order_id uuid,
  p_payment_intent_id varchar,
  p_customer_wallet_id varchar,
  p_original_amount numeric,
  p_refund_amount numeric,
  p_reason text,
  p_idempotency_key varchar,
  p_journal_entry jsonb,
  p_journal_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.refund_transactions%rowtype;
  v_refunded numeric := 0;
  v_commission numeric := 0;
  v_comm public.commission_transactions%rowtype;
  v_journal_id varchar;
  v_wallet public.wallet_accounts%rowtype;
  v_wallet_balance numeric := 0;
  v_wallet_after numeric;
  v_wallet_tx_id varchar;
begin
  perform public.assert_financial_membership(p_tenant_id);

  if p_original_amount <= 0 or p_refund_amount <= 0 then raise exception 'REFUND_AMOUNT_INVALID'; end if;
  if p_refund_amount > p_original_amount then raise exception 'REFUND_EXCEEDS_ORIGINAL_AMOUNT'; end if;

  select * into v_existing from public.refund_transactions where idempotency_key=p_idempotency_key limit 1;
  if found then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'refund_amount',v_existing.refund_amount,
      'commission_reversed',v_existing.commission_reversed,'journal_entry_id',v_existing.journal_entry_id,'idempotent',true);
  end if;

  select coalesce(sum(refund_amount),0) into v_refunded
  from public.refund_transactions
  where tenant_id=p_tenant_id and order_id=p_order_id and status='CONFIRMED';
  if p_refund_amount > (p_original_amount-v_refunded) then raise exception 'REFUND_EXCEEDS_REMAINING'; end if;

  select * into v_comm from public.commission_transactions where tenant_id=p_tenant_id and order_id=p_order_id limit 1;
  if found then
    v_commission := round(case when v_comm.gross_amount > 0 then p_refund_amount * v_comm.commission_amount / v_comm.gross_amount else 0 end,2);
  end if;

  v_journal_id := p_journal_entry->>'id';
  if coalesce(v_journal_id,'')='' then raise exception 'JOURNAL_ID_REQUIRED'; end if;

  if p_customer_wallet_id is not null then
    select * into v_wallet from public.wallet_accounts
    where id=p_customer_wallet_id and tenant_id=p_tenant_id for update;
    if not found then raise exception 'WALLET_NOT_FOUND'; end if;
    if v_wallet.status <> 'ACTIVE' then raise exception 'WALLET_NOT_ACTIVE'; end if;

    select coalesce(sum(case
      when transaction_type in ('CREDIT','REFUND') then amount
      when transaction_type in ('DEBIT','COMMISSION_SETTLEMENT') then -amount
      else 0 end),0)
    into v_wallet_balance
    from public.wallet_transactions
    where wallet_id=p_customer_wallet_id and status='CONFIRMED';

    v_wallet_after := v_wallet_balance + p_refund_amount;
    v_wallet_tx_id := 'wtx_' || substr(md5(p_idempotency_key || ':wallet'),1,16);
  end if;

  perform public.post_financial_journal(p_journal_entry,p_journal_lines);

  insert into public.refund_transactions(
    id,tenant_id,business_id,order_id,payment_intent_id,refund_amount,commission_reversed,
    reason,status,idempotency_key,journal_entry_id
  ) values (
    p_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,p_refund_amount,v_commission,
    p_reason,'CONFIRMED',p_idempotency_key,v_journal_id
  );

  if p_customer_wallet_id is not null then
    insert into public.wallet_transactions(
      id,tenant_id,wallet_id,transaction_type,amount,balance_after,idempotency_key,status,
      reference_type,reference_id,description,journal_entry_id
    ) values (
      v_wallet_tx_id,p_tenant_id,p_customer_wallet_id,'REFUND',p_refund_amount,v_wallet_after,
      p_idempotency_key || ':wallet','CONFIRMED','ORDER_REFUND',p_order_id,
      'استرجاع مبلغ الطلب ' || p_order_id,v_journal_id
    );
  end if;

  if p_payment_intent_id is not null then
    update public.payment_intents pi
    set updated_at=now(),
        status=case
          when pi.amount <= coalesce((select sum(r.refund_amount) from public.refund_transactions r
             where r.payment_intent_id=p_payment_intent_id and r.status='CONFIRMED'),0)
          then 'REFUNDED' else 'PARTIALLY_REFUNDED' end
    where pi.id=p_payment_intent_id and pi.tenant_id=p_tenant_id;
  end if;

  if v_comm.id is not null then
    update public.commission_transactions
    set status=case
      when commission_amount <= coalesce((select sum(r.commission_reversed) from public.refund_transactions r
        where r.tenant_id=p_tenant_id and r.order_id=p_order_id and r.status='CONFIRMED'),0)
      then 'REFUNDED' else status end
    where id=v_comm.id;
  end if;

  return jsonb_build_object('id',p_id,'status','CONFIRMED','refund_amount',p_refund_amount,
    'commission_reversed',v_commission,'journal_entry_id',v_journal_id,'idempotent',false);
end;
$$;

revoke all on function public.record_refund_backend(varchar,varchar,uuid,uuid,varchar,varchar,numeric,numeric,text,varchar,jsonb,jsonb) from public;
grant execute on function public.record_refund_backend(varchar,varchar,uuid,uuid,varchar,varchar,numeric,numeric,text,varchar,jsonb,jsonb) to authenticated;
