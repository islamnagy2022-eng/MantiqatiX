
create table if not exists public.refund_transactions (
  id varchar primary key,
  tenant_id varchar not null references public.tenants(id),
  business_id uuid not null references public.businesses(id),
  order_id uuid not null,
  payment_intent_id varchar,
  refund_amount numeric not null check (refund_amount > 0),
  commission_reversed numeric not null default 0 check (commission_reversed >= 0),
  reason text,
  status varchar not null default 'CONFIRMED',
  idempotency_key varchar not null unique,
  journal_entry_id varchar,
  created_at timestamptz not null default now()
);
create index if not exists idx_refund_transactions_tenant_order on public.refund_transactions(tenant_id,order_id);

alter table public.refund_transactions enable row level security;

create or replace function public.record_refund_backend(
  p_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_order_id uuid,
  p_payment_intent_id varchar,
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
  v_commission_rate numeric := 0;
  v_comm public.commission_transactions%rowtype;
  v_journal_id varchar;
begin
  perform public.assert_financial_membership(p_tenant_id);

  if p_original_amount <= 0 or p_refund_amount <= 0 then
    raise exception 'REFUND_AMOUNT_INVALID';
  end if;
  if p_refund_amount > p_original_amount then
    raise exception 'REFUND_EXCEEDS_ORIGINAL_AMOUNT';
  end if;

  select * into v_existing
  from public.refund_transactions
  where idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'id',v_existing.id,'status',v_existing.status,
      'refund_amount',v_existing.refund_amount,
      'commission_reversed',v_existing.commission_reversed,
      'journal_entry_id',v_existing.journal_entry_id,
      'idempotent',true
    );
  end if;

  select coalesce(sum(refund_amount),0) into v_refunded
  from public.refund_transactions
  where tenant_id=p_tenant_id and order_id=p_order_id and status='CONFIRMED';

  if p_refund_amount > (p_original_amount - v_refunded) then
    raise exception 'REFUND_EXCEEDS_REMAINING';
  end if;

  select * into v_comm
  from public.commission_transactions
  where tenant_id=p_tenant_id and order_id=p_order_id
  limit 1;

  if found then
    v_commission_rate := case when v_comm.gross_amount > 0 then v_comm.commission_amount / v_comm.gross_amount else 0 end;
    v_commission := round(p_refund_amount * v_commission_rate, 2);
  end if;

  v_journal_id := p_journal_entry->>'id';
  if coalesce(v_journal_id,'')='' then raise exception 'JOURNAL_ID_REQUIRED'; end if;

  perform public.post_financial_journal(p_journal_entry,p_journal_lines);

  insert into public.refund_transactions(
    id,tenant_id,business_id,order_id,payment_intent_id,refund_amount,
    commission_reversed,reason,status,idempotency_key,journal_entry_id
  ) values (
    p_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,p_refund_amount,
    v_commission,p_reason,'CONFIRMED',p_idempotency_key,v_journal_id
  );

  if p_payment_intent_id is not null then
    update public.payment_intents
    set updated_at=now(),
        status=case
          when amount <= coalesce((select sum(r.refund_amount) from public.refund_transactions r where r.payment_intent_id=p_payment_intent_id and r.status='CONFIRMED'),0)
            then 'REFUNDED'
          else 'PARTIALLY_REFUNDED'
        end
    where id=p_payment_intent_id and tenant_id=p_tenant_id;
  end if;

  if found and v_commission is not null then
    update public.commission_transactions
    set status=case
      when commission_amount <= coalesce((
        select sum(r.commission_reversed) from public.refund_transactions r
        where r.tenant_id=p_tenant_id and r.order_id=p_order_id and r.status='CONFIRMED'
      ),0) then 'REFUNDED'
      else status end
    where id=v_comm.id;
  end if;

  return jsonb_build_object(
    'id',p_id,'status','CONFIRMED','refund_amount',p_refund_amount,
    'commission_reversed',v_commission,'journal_entry_id',v_journal_id,
    'idempotent',false
  );
end;
$$;

revoke all on function public.record_refund_backend(varchar,varchar,uuid,uuid,varchar,numeric,numeric,text,varchar,jsonb,jsonb) from public;
grant execute on function public.record_refund_backend(varchar,varchar,uuid,uuid,varchar,numeric,numeric,text,varchar,jsonb,jsonb) to authenticated;
