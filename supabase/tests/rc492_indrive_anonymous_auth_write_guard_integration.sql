-- RC492 isolated integration. Run only after the complete disposable forward migration replay.
-- Each JWT scenario uses a separate transaction, matching Supabase's per-request claim
-- lifecycle and preventing transaction-local claim changes from contaminating later cases.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
VALUES
  ('49200000-0000-4000-8000-000000000001','authenticated','authenticated',
   'rc492-indrive@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rc492_fixture":true}'::jsonb,now(),now(),false,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
VALUES
  ('49200000-0000-4000-8000-000000000002','authenticated','authenticated',
   'rc492-indrive-owner@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rc492_fixture":true}'::jsonb,now(),now(),false,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.indrive_requests
  (id,owner_user_id,domain_type,category_name,title,details_description,
   user_proposed_price,target_provider_type,status)
VALUES
  ('49200000-0000-4000-8000-000000000011',
   '49200000-0000-4000-8000-000000000001',
   'SERVICE','RC492','Synthetic request','Synthetic privacy fixture',
   100,'PROVIDER','OPEN_FOR_BIDS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.indrive_requests
  (id,owner_user_id,domain_type,category_name,title,details_description,
   user_proposed_price,target_provider_type,status)
VALUES
  ('49200000-0000-4000-8000-000000000013',
   '49200000-0000-4000-8000-000000000002',
   'SERVICE','RC492','Bid privacy request','Synthetic bid privacy fixture',
   100,'PROVIDER','OPEN_FOR_BIDS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.indrive_bids
  (id,request_id,provider_user_id,provider_name,provider_type,offered_price)
VALUES
  ('49200000-0000-4000-8000-000000000014',
   '49200000-0000-4000-8000-000000000013',
   '49200000-0000-4000-8000-000000000001',
   'Synthetic provider','PROVIDER',90)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Anonymous Auth session: owner DELETE and provider bid SELECT must both be denied.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49200000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous$
DECLARE n integer;
BEGIN
  DELETE FROM public.indrive_requests
  WHERE id='49200000-0000-4000-8000-000000000011';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'RC492_ANONYMOUS_INDRIVE_DELETE_SUCCEEDED:%',n; END IF;

  SELECT count(*) INTO n FROM public.indrive_bids
  WHERE id='49200000-0000-4000-8000-000000000014';
  IF n <> 0 THEN RAISE EXCEPTION 'RC492_ANONYMOUS_INDRIVE_BID_READ_SUCCEEDED:%',n; END IF;
END;
$anonymous$;
RESET ROLE;
COMMIT;

-- Missing is_anonymous claim: fail closed for bid visibility.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49200000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
DO $missing_claim$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.indrive_bids
  WHERE id='49200000-0000-4000-8000-000000000014';
  IF n <> 0 THEN RAISE EXCEPTION 'RC492_MISSING_ANONYMOUS_CLAIM_BID_READ_SUCCEEDED:%',n; END IF;
END;
$missing_claim$;
RESET ROLE;
COMMIT;

-- Confirmed Auth session: existing owner deletion and provider bid visibility remain intact.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49200000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed$
DECLARE n integer;
BEGIN
  DELETE FROM public.indrive_requests
  WHERE id='49200000-0000-4000-8000-000000000011';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'RC492_CONFIRMED_OWNER_DELETE_REGRESSED:%',n; END IF;

  SELECT count(*) INTO n FROM public.indrive_bids
  WHERE id='49200000-0000-4000-8000-000000000014';
  IF n <> 1 THEN RAISE EXCEPTION 'RC492_CONFIRMED_PROVIDER_BID_READ_REGRESSED:%',n; END IF;
END;
$confirmed$;
RESET ROLE;
COMMIT;

-- Remove only the synthetic fixture rows.
DELETE FROM public.indrive_bids WHERE id='49200000-0000-4000-8000-000000000014';
DELETE FROM public.indrive_requests
WHERE id IN (
  '49200000-0000-4000-8000-000000000011',
  '49200000-0000-4000-8000-000000000013'
);
DELETE FROM auth.users
WHERE id IN (
  '49200000-0000-4000-8000-000000000001',
  '49200000-0000-4000-8000-000000000002'
);

SELECT 'RC492 InDrive anonymous Auth read/delete isolation: PASS' AS result;
