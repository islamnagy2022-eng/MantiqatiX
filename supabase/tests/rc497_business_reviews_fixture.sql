-- RC497 disposable PostgreSQL fixture. Never run against Production.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  status varchar NOT NULL
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  customer_id uuid REFERENCES auth.users(id),
  status varchar NOT NULL,
  total_amount numeric NOT NULL,
  items_json jsonb NOT NULL
);
CREATE TABLE public.user_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id varchar NOT NULL,
  business_id uuid,
  role varchar NOT NULL,
  status varchar NOT NULL
);
CREATE TABLE public.marketing_provider_profiles (
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  status varchar NOT NULL,
  is_verified boolean NOT NULL DEFAULT false
);
CREATE TABLE private.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO auth.users(id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'),
 ('10000000-0000-4000-8000-000000000004'),
 ('10000000-0000-4000-8000-000000000005');

INSERT INTO public.businesses(id,tenant_id,status) VALUES
 ('20000000-0000-4000-8000-000000000001','tenant-a','ACTIVE'),
 ('20000000-0000-4000-8000-000000000002','tenant-a','ACTIVE');

INSERT INTO public.marketing_provider_profiles(business_id,status,is_verified) VALUES
 ('20000000-0000-4000-8000-000000000001','ACTIVE',true),
 ('20000000-0000-4000-8000-000000000002','ACTIVE',false);

INSERT INTO public.user_memberships(user_id,tenant_id,business_id,role,status) VALUES
 ('10000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','OWNER','ACTIVE'),
 ('10000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000002','OWNER','ACTIVE');

INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000003');

INSERT INTO public.orders(id,tenant_id,business_id,customer_id,status,total_amount,items_json) VALUES
 ('30000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','DELIVERED',150,'[{"catalogItemId":"40000000-0000-4000-8000-000000000001","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','PREPARING',75,'[{"catalogItemId":"40000000-0000-4000-8000-000000000002","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','DELIVERED',90,'[{"catalogItemId":"40000000-0000-4000-8000-000000000003","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','DELIVERED',90,'[{"catalogItemId":"40000000-0000-4000-8000-000000000004","name":"Test item","quantity":1}]');
