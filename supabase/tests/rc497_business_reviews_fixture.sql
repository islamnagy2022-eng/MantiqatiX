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

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

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

-- RC498 fixture stub: production RPC contract is separately verified read-only.
CREATE OR REPLACE FUNCTION public.create_order_backend(
  p_order_id uuid,
  p_tenant_id character varying,
  p_business_id uuid,
  p_branch_id character varying,
  p_customer_id uuid,
  p_client_idempotency_key character varying,
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_delivery_fee numeric,
  p_total_amount numeric,
  p_currency character varying,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_items_json jsonb,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_customer_id THEN
    RAISE EXCEPTION 'CUSTOMER_REQUIRED';
  END IF;
  RETURN jsonb_build_object('id', p_order_id, 'status', 'PENDING');
END;
$function$;
GRANT EXECUTE ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) TO service_role;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  name text NOT NULL,
  status varchar NOT NULL
);
CREATE TABLE public.branches (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  status varchar NOT NULL
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  branch_id varchar REFERENCES public.branches(id),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status varchar NOT NULL,
  total_amount numeric NOT NULL,
  items_json jsonb NOT NULL
);
CREATE TABLE public.user_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id varchar NOT NULL,
  business_id uuid,
  branch_id varchar,
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
 ('10000000-0000-4000-8000-000000000005'),
 ('10000000-0000-4000-8000-000000000006');

INSERT INTO public.businesses(id,tenant_id,name,status) VALUES
 ('20000000-0000-4000-8000-000000000001','tenant-a','Verified Test Business','ACTIVE'),
 ('20000000-0000-4000-8000-000000000002','tenant-a','Unverified Test Business','ACTIVE'),
 ('20000000-0000-4000-8000-000000000003','tenant-b','Cross Tenant Test Business','ACTIVE');

INSERT INTO public.branches(id,tenant_id,business_id,status) VALUES
 ('branch-a1','tenant-a','20000000-0000-4000-8000-000000000001','ACTIVE'),
 ('branch-a2','tenant-a','20000000-0000-4000-8000-000000000001','ACTIVE'),
 ('branch-b1','tenant-a','20000000-0000-4000-8000-000000000002','ACTIVE'),
 ('branch-c1','tenant-b','20000000-0000-4000-8000-000000000003','ACTIVE');

INSERT INTO public.marketing_provider_profiles(business_id,status,is_verified) VALUES
 ('20000000-0000-4000-8000-000000000001','ACTIVE',true),
 ('20000000-0000-4000-8000-000000000002','ACTIVE',false),
 ('20000000-0000-4000-8000-000000000003','ACTIVE',true);

INSERT INTO public.user_memberships(user_id,tenant_id,business_id,branch_id,role,status) VALUES
 ('10000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'OWNER','ACTIVE'),
 ('10000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000002',NULL,'OWNER','ACTIVE'),
 ('10000000-0000-4000-8000-000000000006','tenant-a','20000000-0000-4000-8000-000000000001','branch-a2','MANAGER','ACTIVE');

INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000003');

INSERT INTO public.orders(id,tenant_id,business_id,branch_id,customer_id,status,total_amount,items_json) VALUES
 ('30000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','10000000-0000-4000-8000-000000000001','DELIVERED',150,'[{"catalogItemId":"40000000-0000-4000-8000-000000000001","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','10000000-0000-4000-8000-000000000001','PREPARING',75,'[{"catalogItemId":"40000000-0000-4000-8000-000000000002","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','10000000-0000-4000-8000-000000000004','DELIVERED',90,'[{"catalogItemId":"40000000-0000-4000-8000-000000000003","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000002','branch-b1','10000000-0000-4000-8000-000000000001','DELIVERED',90,'[{"catalogItemId":"40000000-0000-4000-8000-000000000004","name":"Test item","quantity":1}]'),
 ('30000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000003','branch-c1','10000000-0000-4000-8000-000000000001','DELIVERED',90,'[{"catalogItemId":"40000000-0000-4000-8000-000000000005","name":"Test item","quantity":1}]');
