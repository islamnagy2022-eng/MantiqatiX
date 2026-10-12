
create table if not exists public.payout_destinations (
  id varchar primary key,
  tenant_id varchar not null,
  owner_type varchar not null,
  owner_id varchar not null,
  payout_method varchar not null,
  provider varchar,
  external_account_ref varchar not null,
  status varchar not null default 'PENDING_VERIFICATION',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint payout_destinations_status_chk check (status in ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','REJECTED'))
);

create unique index if not exists uq_payout_destination_active
on public.payout_destinations(tenant_id, owner_type, owner_id, payout_method)
where status='ACTIVE';

create index if not exists idx_payout_destinations_owner
on public.payout_destinations(tenant_id, owner_type, owner_id);

alter table public.payout_destinations enable row level security;

drop policy if exists payout_destinations_member_read on public.payout_destinations;
create policy payout_destinations_member_read on public.payout_destinations
as restrictive for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true');

create table if not exists public.financial_obligations (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid,
  order_id uuid,
  payment_intent_id varchar,
  beneficiary_type varchar not null,
  beneficiary_id varchar not null,
  obligation_type varchar not null,
  gross_amount numeric(18,2) not null,
  amount numeric(18,2) not null,
  currency varchar not null default 'EGP',
  status varchar not null default 'DUE',
  payment_method varchar,
  settlement_id varchar,
  due_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint financial_obligations_amount_chk check (gross_amount >= 0 and amount >= 0),
  constraint financial_obligations_type_chk check (obligation_type in ('PLATFORM_COMMISSION','PROVIDER_PAYOUT')),
  constraint financial_obligations_status_chk check (status in ('DUE','PROCESSING','SETTLED','FAILED','CANCELLED'))
);

create index if not exists idx_financial_obligations_tenant_status
on public.financial_obligations(tenant_id,status);
create index if not exists idx_financial_obligations_order
on public.financial_obligations(tenant_id,order_id);
create unique index if not exists uq_financial_obligation_idempotent
on public.financial_obligations(tenant_id, obligation_type, order_id, beneficiary_id)
where order_id is not null;

alter table public.financial_obligations enable row level security;

drop policy if exists financial_obligations_member_read on public.financial_obligations;
create policy financial_obligations_member_read on public.financial_obligations
as restrictive for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and exists (
    select 1 from public.user_memberships um
    where um.tenant_id=financial_obligations.tenant_id
      and um.user_id=auth.uid()
      and coalesce(um.status,'ACTIVE')='ACTIVE'
  )
);

create or replace function public.create_payment_obligations(
  p_id_prefix varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_order_id uuid,
  p_payment_intent_id varchar,
  p_gross_amount numeric,
  p_commission_amount numeric,
  p_provider_id varchar,
  p_currency varchar,
  p_payment_method varchar
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_commission_id varchar := p_id_prefix || '_PLATFORM';
  v_payout_id varchar := p_id_prefix || '_PROVIDER';
begin
  perform public.assert_financial_membership(p_tenant_id);
  if p_gross_amount < 0 or p_commission_amount < 0 or p_commission_amount > p_gross_amount then
    raise exception 'INVALID_PAYMENT_OBLIGATION_AMOUNTS';
  end if;
  if coalesce(length(trim(p_provider_id)),0)=0 then raise exception 'PROVIDER_ID_REQUIRED'; end if;

  insert into public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) values (
    v_commission_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,
    'PLATFORM','PLATFORM','PLATFORM_COMMISSION',p_gross_amount,p_commission_amount,
    coalesce(p_currency,'EGP'),'DUE',p_payment_method,'{"settlement_mode":"SPLIT_OR_PROVIDER_CONFIRMATION"}'::jsonb
  ) on conflict(id) do nothing;

  insert into public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) values (
    v_payout_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,
    'PROVIDER',p_provider_id,'PROVIDER_PAYOUT',p_gross_amount,p_gross_amount-p_commission_amount,
    coalesce(p_currency,'EGP'),'DUE',p_payment_method,'{"settlement_mode":"SPLIT_OR_PROVIDER_CONFIRMATION"}'::jsonb
  ) on conflict(id) do nothing;

  return jsonb_build_object(
    'commission_obligation',v_commission_id,
    'provider_payout_obligation',v_payout_id,
    'commission_amount',p_commission_amount,
    'provider_net',p_gross_amount-p_commission_amount
  );
end;
$$;

create or replace function public.record_cash_commission_due(
  p_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_order_id uuid,
  p_provider_id varchar,
  p_gross_amount numeric,
  p_commission_amount numeric,
  p_currency varchar
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.assert_financial_membership(p_tenant_id);
  if p_gross_amount < 0 or p_commission_amount < 0 or p_commission_amount > p_gross_amount then
    raise exception 'INVALID_CASH_COMMISSION';
  end if;
  insert into public.financial_obligations(
    id,tenant_id,business_id,order_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) values (
    p_id,p_tenant_id,p_business_id,p_order_id,'PLATFORM','PLATFORM',
    'PLATFORM_COMMISSION',p_gross_amount,p_commission_amount,coalesce(p_currency,'EGP'),
    'DUE','CASH','{"reason":"CUSTOMER_PAID_PROVIDER_DIRECTLY"}'::jsonb
  ) on conflict(id) do nothing;
  return jsonb_build_object('id',p_id,'status','DUE','amount',p_commission_amount);
end;
$$;

revoke all on function public.create_payment_obligations(varchar,varchar,uuid,uuid,varchar,numeric,numeric,varchar,varchar,varchar) from public, anon, authenticated;
revoke all on function public.record_cash_commission_due(varchar,varchar,uuid,uuid,varchar,numeric,numeric,varchar) from public, anon, authenticated;

alter table public.payout_destinations force row level security;
alter table public.financial_obligations force row level security;
