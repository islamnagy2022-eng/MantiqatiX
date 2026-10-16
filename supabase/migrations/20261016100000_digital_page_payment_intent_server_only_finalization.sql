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
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'TRUSTED_PAYMENT_FINALIZATION_REQUIRED';
  end if;

  if p_order_id is null or p_user_id is null
     or nullif(btrim(p_claim_token), '') is null
     or nullif(btrim(p_provider_intent_id), '') is null then
    raise exception 'INVALID_PAYMENT_FINALIZATION';
  end if;

  update public.digital_page_orders
  set provider = 'PAYMOB',
      provider_intent_id = p_provider_intent_id,
      payment_status = 'PENDING',
      metadata = coalesce(metadata, '{}'::jsonb) - 'payment_intent_claim',
      updated_at = now()
  where id = p_order_id
    and user_id = p_user_id
    and provider_intent_id is null
    and payment_status = 'PENDING'
    and metadata->'payment_intent_claim'->>'token' = p_claim_token;

  return found;
end;
$$;

revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from public;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from anon;
revoke all on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) from authenticated;
grant execute on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text) to service_role;

comment on function public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text)
is 'Trusted server-only finalization after the provider intention API returns a valid provider intent ID; never callable by authenticated clients.';

-- If the recovered RC426 chain contains the separate five-argument overload,
-- keep it non-callable until its provider-order correlation contract is reviewed.
-- Dynamic SQL makes this migration replay-safe when that overload is absent.
do $migration$
begin
  if to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)') is not null then
    execute 'revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) from public, anon, authenticated, service_role';
  end if;
end;
$migration$;
