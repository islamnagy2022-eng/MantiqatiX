-- Existing intents are marked legacy and cannot be retried blindly. Only the new claimable RPC creates READY intents.
alter table public.subscription_payment_intents
  add column if not exists provider_creation_state text not null default 'LEGACY_UNRECONCILED';
alter table public.subscription_payment_intents
  add column if not exists provider_creation_claimed_at timestamptz;

do $constraint$
begin
  alter table public.subscription_payment_intents
    add constraint subscription_payment_intents_provider_creation_state_check
    check (provider_creation_state in ('LEGACY_UNRECONCILED','READY','CLAIMED','CORRELATED','RECONCILIATION_REQUIRED'));
exception when duplicate_object then null;
end;
$constraint$;

create or replace function public.create_subscription_payment_intent_claimable_backend(
  p_business_id uuid,
  p_tier_code text,
  p_billing_cycle text,
  p_sector text,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns public.subscription_payment_intents
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v public.subscription_payment_intents;
  v_price numeric(12,2);
  v_currency text;
  v_hash text;
begin
  if p_actor_user_id is null then raise exception 'SUBSCRIPTION_AUTH_REQUIRED'; end if;
  if p_business_id is null or nullif(pg_catalog.btrim(p_tier_code),'') is null or nullif(pg_catalog.btrim(p_idempotency_key),'') is null then
    raise exception 'SUBSCRIPTION_INVALID_REQUEST';
  end if;
  if upper(p_tier_code)='FREE_COMMISSION' then raise exception 'FREE_TIER_REQUIRES_NO_PAYMENT'; end if;
  if upper(p_billing_cycle) not in ('MONTHLY','ANNUAL') then raise exception 'SUBSCRIPTION_INVALID_BILLING_CYCLE'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id and m.business_id=p_business_id and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','BUSINESS_OWNER')
  ) then raise exception 'SUBSCRIPTION_FORBIDDEN'; end if;
  perform public.legal_assert_action(p_actor_user_id,'SUBSCRIPTION_ACTIVATION',p_business_id);

  select * into v from public.subscription_payment_intents i where i.idempotency_key=p_idempotency_key for update;
  if v.id is not null then
    if v.business_id<>p_business_id or v.tier_code<>upper(p_tier_code) or v.billing_cycle<>upper(p_billing_cycle) then
      raise exception 'SUBSCRIPTION_IDEMPOTENCY_MISMATCH';
    end if;
    return v;
  end if;

  select case when upper(p_billing_cycle)='ANNUAL' then p.annual_price else p.monthly_price end,p.currency
    into v_price,v_currency
  from public.subscription_tier_prices p
  where p.tier_code=upper(p_tier_code) and p.active=true;
  if v_price is null or v_price<=0 then raise exception 'SUBSCRIPTION_TIER_UNAVAILABLE'; end if;

  v_hash:=pg_catalog.encode(extensions.digest(upper(p_tier_code)||':'||upper(p_billing_cycle)||':'||v_price::text||':'||v_currency,'sha256'),'hex');
  insert into public.subscription_payment_intents(
    business_id,tier_code,billing_cycle,sector,amount,currency,status,provider,idempotency_key,
    pricing_hash,created_by,provider_creation_state
  )
  values(
    p_business_id,upper(p_tier_code),upper(p_billing_cycle),nullif(pg_catalog.btrim(p_sector),''),v_price,v_currency,
    'CREATED','PAYMOB',p_idempotency_key,v_hash,p_actor_user_id,'READY'
  )
  on conflict (idempotency_key) do nothing
  returning * into v;

  if not found then
    select * into v from public.subscription_payment_intents i where i.idempotency_key=p_idempotency_key for update;
    if v.id is null or v.business_id<>p_business_id or v.tier_code<>upper(p_tier_code) or v.billing_cycle<>upper(p_billing_cycle) then
      raise exception 'SUBSCRIPTION_IDEMPOTENCY_MISMATCH';
    end if;
  end if;
  return v;
end;
$function$;

revoke all on function public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid) to service_role;

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
     and v_intent.provider_creation_state='READY'
     and v_intent.provider_intent_id is null
     and v_intent.provider_order_id is null then
    update public.subscription_payment_intents
    set status='PENDING',provider_creation_state='CLAIMED',provider_creation_claimed_at=pg_catalog.now(),updated_at=pg_catalog.now()
    where id=v_intent.id and status='CREATED' and provider_creation_state='READY'
    returning * into v_intent;
    if found then
      return pg_catalog.jsonb_build_object('claimed',true,'outcome_unknown',false,'intent',pg_catalog.to_jsonb(v_intent));
    end if;
  end if;

  if v_intent.provider_intent_id is not null and v_intent.provider_order_id is not null then
    return pg_catalog.jsonb_build_object('claimed',false,'outcome_unknown',false,'intent',pg_catalog.to_jsonb(v_intent));
  end if;

  if v_intent.provider_creation_state in ('LEGACY_UNRECONCILED','CLAIMED','RECONCILIATION_REQUIRED')
     or v_intent.status='PENDING'
     or (v_intent.provider_intent_id is null) <> (v_intent.provider_order_id is null) then
    return pg_catalog.jsonb_build_object('claimed',false,'outcome_unknown',true,'intent',pg_catalog.to_jsonb(v_intent));
  end if;

  return pg_catalog.jsonb_build_object('claimed',false,'outcome_unknown',false,'intent',pg_catalog.to_jsonb(v_intent));
end;
$function$;

revoke all on function public.claim_subscription_provider_intent_creation_backend(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_subscription_provider_intent_creation_backend(uuid,uuid) to service_role;

comment on function public.claim_subscription_provider_intent_creation_backend(uuid,uuid) is
  'RC435: atomically claims one subscription Paymob intention creation attempt; a PENDING intent without provider IDs must be reconciled, not retried.';
