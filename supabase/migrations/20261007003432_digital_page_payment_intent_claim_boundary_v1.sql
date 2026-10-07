create or replace function public.claim_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_claim_token text
)
returns table(
  id uuid,
  user_id uuid,
  amount numeric,
  currency text,
  payment_status text,
  fulfillment_status text,
  pricing_hash text,
  provider_intent_id text,
  title text,
  page_type text,
  claim_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.digital_page_orders%rowtype;
  v_claim jsonb;
  v_claimed_at timestamptz;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into v_order from public.digital_page_orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.user_id <> p_user_id then raise exception 'FORBIDDEN'; end if;
  if v_order.idempotency_key <> p_idempotency_key then raise exception 'IDEMPOTENCY_KEY_MISMATCH'; end if;
  if v_order.payment_status = 'PAID' then raise exception 'ALREADY_PAID'; end if;
  if v_order.provider_intent_id is not null then
    return query select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,v_order.title,v_order.page_type,'EXISTING'::text;
    return;
  end if;
  v_claim := coalesce(v_order.metadata->'payment_intent_claim','null'::jsonb);
  v_claimed_at := nullif(v_claim->>'claimed_at','')::timestamptz;
  if v_claim ? 'token' and v_claimed_at is not null and v_claimed_at > now() - interval '5 minutes' and (v_claim->>'token') <> p_claim_token then
    return query select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,v_order.title,v_order.page_type,'IN_PROGRESS'::text;
    return;
  end if;
  update public.digital_page_orders set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{payment_intent_claim}',jsonb_build_object('token',p_claim_token,'claimed_at',now()::text),true),updated_at=now() where id=v_order.id;
  return query select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,v_order.title,v_order.page_type,'CLAIMED'::text;
end;
$$;
revoke all on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text) from public;
revoke all on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text) from anon;
grant execute on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text) to authenticated;

create or replace function public.finalize_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text,
  p_provider_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'FORBIDDEN'; end if;
  update public.digital_page_orders
  set provider='PAYMOB',provider_intent_id=p_provider_intent_id,payment_status='PENDING',metadata=metadata-'payment_intent_claim',updated_at=now()
  where id=p_order_id and user_id=p_user_id and provider_intent_id is null and payment_status='PENDING' and metadata->'payment_intent_claim'->>'token'=p_claim_token;
  return found;
end;
$$;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from public;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from anon;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) to authenticated;