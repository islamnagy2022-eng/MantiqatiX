-- MantiGO financial ledger v1.
-- Keeps MantiGO fare/payment/commission/settlement state separate from marketplace orders,
-- while delegating final partner settlement journal posting to the central finance core.

create table if not exists public.mantigo_financial_ledger (
  id text primary key,
  ride_id text not null unique references public.mantigo_rides(id) on delete restrict,
  customer_id uuid not null,
  captain_id uuid not null,
  currency text not null default 'EGP',
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission_rate numeric(6,3),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  captain_net_amount numeric(14,2) not null default 0 check (captain_net_amount >= 0),
  payment_method text,
  payment_status text not null default 'REQUIRED' check (payment_status in ('REQUIRED','PENDING','PAID','FAILED','REFUNDED','CASH_CONFIRMED')),
  settlement_status text not null default 'NOT_READY' check (settlement_status in ('NOT_READY','READY','SETTLED','HELD','CANCELLED')),
  payment_reference text,
  settlement_reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  payment_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mantigo_financial_ledger_captain_idx on public.mantigo_financial_ledger(captain_id,payment_status,settlement_status);
create index if not exists mantigo_financial_ledger_customer_idx on public.mantigo_financial_ledger(customer_id,payment_status);

alter table public.mantigo_financial_ledger enable row level security;
drop policy if exists mantigo_financial_customer_select on public.mantigo_financial_ledger;
create policy mantigo_financial_customer_select on public.mantigo_financial_ledger for select to authenticated
using (customer_id=auth.uid() or captain_id=auth.uid());

create table if not exists public.mantigo_financial_config (
  id boolean primary key default true check (id=true),
  commission_rate numeric(6,3) not null check (commission_rate>=0 and commission_rate<=100),
  currency text not null default 'EGP',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create or replace function public.lock_mantigo_fare_backend(p_user_id uuid,p_ride_id text)
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare v_customer uuid; v_captain uuid; v_amount numeric; v_status text; v_bid text; v_id text; v_key text; v_existing public.mantigo_financial_ledger%rowtype;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  select r.customer_id,r.status,r.accepted_bid_id,b.captain_id,b.offered_price into v_customer,v_status,v_bid,v_captain,v_amount
  from public.mantigo_rides r join public.mantigo_bids b on b.id=r.accepted_bid_id where r.id=p_ride_id for update of r;
  if v_customer is null then raise exception 'RIDE_OR_ACCEPTED_BID_NOT_FOUND'; end if;
  if p_user_id<>v_customer then raise exception 'CUSTOMER_REQUIRED'; end if;
  if v_status<>'ACCEPTED' then raise exception 'RIDE_MUST_BE_ACCEPTED'; end if;
  if v_amount is null or v_amount<=0 then raise exception 'INVALID_FARE'; end if;
  select * into v_existing from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if found then return jsonb_build_object('id',v_existing.id,'ride_id',p_ride_id,'gross_amount',v_existing.gross_amount,'payment_status',v_existing.payment_status,'settlement_status',v_existing.settlement_status,'idempotent',true); end if;
  v_id:='MGO-FIN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); v_key:='MGO-FARE-'||p_ride_id;
  insert into public.mantigo_financial_ledger(id,ride_id,customer_id,captain_id,gross_amount,commission_amount,captain_net_amount,payment_status,settlement_status,idempotency_key,metadata)
  values(v_id,p_ride_id,v_customer,v_captain,v_amount,0,v_amount,'REQUIRED','NOT_READY',v_key,jsonb_build_object('fare_locked',true,'accepted_bid_id',v_bid,'source','MANTIGO_ACCEPT'));
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_FARE_LOCKED','MANTIGO_FINANCIAL',v_id,'{}'::jsonb,jsonb_build_object('ride_id',p_ride_id,'gross_amount',v_amount,'payment_status','REQUIRED'),'SUCCESS');
  return jsonb_build_object('id',v_id,'ride_id',p_ride_id,'gross_amount',v_amount,'payment_status','REQUIRED','settlement_status','NOT_READY','idempotent',false);
end $function$;
revoke all on function public.lock_mantigo_fare_backend(uuid,text) from public,anon;
grant execute on function public.lock_mantigo_fare_backend(uuid,text) to authenticated;

create or replace function public.set_mantigo_financial_config_backend(p_admin_user_id uuid,p_commission_rate numeric,p_currency text default 'EGP')
returns jsonb language plpgsql security definer set search_path=public
as $function$
begin
  if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_commission_rate is null or p_commission_rate<0 or p_commission_rate>100 then raise exception 'INVALID_COMMISSION_RATE'; end if;
  insert into public.mantigo_financial_config(id,commission_rate,currency,updated_by,updated_at)
  values(true,p_commission_rate,upper(coalesce(nullif(trim(p_currency),''),'EGP')),p_admin_user_id,now())
  on conflict(id) do update set commission_rate=excluded.commission_rate,currency=excluded.currency,updated_by=excluded.updated_by,updated_at=now();
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_FINANCIAL_CONFIG_UPDATED','MANTIGO_FINANCIAL','GLOBAL','{}'::jsonb,jsonb_build_object('commission_rate',p_commission_rate,'currency',upper(coalesce(nullif(trim(p_currency),''),'EGP'))),'SUCCESS');
  return jsonb_build_object('commission_rate',p_commission_rate,'currency',upper(coalesce(nullif(trim(p_currency),''),'EGP')));
end $function$;
revoke all on function public.set_mantigo_financial_config_backend(uuid,numeric,text) from public,anon;
grant execute on function public.set_mantigo_financial_config_backend(uuid,numeric,text) to authenticated;

create or replace function public.confirm_mantigo_cash_payment_backend(p_user_id uuid,p_ride_id text)
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare v_f public.mantigo_financial_ledger%rowtype; v_rate numeric; v_commission numeric; v_net numeric;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.customer_id<>p_user_id then raise exception 'CUSTOMER_REQUIRED'; end if;
  if v_f.payment_status in ('PAID','CASH_CONFIRMED') then return jsonb_build_object('ride_id',p_ride_id,'payment_status',v_f.payment_status,'commission_rate',v_f.commission_rate,'commission_amount',v_f.commission_amount,'captain_net_amount',v_f.captain_net_amount,'idempotent',true); end if;
  if v_f.payment_status<>'REQUIRED' then raise exception 'INVALID_PAYMENT_STATE'; end if;
  select commission_rate into v_rate from public.mantigo_financial_config where id=true;
  if v_rate is null then raise exception 'MANTIGO_COMMISSION_NOT_CONFIGURED'; end if;
  v_commission:=round(v_f.gross_amount*v_rate/100,2); v_net:=round(v_f.gross_amount-v_commission,2);
  update public.mantigo_financial_ledger set payment_method='CASH',payment_status='CASH_CONFIRMED',commission_rate=v_rate,commission_amount=v_commission,captain_net_amount=v_net,settlement_status='READY',payment_reference='CASH-'||p_ride_id,payment_confirmed_at=now(),updated_at=now() where ride_id=p_ride_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_CASH_PAYMENT_CONFIRMED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('payment_status','REQUIRED'),jsonb_build_object('payment_status','CASH_CONFIRMED','commission_rate',v_rate,'commission_amount',v_commission,'captain_net_amount',v_net,'settlement_status','READY'),'SUCCESS');
  return jsonb_build_object('ride_id',p_ride_id,'payment_status','CASH_CONFIRMED','commission_rate',v_rate,'commission_amount',v_commission,'captain_net_amount',v_net,'settlement_status','READY','idempotent',false);
end $function$;
revoke all on function public.confirm_mantigo_cash_payment_backend(uuid,text) from public,anon;
grant execute on function public.confirm_mantigo_cash_payment_backend(uuid,text) to authenticated;

create or replace function public.settle_mantigo_captain_backend(p_admin_user_id uuid,p_ride_id text,p_channel text default 'BANK_TRANSFER')
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare v_f public.mantigo_financial_ledger%rowtype; v_ride_status text; v_result jsonb;
begin
  if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not exists (select 1 from public.user_memberships where user_id=p_admin_user_id and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE')) then raise exception 'FINANCE_ROLE_REQUIRED'; end if;
  select status into v_ride_status from public.mantigo_rides where id=p_ride_id;
  if v_ride_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
  if v_ride_status<>'COMPLETED' then raise exception 'RIDE_NOT_COMPLETED'; end if;
  select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
  if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
  if v_f.payment_status not in ('PAID','CASH_CONFIRMED') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
  if v_f.settlement_status='SETTLED' then return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference',v_f.settlement_reference,'idempotent',true); end if;
  if v_f.commission_rate is null then raise exception 'COMMISSION_NOT_LOCKED'; end if;
  v_result:=public.create_settlement_and_post_journal('MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,coalesce(nullif(trim(p_channel),''),'BANK_TRANSFER'),p_ride_id,null,'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id);
  update public.mantigo_financial_ledger set settlement_status='SETTLED',settlement_reference='MGO-SET-'||p_ride_id,updated_at=now() where ride_id=p_ride_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('settlement_status',v_f.settlement_status),jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
  return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
end $function$;
revoke all on function public.settle_mantigo_captain_backend(uuid,text,text) from public,anon;
grant execute on function public.settle_mantigo_captain_backend(uuid,text,text) to authenticated;
