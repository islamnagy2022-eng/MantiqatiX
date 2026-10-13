-- Minimal isolated schema for atomic MantiGO Paymob webhook regression tests.
-- This file is for a disposable PostgreSQL container only.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT current_setting('request.jwt.claim.role', true);
$function$;

CREATE TABLE public.tenants (
  id varchar PRIMARY KEY
);
INSERT INTO public.tenants(id) VALUES ('MNTY-PLATFORM');

CREATE TABLE public.payment_intents (
  id varchar PRIMARY KEY
);

CREATE TABLE public.mantigo_financial_ledger (
  id text PRIMARY KEY,
  ride_id text NOT NULL,
  customer_id uuid NOT NULL,
  captain_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  gross_amount numeric NOT NULL CHECK (gross_amount > 0),
  payment_status text NOT NULL DEFAULT 'PENDING',
  payment_reference text,
  provider_transaction_id text,
  payment_confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_provider_events (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  provider varchar NOT NULL,
  event_type varchar NOT NULL,
  payment_intent_id varchar REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  external_event_id varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'RECEIVED',
  signature_verified boolean NOT NULL DEFAULT false,
  payload_hash varchar,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT payment_provider_events_provider_external_event_id_key UNIQUE (provider, external_event_id)
);
