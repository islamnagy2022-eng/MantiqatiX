
create or replace function public.create_commission_backend(
  p_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_order_id uuid,
  p_rule_id varchar,
  p_order_amount numeric,
  p_commission_rate numeric,
  p_commission_amount numeric,
  p_platform_net numeric,
  p_merchant_net numeric,
  p_journal_entry jsonb,
  p_journal_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.commission_transactions%rowtype;
begin
  perform public.assert_financial_membership(p_tenant_id);
  if p_order_amount < 0 or p_commission_amount < 0 or p_commission_rate < 0 then
    raise exception 'COMMISSION_AMOUNT_INVALID';
  end if;
  if p_commission_amount > p_order_amount then raise exception 'COMMISSION_EXCEEDS_ORDER'; end if;

  select * into v_existing
  from public.commission_transactions
  where tenant_id=p_tenant_id and order_id=p_order_id
  limit 1;
  if found then
    return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'commission_amount',v_existing.commission_amount,'idempotent',true);
  end if;

  perform public.post_financial_journal(p_journal_entry,p_journal_lines);

  insert into public.commission_transactions(
    id,tenant_id,business_id,order_id,rule_id,gross_amount,commission_amount,status
  ) values (
    p_id,p_tenant_id,p_business_id,p_order_id,p_rule_id,p_order_amount,p_commission_amount,'POSTED'
  );

  return jsonb_build_object('id',p_id,'status','POSTED','commission_amount',p_commission_amount,'idempotent',false);
end;
$$;

revoke all on function public.create_commission_backend(varchar,varchar,uuid,uuid,varchar,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb) from public;
grant execute on function public.create_commission_backend(varchar,varchar,uuid,uuid,varchar,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb) to authenticated;
