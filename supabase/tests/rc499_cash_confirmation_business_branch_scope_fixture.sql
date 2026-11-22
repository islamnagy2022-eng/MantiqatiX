-- RC499 isolated PostgreSQL fixture for cash confirmation business/branch membership selection.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

GRANT USAGE ON SCHEMA auth TO service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO service_role;

CREATE TABLE public.user_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id varchar NOT NULL,
  business_id uuid,
  branch_id varchar,
  role text NOT NULL,
  status text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL,
  branch_id varchar,
  customer_id uuid,
  status text NOT NULL,
  total_amount numeric NOT NULL,
  total numeric GENERATED ALWAYS AS (total_amount) STORED,
  currency varchar NOT NULL,
  pricing_hash text,
  pricing_version bigint
);

CREATE TABLE public.payment_intents (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency varchar NOT NULL,
  status text NOT NULL,
  payment_method varchar NOT NULL,
  provider varchar NOT NULL,
  pricing_hash text,
  pricing_version bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL,
  payment_method varchar NOT NULL,
  provider varchar NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL,
  business_id uuid,
  active boolean NOT NULL DEFAULT false,
  rule_type varchar NOT NULL,
  percentage numeric,
  fixed_amount numeric,
  per_item_amount numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_events (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  event_id text NOT NULL UNIQUE,
  payment_id varchar NOT NULL,
  amount numeric NOT NULL,
  payment_method varchar NOT NULL,
  status varchar NOT NULL,
  raw_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE public.financial_obligations (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL,
  order_id uuid NOT NULL,
  payment_intent_id varchar NOT NULL,
  beneficiary_type varchar NOT NULL,
  beneficiary_id varchar NOT NULL,
  obligation_type varchar NOT NULL,
  gross_amount numeric NOT NULL,
  amount numeric NOT NULL,
  currency varchar NOT NULL,
  status varchar NOT NULL,
  payment_method varchar NOT NULL,
  settlement_id varchar,
  due_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL
);

-- Baseline signature/ACL required by the RC499 forward migration.
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_intent_id character varying,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $function$
  SELECT '{}'::jsonb;
$function$;

REVOKE ALL ON FUNCTION public.confirm_cash_payment(character varying, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(character varying, uuid) TO service_role;
