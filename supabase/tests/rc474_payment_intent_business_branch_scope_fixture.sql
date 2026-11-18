-- Disposable PostgreSQL fixture for RC474 only. Never run against Production.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$function$;

CREATE TABLE public.user_memberships (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id varchar(80) NOT NULL,
  business_id uuid,
  branch_id varchar(80),
  role varchar(80) NOT NULL,
  status varchar(30) NOT NULL,
  permissions jsonb
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  tenant_id varchar(80) NOT NULL,
  business_id uuid NOT NULL,
  branch_id varchar(80),
  customer_id uuid,
  status varchar(40) NOT NULL,
  total_amount numeric NOT NULL,
  total numeric,
  currency varchar(3) NOT NULL,
  pricing_version bigint,
  pricing_hash varchar(200),
  pricing_authority varchar(80)
);

CREATE TABLE public.payment_intents (
  id varchar(80) PRIMARY KEY,
  tenant_id varchar(80) NOT NULL,
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency varchar(3) NOT NULL,
  status varchar(30) NOT NULL,
  provider varchar(40) NOT NULL,
  payment_method varchar(40) NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  pricing_version bigint,
  pricing_hash varchar(200),
  UNIQUE(tenant_id,idempotency_key)
);

GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated, service_role;
