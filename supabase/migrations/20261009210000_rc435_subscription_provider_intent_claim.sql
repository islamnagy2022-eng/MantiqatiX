-- RC435: claim Paymob subscription intention creation before network I/O.
-- A claimed PENDING intent without provider IDs is an unknown/reconciliation state, never a retry permit.
create or replace function public.claim_subscription_provider_intent_creation_backend(
  p_intent_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_intent public.subscription_payment_intents%rowtype;
begin
  if p_intent_id is null or p_actor_user_id is null then raise exception 'SUBSCRIPTION_AUTH_REQUIRED'; end if;

  select * into v_intent
  from public.subscription_payment_intents i
  where i.id=p_intent_id
  for update;
  if not found then raise exception 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND'; end if;
  if v_intent.created_by <> p_actor_user_id then raise exception 'SUBSCRIPTION_PAYMENT_INTENT_FORBIDDEN'; end if;

  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id
      and m.business_id=v_intent.business_id
      and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','BUSINESS_OWNER')
  ) then
    raise exception 'SUBSCRIPTION_FORBIDDEN';
  end if;

  if v_intent.status='CREATED'
     and v_intent.provider_intent_id is null
     and v_intent.provider_order_id is null then
    update public.subscription_payment_intents
    set status='PENDING',updated_at=pg_catalog.now()
    where id=v_intent.id
    returning * into v_intent;
    return pg_catalog.jsonb_build_object('claimed',true,'outcome_unknown',false,'intent',pg_catalog.to_jsonb(v_intent));
  end if;

  if v_intent.status='PENDING'
     and (v_intent.provider_intent_id is null or v_intent.provider_order_id is null) then
    return pg_catalog.jsonb_build_object('claimed',false,'outcome_unknown',true,'intent',pg_catalog.to_jsonb(v_intent));
  end if;

  return pg_catalog.jsonb_build_object('claimed',false,'outcome_unknown',false,'intent',pg_catalog.to_jsonb(v_intent));
end;
$function$;

revoke all on function public.claim_subscription_provider_intent_creation_backend(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_subscription_provider_intent_creation_backend(uuid,uuid) to service_role;

comment on function public.claim_subscription_provider_intent_creation_backend(uuid,uuid) is
  'RC435: atomically claims one subscription Paymob intention creation attempt; a PENDING intent without provider IDs must be reconciled, not retried.';
