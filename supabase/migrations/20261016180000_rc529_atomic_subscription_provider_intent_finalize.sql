-- RC529: atomically correlate a claimed subscription Paymob intention and persist encrypted checkout recovery.
-- Candidate-only; requires RC435 and RC439 to be applied through the approved migration pipeline.
create or replace function public.finalize_subscription_provider_intent_creation_backend(
  p_intent_id uuid,
  p_actor_user_id uuid,
  p_provider_intent_id text,
  p_provider_order_id text,
  p_client_secret_ciphertext text,
  p_client_secret_iv text,
  p_client_secret_key_version text
)
returns public.subscription_payment_intents
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v public.subscription_payment_intents%rowtype;
begin
  if p_intent_id is null or p_actor_user_id is null then
    raise exception 'SUBSCRIPTION_PROVIDER_FINALIZE_AUTH_REQUIRED';
  end if;
  if nullif(pg_catalog.btrim(p_provider_intent_id), '') is null
     or nullif(pg_catalog.btrim(p_provider_order_id), '') is null
     or nullif(pg_catalog.btrim(p_client_secret_ciphertext), '') is null
     or nullif(pg_catalog.btrim(p_client_secret_iv), '') is null
     or nullif(pg_catalog.btrim(p_client_secret_key_version), '') is null then
    raise exception 'SUBSCRIPTION_PROVIDER_CORRELATION_REQUIRED';
  end if;

  select * into v
  from public.subscription_payment_intents i
  where i.id = p_intent_id
  for update;
  if not found then
    raise exception 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND';
  end if;
  if v.created_by is distinct from p_actor_user_id then
    raise exception 'SUBSCRIPTION_PAYMENT_INTENT_FORBIDDEN';
  end if;

  if v.provider_creation_state = 'CORRELATED'
     and v.provider_intent_id = p_provider_intent_id
     and v.provider_order_id = p_provider_order_id
     and v.client_secret_ciphertext is not null
     and v.client_secret_iv is not null
     and v.client_secret_key_version is not null then
    return v;
  end if;

  if v.status is distinct from 'PENDING'
     or v.provider_creation_state is distinct from 'CLAIMED'
     or v.provider_intent_id is not null
     or v.provider_order_id is not null then
    raise exception 'SUBSCRIPTION_PROVIDER_INTENT_NOT_CLAIMED';
  end if;

  update public.subscription_payment_intents
  set provider_intent_id = p_provider_intent_id,
      provider_order_id = p_provider_order_id,
      client_secret_ciphertext = p_client_secret_ciphertext,
      client_secret_iv = p_client_secret_iv,
      client_secret_key_version = p_client_secret_key_version,
      provider_creation_state = 'CORRELATED',
      updated_at = pg_catalog.now()
  where id = p_intent_id
  returning * into v;

  return v;
end;
$function$;

revoke all on function public.finalize_subscription_provider_intent_creation_backend(uuid,uuid,text,text,text,text,text) from public;
revoke all on function public.finalize_subscription_provider_intent_creation_backend(uuid,uuid,text,text,text,text,text) from anon;
revoke all on function public.finalize_subscription_provider_intent_creation_backend(uuid,uuid,text,text,text,text,text) from authenticated;
grant execute on function public.finalize_subscription_provider_intent_creation_backend(uuid,uuid,text,text,text,text,text) to service_role;

comment on function public.finalize_subscription_provider_intent_creation_backend(uuid,uuid,text,text,text,text,text) is
  'RC529: finalizes one RC435 claimed Paymob intention with provider correlation and AES-GCM ciphertext; service-role only.';
