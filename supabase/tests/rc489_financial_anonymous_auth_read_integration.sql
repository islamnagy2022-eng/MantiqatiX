-- RC489 isolated integration. Run only after the complete disposable forward migration replay.
BEGIN;

DO $fixture$
DECLARE
  v_business uuid;
BEGIN
  SELECT b.id INTO v_business
  FROM public.businesses b
  WHERE b.tenant_id='MNTY-PLATFORM'
  ORDER BY b.id
  LIMIT 1;
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'RC489_FIXTURE_BUSINESS_MISSING';
  END IF;

  INSERT INTO auth.users
    (id,aud,role,email,encrypted_password,email_confirmed_at,
     raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
  VALUES
    ('48900000-0000-4000-8000-000000000001','authenticated','authenticated',
     'rc489-anonymous@example.invalid','',now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"rc489_fixture":true}'::jsonb,now(),now(),false,false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_memberships
    (id,user_id,tenant_id,business_id,role,status)
  VALUES
    ('RC489-FINANCE-ANON-FIXTURE',
     '48900000-0000-4000-8000-000000000001',
     'MNTY-PLATFORM',v_business,'FINANCE','ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.commission_rules
    (id,tenant_id,business_id,module_id,rule_type,percentage,fixed_amount,per_item_amount,active)
  VALUES
    ('RC489-ANON-GUARD','MNTY-PLATFORM',v_business,NULL,'PERCENTAGE',5,0,0,true)
  ON CONFLICT (id) DO NOTHING;
END;
$fixture$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48900000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.commission_rules WHERE id='RC489-ANON-GUARD';
  IF n <> 0 THEN
    RAISE EXCEPTION 'RC489_ANONYMOUS_FINANCE_TABLE_READ_SUCCEEDED:%',n;
  END IF;
END;
$anonymous$;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48900000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
DO $missing_claim$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.commission_rules WHERE id='RC489-ANON-GUARD';
  IF n <> 0 THEN RAISE EXCEPTION 'RC489_MISSING_ANONYMOUS_CLAIM_READ_SUCCEEDED:%',n; END IF;
END;
$missing_claim$;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48900000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.commission_rules WHERE id='RC489-ANON-GUARD';
  IF n <> 1 THEN
    RAISE EXCEPTION 'RC489_CONFIRMED_FINANCE_MEMBER_READ_REGRESSED:%',n;
  END IF;
END;
$confirmed$;
RESET ROLE;

DO $policy_inventory$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(t.table_name ORDER BY t.table_name)
  INTO v_missing
  FROM unnest(ARRAY['commission_rules','commission_transactions','general_ledger','journal_entries','journal_entry_lines','payment_events','payment_financial_reconciliations','payment_intents','payment_provider_events','refund_transactions','settlement_attempts','settlement_transactions','subscription_payment_intents','wallet_accounts','wallet_transactions']::text[]) AS t(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname='public' AND p.tablename=t.table_name
      AND p.policyname='mnty_confirmed_auth_financial_read'
      AND p.cmd='SELECT' AND p.permissive='RESTRICTIVE'
      AND 'authenticated'=ANY(p.roles)
      AND p.qual ~* 'is_anonymous'
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC489_FINANCIAL_ANONYMOUS_GUARDS_MISSING:%',v_missing;
  END IF;
END;
$policy_inventory$;

ROLLBACK;
SELECT 'RC489 financial anonymous Auth read isolation: PASS' AS result;
