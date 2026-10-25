-- Disposable-DB integration check for RC567 customer-page ownership RLS.
-- This test is intended only after the production-checkpoint migration replay and
-- the two-tenant synthetic fixture. It inserts synthetic rows and rolls them back.
\if :{?mantiqati_disposable}
  \if :mantiqati_disposable
    \echo 'Using explicit disposable-test authorization for digital-page RLS test.'
  \else
    \echo 'REFUSED: set -v mantiqati_disposable=on only for an isolated disposable database.'
    \quit 3
  \endif
\else
  \echo 'REFUSED: this fixture-dependent verifier requires -v mantiqati_disposable=on.'
  \quit 3
\endif

BEGIN;

-- The captured production-schema checkpoint intentionally has schema but not catalog seed data.
-- Create a deterministic synthetic package inside this transaction; the final ROLLBACK removes it.
INSERT INTO public.digital_page_products
  (page_type,code,name_ar,description_ar,price,currency,duration_days,features,active)
VALUES
  ('PORTFOLIO','RLS_TEST_PORTFOLIO','RLS test package','Disposable RLS integration fixture',1,'EGP',30,'[]'::jsonb,true)
ON CONFLICT (code) DO UPDATE
SET active=true, page_type='PORTFOLIO', price=1, currency='EGP', duration_days=30, features='[]'::jsonb;

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='20000000-0000-4000-8000-000000000001') OR
     NOT EXISTS (SELECT 1 FROM auth.users WHERE id='20000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_RLS_FIXTURE_USERS_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.digital_page_products WHERE page_type='PORTFOLIO' AND active=true) THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_RLS_FIXTURE_PRODUCT_MISSING';
  END IF;
END;
$preflight$;

-- Setup is performed as the disposable database owner, before assuming authenticated.
INSERT INTO public.digital_page_orders
  (id,user_id,product_id,page_type,title,slug,amount,currency,pricing_hash,idempotency_key,
   payment_status,fulfillment_status,metadata)
SELECT x.order_id, x.user_id, p.id, 'PORTFOLIO', x.title, x.slug, p.price, p.currency,
       'rls-fixture-v1', x.idempotency_key, 'PAID', 'PUBLISHED',
       '{"test_fixture":"digital_page_self_service_rls"}'::jsonb
FROM (VALUES
  ('41000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'RLS Test A','rls-test-a','rls-test-a-key'),
  ('41000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'RLS Test B','rls-test-b','rls-test-b-key')
) AS x(order_id,user_id,title,slug,idempotency_key)
CROSS JOIN public.digital_page_products p
WHERE p.id = (
  SELECT candidate.id
  FROM public.digital_page_products candidate
  WHERE candidate.page_type='PORTFOLIO' AND candidate.active=true
  ORDER BY candidate.code
  LIMIT 1
);

INSERT INTO public.digital_pages
  (id,page_type,owner_user_id,business_id,provider_profile_id,digital_page_order_id,slug,title,
   description,whatsapp_number,status,created_by,updated_by)
VALUES
  ('42000000-0000-4000-8000-000000000001','PORTFOLIO','20000000-0000-4000-8000-000000000001',NULL,NULL,'41000000-0000-4000-8000-000000000001','rls-test-a','RLS Test A','Synthetic private draft A','201010171771','DRAFT','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
  ('42000000-0000-4000-8000-000000000002','PORTFOLIO','20000000-0000-4000-8000-000000000002',NULL,NULL,'41000000-0000-4000-8000-000000000002','rls-test-b','RLS Test B','Synthetic private draft B','201010171772','DRAFT','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');

INSERT INTO public.digital_page_sections(page_id,section_type,sort_order,title,data,active)
VALUES
 ('42000000-0000-4000-8000-000000000001','ABOUT',1,'A private section','{"test_fixture":true}'::jsonb,true),
 ('42000000-0000-4000-8000-000000000002','ABOUT',1,'B private section','{"test_fixture":true}'::jsonb,true);

SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $user_a$
DECLARE
  own_pages bigint;
  cross_pages bigint;
  own_sections bigint;
  cross_sections bigint;
  changed_pages bigint;
  changed_sections bigint;
BEGIN
  SELECT count(*) INTO own_pages FROM public.digital_pages WHERE id='42000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO cross_pages FROM public.digital_pages WHERE id='42000000-0000-4000-8000-000000000002';
  SELECT count(*) INTO own_sections FROM public.digital_page_sections WHERE page_id='42000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO cross_sections FROM public.digital_page_sections WHERE page_id='42000000-0000-4000-8000-000000000002';

  IF own_pages<>1 OR own_sections<>1 THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_RLS_OWNER_A_CANNOT_READ_OWN_ROWS: pages=%, sections=%',own_pages,own_sections;
  END IF;
  IF cross_pages<>0 OR cross_sections<>0 THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_RLS_CROSS_ACCOUNT_READ: pages=%, sections=%',cross_pages,cross_sections;
  END IF;

  UPDATE public.digital_pages SET title='ILLEGAL CROSS ACCOUNT UPDATE'
   WHERE id='42000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS changed_pages = ROW_COUNT;
  UPDATE public.digital_page_sections SET title='ILLEGAL CROSS ACCOUNT UPDATE'
   WHERE page_id='42000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS changed_sections = ROW_COUNT;
  IF changed_pages<>0 OR changed_sections<>0 THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_RLS_CROSS_ACCOUNT_WRITE: pages=%, sections=%',changed_pages,changed_sections;
  END IF;

  RAISE NOTICE 'PASS: user A reads own draft and section; cannot read or update user B draft/section';
END;
$user_a$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;

DO $user_b$
DECLARE
  own_pages bigint;
  cross_pages bigint;
  own_sections bigint;
  cross_sections bigint;
BEGIN
  SELECT count(*) INTO own_pages FROM public.digital_pages WHERE id='42000000-0000-4000-8000-000000000002';
  SELECT count(*) INTO cross_pages FROM public.digital_pages WHERE id='42000000-0000-4000-8000-000000000001';
  SELECT count(*) INTO own_sections FROM public.digital_page_sections WHERE page_id='42000000-0000-4000-8000-000000000002';
  SELECT count(*) INTO cross_sections FROM public.digital_page_sections WHERE page_id='42000000-0000-4000-8000-000000000001';
  IF own_pages<>1 OR own_sections<>1 OR cross_pages<>0 OR cross_sections<>0 THEN
    RAISE EXCEPTION 'DIGITAL_PAGE_RLS_USER_B_SCOPE_FAILURE: own_pages=%, own_sections=%, cross_pages=%, cross_sections=%',
      own_pages,own_sections,cross_pages,cross_sections;
  END IF;
  RAISE NOTICE 'PASS: user B reads own draft and section; cannot read user A draft/section';
END;
$user_b$;

ROLLBACK;
