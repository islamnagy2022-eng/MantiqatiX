-- Disposable schema for exercising the candidate RC425/RC428/RC429/RC430 RPCs.
-- Never use this fixture against a linked or production Supabase project.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text LANGUAGE sql STABLE
AS $function$ SELECT current_setting('request.jwt.claim.role', true); $function$;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  status text NOT NULL,
  total numeric,
  currency text NOT NULL,
  pricing_version bigint,
  pricing_hash text,
  pricing_authority text
);

CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  provider text NOT NULL,
  provider_order_id text,
  pricing_version bigint,
  pricing_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_payment_intents (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  provider text NOT NULL,
  provider_order_id text,
  provider_transaction_id text,
  tier_code text NOT NULL DEFAULT 'PRO',
  billing_cycle text NOT NULL DEFAULT 'MONTHLY',
  sector text NOT NULL DEFAULT 'GENERAL',
  created_by uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_provider_events (
  id varchar PRIMARY KEY,
  tenant_id text NOT NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  payment_intent_id varchar,
  external_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED',
  signature_verified boolean NOT NULL DEFAULT false,
  payload_hash text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_events_provider_external_event_id_key UNIQUE(provider, external_event_id)
);

CREATE TABLE public.user_memberships (
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  tier_code text NOT NULL,
  billing_cycle text NOT NULL,
  status text NOT NULL,
  sector text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  provider text NOT NULL,
  provider_reference text,
  source_payment_intent_id uuid,
  idempotency_key text NOT NULL,
  created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.legal_assert_action(p_user_id uuid, p_action text, p_business_id uuid)
RETURNS void LANGUAGE plpgsql
AS $function$ BEGIN RETURN; END; $function$;
