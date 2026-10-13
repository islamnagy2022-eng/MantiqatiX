-- Phase 3.62 canonical paid subscription payment authority.
create table if not exists public.subscription_tier_prices (
  tier_code text primary key,
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  annual_price numeric(12,2) not null check (annual_price >= 0),
  currency text not null default 'EGP' check (currency='EGP'),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.subscription_tier_prices(tier_code,monthly_price,annual_price,currency,active)
values ('STARTER_GROWTH',199.00,1788.00,'EGP',true),('PRO_EXPANSION',499.00,4788.00,'EGP',true),('ENTERPRISE_CHAIN',999.00,9588.00,'EGP',true),('VIP_DOMINATOR',1999.00,19188.00,'EGP',true)
on conflict (tier_code) do update set monthly_price=excluded.monthly_price,annual_price=excluded.annual_price,currency=excluded.currency,active=excluded.active,updated_at=now();
create table if not exists public.subscription_payment_intents (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), tier_code text not null references public.subscription_tier_prices(tier_code),
 billing_cycle text not null check (billing_cycle in ('MONTHLY','ANNUAL')), sector text, amount numeric(12,2) not null check (amount>0),
 currency text not null default 'EGP' check(currency='EGP'), status text not null default 'CREATED' check(status in ('CREATED','PENDING','SUCCEEDED','FAILED','CANCELLED','PAID_PENDING_LEGAL','EXPIRED')),
 provider text not null default 'PAYMOB', provider_intent_id text, provider_order_id text, provider_transaction_id text, idempotency_key text not null,
 pricing_hash text not null, created_by uuid not null, expires_at timestamptz not null default(now()+interval '1 hour'), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_subscription_payment_intents_idempotency on public.subscription_payment_intents(idempotency_key);
create unique index if not exists uq_subscription_payment_intents_provider_intent on public.subscription_payment_intents(provider,provider_intent_id) where provider_intent_id is not null;
create unique index if not exists uq_subscription_payment_intents_provider_order on public.subscription_payment_intents(provider,provider_order_id) where provider_order_id is not null;
create index if not exists ix_subscription_payment_intents_business_status on public.subscription_payment_intents(business_id,status);
alter table public.subscription_tier_prices enable row level security;
alter table public.subscription_tier_prices force row level security;
alter table public.subscription_payment_intents enable row level security;
alter table public.subscription_payment_intents force row level security;
drop policy if exists subscription_tier_prices_authenticated_read on public.subscription_tier_prices;
create policy subscription_tier_prices_authenticated_read on public.subscription_tier_prices for select to authenticated using(active=true);
drop policy if exists subscription_payment_intents_owner_read on public.subscription_payment_intents;
create policy subscription_payment_intents_owner_read on public.subscription_payment_intents for select to authenticated using(exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.status='ACTIVE' and m.business_id=subscription_payment_intents.business_id));
revoke all on public.subscription_tier_prices from anon,authenticated;
grant select on public.subscription_tier_prices to authenticated;
revoke all on public.subscription_payment_intents from anon,authenticated;
grant select on public.subscription_payment_intents to authenticated;
create or replace function public.create_subscription_payment_intent_backend(p_business_id uuid,p_tier_code text,p_billing_cycle text,p_sector text,p_idempotency_key text,p_actor_user_id uuid)
returns public.subscription_payment_intents language plpgsql security definer set search_path='' as $$
declare v public.subscription_payment_intents; v_price numeric(12,2); v_currency text; v_hash text;
begin
 if p_actor_user_id is null then raise exception 'SUBSCRIPTION_AUTH_REQUIRED'; end if;
 if p_business_id is null or nullif(trim(p_tier_code),'') is null or nullif(trim(p_idempotency_key),'') is null then raise exception 'SUBSCRIPTION_INVALID_REQUEST'; end if;
 if upper(p_tier_code)='FREE_COMMISSION' then raise exception 'FREE_TIER_REQUIRES_NO_PAYMENT'; end if;
 if upper(p_billing_cycle) not in ('MONTHLY','ANNUAL') then raise exception 'SUBSCRIPTION_INVALID_BILLING_CYCLE'; end if;
 if not exists(select 1 from public.user_memberships m where m.user_id=p_actor_user_id and m.business_id=p_business_id and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER')) then raise exception 'SUBSCRIPTION_FORBIDDEN'; end if;
 perform public.legal_assert_action(p_actor_user_id,'SUBSCRIPTION_ACTIVATION',p_business_id);
 select * into v from public.subscription_payment_intents where idempotency_key=p_idempotency_key limit 1;
 if v.id is not null then if v.business_id<>p_business_id or v.tier_code<>upper(p_tier_code) or v.billing_cycle<>upper(p_billing_cycle) then raise exception 'SUBSCRIPTION_IDEMPOTENCY_MISMATCH'; end if; return v; end if;
 select case when upper(p_billing_cycle)='ANNUAL' then annual_price else monthly_price end,currency into v_price,v_currency from public.subscription_tier_prices where tier_code=upper(p_tier_code) and active=true;
 if v_price is null or v_price<=0 then raise exception 'SUBSCRIPTION_TIER_UNAVAILABLE'; end if;
 v_hash:=encode(digest(upper(p_tier_code)||':'||upper(p_billing_cycle)||':'||v_price::text||':'||v_currency,'sha256'),'hex');
 insert into public.subscription_payment_intents(business_id,tier_code,billing_cycle,sector,amount,currency,status,provider,idempotency_key,pricing_hash,created_by)
 values(p_business_id,upper(p_tier_code),upper(p_billing_cycle),nullif(trim(p_sector),''),v_price,v_currency,'CREATED','PAYMOB',p_idempotency_key,v_hash,p_actor_user_id) returning * into v;
 return v;
end; $$;
revoke all on function public.create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid) to service_role;
create or replace function public.process_verified_subscription_payment(p_event_id text,p_external_event_id text,p_subscription_payment_intent_id uuid,p_provider_transaction_id text,p_provider_confirmed_amount numeric,p_provider_confirmed_currency text,p_signature_verified boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.subscription_payment_intents; v_owner uuid; v_sub public.business_subscriptions; v_existing public.payment_provider_events;
begin
 if not p_signature_verified then raise exception 'SUBSCRIPTION_PROVIDER_SIGNATURE_REQUIRED'; end if;
 select * into v from public.subscription_payment_intents where id=p_subscription_payment_intent_id for update;
 if not found then raise exception 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND'; end if;
 if abs(v.amount-round(p_provider_confirmed_amount::numeric,2))>0.01 or upper(v.currency)<>upper(p_provider_confirmed_currency) then raise exception 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH'; end if;
 select * into v_existing from public.payment_provider_events where provider='PAYMOB' and external_event_id=p_external_event_id limit 1;
 if v_existing.id is not null then return jsonb_build_object('ok',true,'idempotent',true,'status',v.status); end if;
 insert into public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,payload_hash,raw_payload,processed_at)
 values(coalesce(p_event_id,crypto.randomUUID()::text),(select tenant_id from public.businesses where id=v.business_id),'PAYMOB','SUBSCRIPTION',null,p_external_event_id,'PROCESSED',true,null,'{}'::jsonb,now());
 update public.subscription_payment_intents set status='SUCCEEDED',provider_transaction_id=p_provider_transaction_id,updated_at=now() where id=v.id;
 select m.user_id into v_owner from public.user_memberships m where m.business_id=v.business_id and m.status='ACTIVE' and upper(m.role) in ('OWNER','BUSINESS_OWNER') order by m.created_at limit 1;
 if v_owner is null then update public.subscription_payment_intents set status='PAID_PENDING_LEGAL',updated_at=now() where id=v.id; return jsonb_build_object('ok',false,'status','PAID_PENDING_LEGAL','reason','OWNER_NOT_FOUND'); end if;
 begin perform public.legal_assert_action(v_owner,'SUBSCRIPTION_ACTIVATION',v.business_id);
 exception when others then update public.subscription_payment_intents set status='PAID_PENDING_LEGAL',updated_at=now() where id=v.id; return jsonb_build_object('ok',false,'status','PAID_PENDING_LEGAL','reason',SQLERRM); end;
 update public.business_subscriptions set status='EXPIRED',ends_at=coalesce(ends_at,now()),updated_at=now() where business_id=v.business_id and status in ('TRIALING','ACTIVE','PENDING_PAYMENT');
 insert into public.business_subscriptions(business_id,tier_code,billing_cycle,status,sector,starts_at,ends_at,provider,provider_reference,source_payment_intent_id,idempotency_key,created_by)
 values(v.business_id,v.tier_code,v.billing_cycle,'ACTIVE',v.sector,now(),case when v.billing_cycle='ANNUAL' then now()+interval '1 year' else now()+interval '1 month' end,'PAYMOB',v.provider_transaction_id,v.id,'paid:'||v.id::text,v.created_by) returning * into v_sub;
 return jsonb_build_object('ok',true,'status','ACTIVE','subscription_id',v_sub.id,'payment_intent_id',v.id);
end; $$;
revoke all on function public.process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean) to service_role;
