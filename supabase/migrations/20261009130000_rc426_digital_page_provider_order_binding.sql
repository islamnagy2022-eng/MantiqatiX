-- RC426: persist Paymob's signed order correlation for digital-page payment intents.
-- Source-only until reviewed and applied to the intended Supabase project.
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from public;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from anon;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from authenticated;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from service_role;

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

revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from public;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from anon;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) to authenticated;
