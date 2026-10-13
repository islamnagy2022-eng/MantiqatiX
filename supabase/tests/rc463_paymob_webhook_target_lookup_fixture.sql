-- RC463 isolated PostgreSQL fixture for Paymob target lookup.
-- This fixture is for the dedicated disposable CI job only; it is not a production migration.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'CREATE ROLE anon NOLOGIN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'CREATE ROLE authenticated NOLOGIN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE 'CREATE ROLE service_role NOLOGIN'; END IF;
END
$roles$;

CREATE TABLE public.subscription_payment_intents (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  provider text NOT NULL,
  provider_order_id text
);

CREATE TABLE public.digital_page_orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  payment_status text NOT NULL,
  provider_order_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text
);

CREATE TABLE public.mantigo_financial_ledger (
  id text PRIMARY KEY,
  ride_id text NOT NULL,
  customer_id uuid NOT NULL,
  currency text NOT NULL,
  gross_amount numeric NOT NULL,
  payment_status text NOT NULL,
  settlement_status text NOT NULL,
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.payment_intents (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency varchar NOT NULL,
  status varchar NOT NULL,
  pricing_version bigint,
  pricing_hash varchar,
  provider_order_id text,
  provider varchar NOT NULL
);
