-- RC491 isolated integration. Run only after the complete disposable forward migration replay.
BEGIN;

DO $fixture$
DECLARE v_business uuid;
BEGIN
  SELECT b.id INTO v_business FROM public.businesses b
  WHERE b.tenant_id='MNTY-PLATFORM' ORDER BY b.id LIMIT 1;
  IF v_business IS NULL THEN RAISE EXCEPTION 'RC491_FIXTURE_BUSINESS_MISSING'; END IF;

  INSERT INTO auth.users
    (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
  VALUES
    ('49100000-0000-4000-8000-000000000001','authenticated','authenticated',
     'rc491-support@example.invalid','',now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"rc491_fixture":true}'::jsonb,now(),now(),false,false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,role,status)
  VALUES ('RC491-SUPPORT-MEMBER-FIXTURE',
    '49100000-0000-4000-8000-000000000001','MNTY-PLATFORM',v_business,'SUPPORT','ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.support_tickets
    (id,tenant_id,requester_id,business_id,subject,description,status)
  VALUES ('RC491-ANON-TICKET','MNTY-PLATFORM',
    '49100000-0000-4000-8000-000000000001',v_business,
    'RC491 synthetic support ticket','synthetic privacy fixture','OPEN')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ticket_messages
    (id,ticket_id,sender_user_id,sender_role,content)
  VALUES ('RC491-ANON-MESSAGE','RC491-ANON-TICKET',
    '49100000-0000-4000-8000-000000000001','CUSTOMER','synthetic private message')
  ON CONFLICT (id) DO NOTHING;
END;
$fixture$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous$
DECLARE n integer; denied boolean;
BEGIN
  SELECT count(*) INTO n FROM public.support_tickets WHERE id='RC491-ANON-TICKET';
  IF n <> 0 THEN RAISE EXCEPTION 'RC491_ANONYMOUS_SUPPORT_TICKET_READ_SUCCEEDED:%',n; END IF;
  SELECT count(*) INTO n FROM public.ticket_messages WHERE id='RC491-ANON-MESSAGE';
  IF n <> 0 THEN RAISE EXCEPTION 'RC491_ANONYMOUS_SUPPORT_MESSAGE_READ_SUCCEEDED:%',n; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.ticket_messages(id,ticket_id,sender_user_id,sender_role,content)
    VALUES ('RC491-ANON-MESSAGE-2','RC491-ANON-TICKET',
      '49100000-0000-4000-8000-000000000001','CUSTOMER','should be denied');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'RC491_ANONYMOUS_SUPPORT_MESSAGE_INSERT_SUCCEEDED'; END IF;
END;
$anonymous$;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.support_tickets WHERE id='RC491-ANON-TICKET';
  IF n <> 1 THEN RAISE EXCEPTION 'RC491_CONFIRMED_SUPPORT_TICKET_READ_REGRESSED:%',n; END IF;
  SELECT count(*) INTO n FROM public.ticket_messages WHERE id='RC491-ANON-MESSAGE';
  IF n <> 1 THEN RAISE EXCEPTION 'RC491_CONFIRMED_SUPPORT_MESSAGE_READ_REGRESSED:%',n; END IF;
END;
$confirmed$;
RESET ROLE;

ROLLBACK;
SELECT 'RC491 support anonymous Auth privacy: PASS' AS result;
