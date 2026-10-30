-- RC459: introduce the provider-order-bound digital-page finalizer without
-- breaking the currently deployed digital-page-payment-intent Edge Function v5.
--
-- The live Edge Function v5 still calls the legacy four-argument signature. Keep that
-- signature and its authenticated EXECUTE grant during the staged cutover, but harden
-- its search_path. Add the five-argument signature used by current main; it persists
-- Paymob's signed provider order ID. Retire the four-argument overload only in a later
-- migration after the new Edge Function version is deployed and verified.
--
-- This migration intentionally does NOT replace the webhook RPC. That strict webhook
-- cutover is a separate phase after new checkout requests persist provider_order_id.

alter function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)
  set search_path = '';

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

  if nullif(trim(p_provider_intent_id), '') is null
     or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'PAYMOB_PROVIDER_CORRELATION_REQUIRED';
  end if;

  update public.digital_page_orders
  set provider = 'PAYMOB',
      provider_intent_id = p_provider_intent_id,
      provider_order_id = p_provider_order_id,
      payment_status = 'PENDING',
      metadata = metadata - 'payment_intent_claim',
      updated_at = now()
  where id = p_order_id
    and user_id = p_user_id
    and provider_intent_id is null
    and payment_status = 'PENDING'
    and metadata->'payment_intent_claim'->>'token' = p_claim_token;

  return found;
end;
$function$;

revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)
  to authenticated;
