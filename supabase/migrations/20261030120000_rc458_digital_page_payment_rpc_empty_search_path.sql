-- RC458: harden digital-page payment claim and publication SECURITY DEFINER entrypoints.
--
-- The claim RPC also qualifies its order-table references. Its RETURNS TABLE output
-- includes an "id" field, so an unqualified "where id = ..." is ambiguous in PL/pgSQL.
-- All application relations and helper functions are schema-qualified; pg_catalog
-- remains implicitly available with an empty search_path.
--
-- CREATE OR REPLACE preserves the existing function owner and ACL. The two remaining
-- procedures receive configuration-only changes. Authenticated caller grants are
-- intentional and must remain unchanged.
-- Apply only through the approved migration pipeline after isolated replay/tests.

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
set search_path = ''
as $function$
declare
  v_order public.digital_page_orders%rowtype;
  v_claim jsonb;
  v_claimed_at timestamptz;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select o.* into v_order
  from public.digital_page_orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if v_order.idempotency_key <> p_idempotency_key then
    raise exception 'IDEMPOTENCY_KEY_MISMATCH';
  end if;

  if v_order.payment_status = 'PAID' then
    raise exception 'ALREADY_PAID';
  end if;

  if v_order.provider_intent_id is not null then
    return query
      select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
             v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
             v_order.title,v_order.page_type,'EXISTING'::text;
    return;
  end if;

  v_claim := coalesce(v_order.metadata->'payment_intent_claim','null'::jsonb);
  v_claimed_at := nullif(v_claim->>'claimed_at','')::timestamptz;

  if v_claim ? 'token'
     and v_claimed_at is not null
     and v_claimed_at > now() - interval '5 minutes'
     and (v_claim->>'token') <> p_claim_token then
    return query
      select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
             v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
             v_order.title,v_order.page_type,'IN_PROGRESS'::text;
    return;
  end if;

  update public.digital_page_orders as o
  set metadata = jsonb_set(
      coalesce(o.metadata,'{}'::jsonb),
      '{payment_intent_claim}',
      jsonb_build_object('token',p_claim_token,'claimed_at',now()::text),
      true
    ),
    updated_at = now()
  where o.id = v_order.id;

  return query
    select v_order.id,v_order.user_id,v_order.amount,v_order.currency,v_order.payment_status,
           v_order.fulfillment_status,v_order.pricing_hash,v_order.provider_intent_id,
           v_order.title,v_order.page_type,'CLAIMED'::text;
end;
$function$;

alter function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)
  set search_path = '';

alter function public.fulfill_digital_page_publish(uuid,uuid,uuid)
  set search_path = '';
