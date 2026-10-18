-- DPAY-01: provider intent IDs may only be persisted by the trusted server path.
-- Review/replay migration. Do not apply to production without approved rollout.
create or replace function public.finalize_digital_page_payment_intent_backend(
  p_order_id uuid,
  p_user_id uuid,
  p_claim_token text,
  p_provider_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_intent_id text;
  v_status text;
  v_claim_token text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'TRUSTED_PAYMENT_FINALIZATION_REQUIRED';
  end if;

  if p_order_id is null or p_user_id is null
     or nullif(btrim(p_claim_token), '') is null
     or nullif(btrim(p_provider_intent_id), '') is null then
    raise exception 'INVALID_PAYMENT_FINALIZATION';
  end if;

  select o.user_id, o.provider_intent_id, o.payment_status,
         o.metadata->'payment_intent_claim'->>'token'
    into v_user_id, v_intent_id, v_status, v_claim_token
  from public.digital_page_orders o
  where o.id = p_order_id
  for update;

  if not found or v_user_id is distinct from p_user_id then
    return false;
  end if;

  -- Idempotent retry is allowed only for the same still-pending provider intent.
  if v_intent_id is not null then
    return v_intent_id = p_provider_intent_id and v_status = 'PENDING';
  end if;

  if v_status <> 'PENDING' or v_claim_token is distinct from p_claim_token then
    return false;
  end if;

  update public.digital_page_orders
  set provider = 'PAYMOB',
      provider_intent_id = p_provider_intent_id,
      payment_status = 'PENDING',
      metadata = coalesce(metadata, '{}'::jsonb) - 'payment_intent_claim',
      updated_at = now()
  where id = p_order_id;

  return found;
end;
$$;

revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from public;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from anon;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from authenticated;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from service_role;

comment on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text)
is 'Trusted server-only finalization after the provider intention API returns a valid provider intent ID; never callable by authenticated clients.';

-- Reconcile the recovered RC426 five-argument overload. The Paymob order ID is
-- persisted server-side so the webhook can correlate by provider order as well as merchant reference.
-- This is replay-safe whether the overload exists yet or not.
do $migration$
begin
  if to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)') is not null then
    execute 'revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from public, anon, authenticated, service_role';
  end if;
end;
$migration$;

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
declare
  v_user_id uuid;
  v_intent_id text;
  v_provider_order_id text;
  v_status text;
  v_claim_token text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'TRUSTED_PAYMENT_FINALIZATION_REQUIRED';
  end if;

  if p_order_id is null or p_user_id is null
     or nullif(btrim(p_claim_token), '') is null
     or nullif(btrim(p_provider_intent_id), '') is null
     or nullif(btrim(p_provider_order_id), '') is null then
    raise exception 'INVALID_PAYMENT_FINALIZATION';
  end if;

  select o.user_id, o.provider_intent_id, o.provider_order_id, o.payment_status,
         o.metadata->'payment_intent_claim'->>'token'
    into v_user_id, v_intent_id, v_provider_order_id, v_status, v_claim_token
  from public.digital_page_orders o
  where o.id = p_order_id
  for update;

  if not found or v_user_id is distinct from p_user_id then
    return false;
  end if;

  -- Retries may confirm the same intent/order pair, but never replace either identifier.
  if v_intent_id is not null then
    return v_intent_id = p_provider_intent_id
       and v_provider_order_id = p_provider_order_id
       and v_status = 'PENDING';
  end if;

  if v_status <> 'PENDING' or v_claim_token is distinct from p_claim_token then
    return false;
  end if;

  update public.digital_page_orders
  set provider = 'PAYMOB',
      provider_intent_id = p_provider_intent_id,
      provider_order_id = p_provider_order_id,
      payment_status = 'PENDING',
      metadata = coalesce(metadata, '{}'::jsonb) - 'payment_intent_claim',
      updated_at = now()
  where id = p_order_id;

  return found;
end;
$function$;

revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from public;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from anon;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from authenticated;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) to service_role;

comment on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)
is 'Trusted server-only finalization including Paymob provider order correlation; never callable by authenticated clients.';
