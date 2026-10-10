-- RC566 behavioral tests. Run only in disposable PostgreSQL.
INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,role,status,permissions) VALUES
 ('manager-a','10000000-0000-4000-8000-000000005661','TENANT-A','20000000-0000-4000-8000-000000005661','MANAGER','ACTIVE','{}'),
 ('owner-b','10000000-0000-4000-8000-000000005662','TENANT-B','20000000-0000-4000-8000-000000005662','OWNER','ACTIVE','{}'),
 ('inactive-a','10000000-0000-4000-8000-000000005663','TENANT-A','20000000-0000-4000-8000-000000005661','MANAGER','INACTIVE','{}'),
 ('platform-admin','10000000-0000-4000-8000-000000005664','MNTY-PLATFORM',NULL,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
 ('tenant-super','10000000-0000-4000-8000-000000005665','TENANT-B','20000000-0000-4000-8000-000000005662','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}');

INSERT INTO public.marketing_leads(id,requester_user_id,requester_business_id,title) VALUES
 ('30000000-0000-4000-8000-000000005661','10000000-0000-4000-8000-000000005669','20000000-0000-4000-8000-000000005661','Lead A'),
 ('30000000-0000-4000-8000-000000005662','10000000-0000-4000-8000-000000005668','20000000-0000-4000-8000-000000005662','Lead B');

INSERT INTO public.marketing_provider_profiles(id,business_id,owner_user_id,name_ar,status) VALUES
 ('40000000-0000-4000-8000-000000005661','20000000-0000-4000-8000-000000005661','10000000-0000-4000-8000-000000005669','Pending A','PENDING'),
 ('40000000-0000-4000-8000-000000005662','20000000-0000-4000-8000-000000005662','10000000-0000-4000-8000-000000005668','Pending B','PENDING'),
 ('40000000-0000-4000-8000-000000005663','20000000-0000-4000-8000-000000005662','10000000-0000-4000-8000-000000005668','Active Public B','ACTIVE');

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005661',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000005661","role":"authenticated","is_anonymous":false}',false);
SET ROLE authenticated;

DO $test$
DECLARE n integer;
BEGIN
  -- Manager A sees only A leads and non-public provider rows for A.
  SELECT count(*) INTO n FROM public.marketing_leads;
  IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.marketing_leads WHERE title='Lead A') THEN
    RAISE EXCEPTION 'business A manager must see only business A leads; count=%',n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_leads WHERE title='Lead B') THEN
    RAISE EXCEPTION 'business A manager read business B lead';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE name_ar='Pending B') THEN
    RAISE EXCEPTION 'business A manager read pending provider from business B';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE name_ar='Pending A') THEN
    RAISE EXCEPTION 'business A manager could not read own business pending provider';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE name_ar='Active Public B') THEN
    RAISE EXCEPTION 'existing public active-provider catalog path was unexpectedly broken';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005662',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000005662","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO n FROM public.marketing_leads;
  IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.marketing_leads WHERE title='Lead B') THEN
    RAISE EXCEPTION 'business B owner must see only business B leads; count=%',n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE name_ar='Pending A') THEN
    RAISE EXCEPTION 'business B owner read pending provider from business A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE name_ar='Pending B') THEN
    RAISE EXCEPTION 'business B owner could not read own business pending provider';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005663',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000005663","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO n FROM public.marketing_leads;
  IF n <> 0 THEN RAISE EXCEPTION 'inactive business membership must not grant CRM lead reads'; END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE name_ar='Pending A') THEN
    RAISE EXCEPTION 'inactive membership must not grant pending-provider reads';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005665',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000005665","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO n FROM public.marketing_leads;
  IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.marketing_leads WHERE title='Lead B') THEN
    RAISE EXCEPTION 'tenant-scoped SUPER_ADMIN must not gain platform-wide CRM read';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_leads WHERE title='Lead A') THEN
    RAISE EXCEPTION 'tenant-scoped SUPER_ADMIN read unrelated business lead';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005664',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000005664","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO n FROM public.marketing_leads;
  IF n <> 2 THEN RAISE EXCEPTION 'explicit platform admin should see all CRM leads; count=%',n; END IF;
  SELECT count(*) INTO n FROM public.marketing_provider_profiles WHERE status='PENDING';
  IF n <> 2 THEN RAISE EXCEPTION 'explicit platform admin should see pending provider profiles; count=%',n; END IF;
END;
$test$;

RESET ROLE;
SELECT 'RC566 CRM business read scope integration: PASS' AS result;
