\if :{?mantiqati_disposable}
  \if :mantiqati_disposable
    \echo 'Using explicit disposable-test authorization for synthetic tenant fixture.'
  \else
    \echo 'REFUSED: set -v mantiqati_disposable=on only for an isolated disposable database.'
    \quit 3
  \endif
\else
  \echo 'REFUSED: this synthetic fixture requires -v mantiqati_disposable=on.'
  \quit 3
\endif

-- Synthetic fixture only. The caller must use the guarded local Supabase DB URL.
BEGIN;

INSERT INTO auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
VALUES
  ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','tenant-a-isolation@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"test_fixture":true}'::jsonb,now(),now(),false,false),
  ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','tenant-b-isolation@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"test_fixture":true}'::jsonb,now(),now(),false,false);

INSERT INTO public.tenants (id,name,code,status,settings) VALUES
  ('MNTY-TEST-A','Tenant Isolation Test A','S05-TEST-A','ACTIVE','{"test_fixture":true}'::jsonb),
  ('MNTY-TEST-B','Tenant Isolation Test B','S05-TEST-B','ACTIVE','{"test_fixture":true}'::jsonb);

INSERT INTO public.organizations (id,tenant_id,name,code,status,settings) VALUES
  ('ORG-S05-TEST-A','MNTY-TEST-A','Tenant Isolation Org A','S05-ORG-A','ACTIVE','{"test_fixture":true}'::jsonb),
  ('ORG-S05-TEST-B','MNTY-TEST-B','Tenant Isolation Org B','S05-ORG-B','ACTIVE','{"test_fixture":true}'::jsonb);

INSERT INTO public.businesses (id,tenant_id,organization_id,name,code,status,settings) VALUES
  ('30000000-0000-4000-8000-000000000001','MNTY-TEST-A','ORG-S05-TEST-A','Synthetic Business A','S05-BIZ-A','PENDING','{"showcase":false,"test_fixture":true}'::jsonb),
  ('30000000-0000-4000-8000-000000000002','MNTY-TEST-B','ORG-S05-TEST-B','Synthetic Business B','S05-BIZ-B','PENDING','{"showcase":false,"test_fixture":true}'::jsonb);

INSERT INTO public.user_memberships
  (id,user_id,tenant_id,organization_id,business_id,role,permissions,status)
VALUES
  ('S05-TEST-A-OWNER','20000000-0000-4000-8000-000000000001','MNTY-TEST-A','ORG-S05-TEST-A','30000000-0000-4000-8000-000000000001','OWNER','[]'::jsonb,'ACTIVE'),
  ('S05-TEST-B-OWNER','20000000-0000-4000-8000-000000000002','MNTY-TEST-B','ORG-S05-TEST-B','30000000-0000-4000-8000-000000000002','OWNER','[]'::jsonb,'ACTIVE');

INSERT INTO public.orders
  (id,tenant_id,organization_id,business_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,currency,
   customer_name,customer_phone,delivery_address,items_json,metadata)
VALUES
  ('40000000-0000-4000-8000-000000000001','MNTY-TEST-A','ORG-S05-TEST-A','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','NEW',100,0,0,0,100,'EGP','Synthetic Customer A','0000000000','Disposable fixture A','[]'::jsonb,'{"test_fixture":true}'::jsonb),
  ('40000000-0000-4000-8000-000000000002','MNTY-TEST-B','ORG-S05-TEST-B','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','NEW',100,0,0,0,100,'EGP','Synthetic Customer B','0000000000','Disposable fixture B','[]'::jsonb,'{"test_fixture":true}'::jsonb);

INSERT INTO public.payment_intents
  (id,tenant_id,order_id,amount,currency,status,provider,idempotency_key,payment_method)
VALUES
  ('S05-TEST-PI-A','MNTY-TEST-A','40000000-0000-4000-8000-000000000001',100,'EGP','CREATED','TEST','S05-TEST-PI-A-KEY','TEST'),
  ('S05-TEST-PI-B','MNTY-TEST-B','40000000-0000-4000-8000-000000000002',100,'EGP','CREATED','TEST','S05-TEST-PI-B-KEY','TEST');

INSERT INTO public.account_registration_requests (id,user_id,requested_role,status,metadata) VALUES
  ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','SERVICE_PROVIDER','PENDING','{"test_fixture":true}'::jsonb),
  ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','SERVICE_PROVIDER','PENDING','{"test_fixture":true}'::jsonb);

INSERT INTO public.provider_onboarding_requests
  (id,registration_request_id,user_id,tenant_id,organization_id,business_name,provider_kind,status,specialties,service_areas,portfolio)
VALUES
  ('50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','MNTY-TEST-A','ORG-S05-TEST-A','Synthetic Provider A','SERVICES','PENDING','[]'::jsonb,'[]'::jsonb,'[]'::jsonb),
  ('50000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','MNTY-TEST-B','ORG-S05-TEST-B','Synthetic Provider B','SERVICES','PENDING','[]'::jsonb,'[]'::jsonb,'[]'::jsonb);

COMMIT;
