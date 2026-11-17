-- RC468: close digital-page payment claim-token NULL semantics and enforce provider-order binding.
-- Forward-only candidate. This supersedes the older RC458/RC426 payment RPC bodies
-- without changing order rows or widening caller privileges. Deploy the matching
-- digital-page-payment-intent Edge Function in the same controlled release unit.

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

  -- The caller contract is an Edge-generated UUID. Reject NULL, blank, malformed,
  -- or non-canonical values before they can interact with SQL three-valued logic.
  if p_claim_token is null
     or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'PAYMENT_CLAIM_TOKEN_REQUIRED';
  end if;

  select o.* into v_order
  from public.digital_page_orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.user_id is distinct from p_user_id then
    raise exception 'FORBIDDEN';
  end if;
  if v_order.idempotency_key is distinct from p_idempotency_key then
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

  -- Any unexpired claim is busy, including a replay using the same token.
  -- A retry must not create a second provider intention from the same claim.
  if v_claim ? 'token'
     and v_claimed_at is not null
     and v_claimed_at > now() - interval '5 minutes' then
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

create or replace function public.release_digital_page_payment_intent_claim_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;
  if p_claim_token is null
     or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'PAYMENT_CLAIM_TOKEN_REQUIRED';
  end if;

  update public.digital_page_orders as o
  set metadata = o.metadata - 'payment_intent_claim',
      updated_at = now()
  where o.id = p_order_id
    and o.user_id = p_user_id
    and o.provider_intent_id is null
    and o.metadata->'payment_intent_claim'->>'token' = p_claim_token;

  return found;
end;
$function$;

-- Keep the legacy four-argument overload inert. The current Edge source uses the
-- five-argument provider-order-bound contract and must be deployed with this migration.
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;

create or replace function public.finalize_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text,
  p_provider_intent_id text,
  p_provider_order_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'FORBIDDEN';
  end if;
  if p_claim_token is null
     or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'PAYMENT_CLAIM_TOKEN_REQUIRED';
  end if;
  if nullif(trim(p_provider_intent_id), '') is null
     or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'PAYMOB_PROVIDER_CORRELATION_REQUIRED';
  end if;

  update public.digital_page_orders as o
  set provider = 'PAYMOB',
      provider_intent_id = p_provider_intent_id,
      provider_order_id = p_provider_order_id,
      payment_status = 'PENDING',
      metadata = o.metadata - 'payment_intent_claim',
      updated_at = now()
  where o.id = p_order_id
    and o.user_id = p_user_id
    and o.provider_intent_id is null
    and o.payment_status = 'PENDING'
    and o.metadata->'payment_intent_claim'->>'token' = p_claim_token;

  return found;
end;
$function$;

revoke all on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)
  from public, anon, service_role;
grant execute on function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)
  to authenticated;

revoke all on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)
  from public, anon, service_role;
grant execute on function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)
  to authenticated;

revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)
  from public, anon, service_role;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)
  to authenticated;
