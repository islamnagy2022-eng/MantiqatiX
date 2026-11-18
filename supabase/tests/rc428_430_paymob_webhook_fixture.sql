-- Disposable PostgreSQL 16 fixture for RC475 forward-repair validation. Never run against Production.
do $roles$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end
$roles$;

create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null
);

create table public.orders (
  id uuid primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  assigned_partner_id uuid,
  payment_method varchar not null,
  status varchar not null,
  total numeric,
  currency varchar not null,
  pricing_version bigint,
  pricing_hash varchar,
  pricing_authority varchar
);

create table public.payment_intents (
  id varchar primary key,
  tenant_id varchar not null,
  order_id uuid not null references public.orders(id),
  amount numeric not null,
  currency varchar not null,
  status varchar not null,
  provider varchar not null,
  provider_order_id text,
  payment_method varchar not null,
  pricing_version bigint,
  pricing_hash varchar,
  updated_at timestamptz not null default now()
);

create table public.payment_provider_events (
  id varchar primary key,
  tenant_id varchar not null,
  provider varchar not null,
  event_type varchar not null,
  payment_intent_id varchar,
  external_event_id varchar not null,
  status varchar not null,
  signature_verified boolean not null,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

create table public.subscription_payment_intents (
  id uuid primary key,
  business_id uuid not null references public.businesses(id),
  tier_code text not null,
  billing_cycle text not null,
  sector text,
  amount numeric not null,
  currency text not null,
  status text not null,
  provider text not null,
  provider_order_id text,
  provider_transaction_id text,
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

create table public.user_memberships (
  user_id uuid not null,
  business_id uuid not null references public.businesses(id),
  status text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  tier_code text not null,
  billing_cycle text not null,
  status text not null,
  sector text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  provider text,
  provider_reference text,
  source_payment_intent_id uuid,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE UNIQUE INDEX uq_business_subscriptions_idempotency
  ON public.business_subscriptions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX uq_subscription_payment_intents_provider_order
  ON public.subscription_payment_intents(provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE TABLE public.commission_rules (
  id varchar PRIMARY KEY, tenant_id varchar NOT NULL, business_id uuid,
  rule_type varchar NOT NULL, percentage numeric, fixed_amount numeric,
  active boolean NOT NULL, updated_at timestamptz NOT NULL,
  calculation_mode text NOT NULL, scope_type text NOT NULL, eligibility_event text NOT NULL,
  rule_priority integer NOT NULL, is_exempt boolean NOT NULL, approval_status text NOT NULL,
  version_no integer NOT NULL
);
CREATE TABLE public.financial_obligations (
  id varchar PRIMARY KEY, tenant_id varchar NOT NULL, business_id uuid, order_id uuid,
  payment_intent_id varchar, beneficiary_type varchar NOT NULL, beneficiary_id varchar NOT NULL,
  obligation_type varchar NOT NULL, gross_amount numeric NOT NULL, amount numeric NOT NULL,
  currency varchar NOT NULL, status varchar NOT NULL, payment_method varchar, settled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_financial_obligation_idempotent
  ON public.financial_obligations(tenant_id,obligation_type,order_id,beneficiary_id)
  WHERE order_id IS NOT NULL;

CREATE TABLE public.commission_transactions (
  id varchar PRIMARY KEY, tenant_id varchar NOT NULL, business_id uuid NOT NULL, order_id uuid NOT NULL,
  rule_id varchar, gross_amount numeric NOT NULL, commission_amount numeric NOT NULL,
  status varchar NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_commission_transactions_order_id ON public.commission_transactions(order_id);
CREATE TABLE public.payment_financial_reconciliations (
  id varchar PRIMARY KEY, tenant_id varchar NOT NULL, payment_intent_id varchar NOT NULL,
  provider_event_id varchar, order_id uuid NOT NULL, currency varchar NOT NULL,
  gross_amount numeric NOT NULL, commission_amount numeric NOT NULL,
  provider_received_amount numeric NOT NULL, provider_payout_amount numeric NOT NULL,
  commission_obligation_id varchar, provider_obligation_id varchar, commission_transaction_id varchar,
  reconciliation_status varchar NOT NULL, ledger_status varchar NOT NULL, exception_code varchar,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uk_payment_financial_reconciliation
  ON public.payment_financial_reconciliations(tenant_id,payment_intent_id);

create or replace function public.legal_assert_action(
  p_actor_user_id uuid,
  p_action text,
  p_business_id uuid
)
returns void
language plpgsql
as $function$
begin
  if current_setting('mantiqatix_test.legal_fail', true) = 'true' then
    raise exception 'TEST_LEGAL_BLOCKED';
  end if;
end;
$function$;


-- Fault-injection triggers are inert unless their transaction-local test flag is enabled.
create or replace function public.rc428_test_reject_atomic_update()
returns trigger language plpgsql as $function$
begin
  if current_setting('mantiqatix_test.rc428_fail', true) = 'true'
     and new.id = 'pi-atomic' and new.status = 'FAILED' then
    raise exception 'RC428_TEST_ATOMIC_UPDATE_FAILURE';
  end if;
  return new;
end;
$function$;
create trigger rc428_test_atomic_update
before update on public.payment_intents
for each row execute function public.rc428_test_reject_atomic_update();

create or replace function public.rc429_test_reject_atomic_update()
returns trigger language plpgsql as $function$
begin
  if current_setting('mantiqatix_test.rc429_fail', true) = 'true'
     and new.id = '40000000-0000-4000-8000-000000004282'::uuid
     and new.status = 'FAILED' then
    raise exception 'RC429_TEST_ATOMIC_UPDATE_FAILURE';
  end if;
  return new;
end;
$function$;
create trigger rc429_test_atomic_update
before update on public.subscription_payment_intents
for each row execute function public.rc429_test_reject_atomic_update();

create or replace function public.rc430_test_reject_subscription_insert()
returns trigger language plpgsql as $function$
begin
  if current_setting('mantiqatix_test.rc430_fail', true) = 'true'
     and new.business_id = '20000000-0000-4000-8000-000000004284'::uuid then
    raise exception 'RC430_TEST_ATOMIC_SUBSCRIPTION_FAILURE';
  end if;
  return new;
end;
$function$;
create trigger rc430_test_atomic_subscription
before insert on public.business_subscriptions
for each row execute function public.rc430_test_reject_subscription_insert();
