-- RC494 integration: platform registry authority and tenant/business settlement scopes.
-- Synthetic identities and ledger references only; the enclosing transaction is rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,
   raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
VALUES
  ('49400000-0000-4000-8000-000000000001','authenticated','authenticated','rc494-platform-root@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc494_fixture":true}'::jsonb,now(),now(),false,false),
  ('49400000-0000-4000-8000-000000000002','authenticated','authenticated','rc494-fake-platform-member@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc494_fixture":true}'::jsonb,now(),now(),false,false),
  ('49400000-0000-4000-8000-000000000003','authenticated','authenticated','rc494-business-finance@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc494_fixture":true}'::jsonb,now(),now(),false,false),
  ('49400000-0000-4000-8000-000000000004','authenticated','authenticated','rc494-tenant-finance@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc494_fixture":true}'::jsonb,now(),now(),false,false),
  ('49400000-0000-4000-8000-000000000005','authenticated','authenticated','rc494-branch-finance@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc494_fixture":true}'::jsonb,now(),now(),false,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants(id,name,code,status,settings)
VALUES
 ('MNTY-PLATFORM','RC494 MantiqaTix Platform Fixture','RC494-PLATFORM','ACTIVE','{}'::jsonb),
 ('RC494-TENANT','RC494 isolated settlement tenant','RC494-TENANT','ACTIVE','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.businesses(id,tenant_id,name,code,status,settings)
VALUES
 ('49400000-0000-4000-8000-000000000101','RC494-TENANT','RC494 Business A','RC494-BUSINESS-A','INACTIVE','{}'::jsonb),
 ('49400000-0000-4000-8000-000000000102','RC494-TENANT','RC494 Business B','RC494-BUSINESS-B','INACTIVE','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.platform_admins(user_id)
VALUES ('49400000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.branches(id,tenant_id,organization_id,business_id,name,code,status,settings)
VALUES ('RC494-BRANCH','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101','RC494 branch','RC494-BRANCH','ACTIVE','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_memberships
  (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status,created_at)
VALUES
 ('RC494-FAKE-PLATFORM-MEMBERSHIP','49400000-0000-4000-8000-000000000002','MNTY-PLATFORM',NULL,NULL,NULL,'SUPER_ADMIN','{"scope":"PLATFORM","full_control":true}'::jsonb,'ACTIVE',now()-interval '1 day'),
 ('RC494-BUSINESS-FINANCE-MEMBERSHIP','49400000-0000-4000-8000-000000000003','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,'ACCOUNTANT','{}'::jsonb,'ACTIVE',now()-interval '1 day'),
 ('RC494-TENANT-FINANCE-MEMBERSHIP','49400000-0000-4000-8000-000000000004','RC494-TENANT',NULL,NULL,NULL,'FINANCE_MANAGER','{}'::jsonb,'ACTIVE',now()-interval '1 day'),
 ('RC494-BRANCH-FINANCE-MEMBERSHIP','49400000-0000-4000-8000-000000000005','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101','RC494-BRANCH','ACCOUNTANT','{}'::jsonb,'ACTIVE',now()-interval '1 day'),
 ('RC494-BUSINESS-A-OWNER','49400000-0000-4000-8000-000000000001','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,'OWNER','{}'::jsonb,'ACTIVE',now()-interval '2 days'),
 ('RC494-BUSINESS-B-OWNER','49400000-0000-4000-8000-000000000002','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000102',NULL,'OWNER','{}'::jsonb,'ACTIVE',now()-interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Use the schema-supported INACTIVE state (businesses_status_check excludes DRAFT),
-- then satisfy the real activation gate: each business has an active owner first.
UPDATE public.businesses SET status='ACTIVE'
WHERE id IN ('49400000-0000-4000-8000-000000000101','49400000-0000-4000-8000-000000000102')
  AND status <> 'ACTIVE';

INSERT INTO public.chart_of_accounts(id,tenant_id,account_code,account_name,account_type,is_active)
SELECT v.id,v.tenant_id,v.account_code,v.account_name,v.account_type,true
FROM (VALUES
 ('RC494-PLATFORM-2010','MNTY-PLATFORM','2010','Merchant payable','LIABILITY'),
 ('RC494-PLATFORM-1020','MNTY-PLATFORM','1020','Cash payout','ASSET'),
 ('RC494-PLATFORM-2050','MNTY-PLATFORM','2050','Voucher reserve','LIABILITY'),
 ('RC494-PLATFORM-5030','MNTY-PLATFORM','5030','Partner commission expense','EXPENSE'),
 ('RC494-TENANT-2010','RC494-TENANT','2010','Merchant payable','LIABILITY'),
 ('RC494-TENANT-1020','RC494-TENANT','1020','Cash payout','ASSET'),
 ('RC494-TENANT-2050','RC494-TENANT','2050','Voucher reserve','LIABILITY'),
 ('RC494-TENANT-5030','RC494-TENANT','5030','Partner commission expense','EXPENSE')
) AS v(id,tenant_id,account_code,account_name,account_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts c
  WHERE c.tenant_id=v.tenant_id AND c.account_code=v.account_code
);

UPDATE public.chart_of_accounts
SET is_active=true
WHERE tenant_id IN ('MNTY-PLATFORM','RC494-TENANT')
  AND account_code IN ('2010','1020','2050','5030');

INSERT INTO public.journal_entries
  (id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
   description,status,total_debit,total_credit,entry_date,posted_at,created_by)
VALUES
 ('je_RC494-PLATFORM-ROOT','MNTY-PLATFORM',NULL,NULL,NULL,'JE-RC494-PLATFORM-ROOT','PARTNER_COMMISSION_SETTLEMENT','RC494-PLATFORM-ROOT','RC494 idempotent platform fixture','DRAFT',0,0,current_date,NULL,'49400000-0000-4000-8000-000000000001'),
 ('je_RC494-FAKE-ROOT','MNTY-PLATFORM',NULL,NULL,NULL,'JE-RC494-FAKE-ROOT','PARTNER_COMMISSION_SETTLEMENT','RC494-FAKE-ROOT','RC494 fake platform fixture','DRAFT',0,0,current_date,NULL,'49400000-0000-4000-8000-000000000002'),
 ('je_RC494-TENANT-BUSINESS','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,'JE-RC494-TENANT-BUSINESS','ORDER_SETTLEMENT','RC494-TENANT-BUSINESS','RC494 business fixture','DRAFT',0,0,current_date,NULL,'49400000-0000-4000-8000-000000000003'),
 ('je_RC494-TENANT-WIDE','RC494-TENANT',NULL,NULL,NULL,'JE-RC494-TENANT-WIDE','PARTNER_COMMISSION_SETTLEMENT','RC494-TENANT-WIDE','RC494 tenant fixture','DRAFT',0,0,current_date,NULL,'49400000-0000-4000-8000-000000000004'),
 ('je_RC494-PREEXISTING-CONFLICT','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000102',NULL,'JE-RC494-PREEXISTING-CONFLICT','ORDER_SETTLEMENT','RC494-PREEXISTING-CONFLICT','RC494 conflicting draft journal','DRAFT',0,0,current_date,NULL,'49400000-0000-4000-8000-000000000003'),
 ('je_RC494-IDEMPOTENT-LINE-CONFLICT','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,'JE-RC494-IDEMPOTENT-LINE-CONFLICT','ORDER_SETTLEMENT','RC494-IDEMPOTENT-LINE-CONFLICT','RC494 idempotent settled header with bad journal lines','DRAFT',0,0,current_date,NULL,'49400000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- Matching journal header with balanced but incorrect pre-existing amounts.
-- RC494 must reject the line identity mismatch before posting or settling.
INSERT INTO public.journal_entries
  (id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
   description,status,total_debit,total_credit,entry_date,posted_at,created_by)
VALUES
 ('je_RC494-PREEXISTING-LINE-CONFLICT','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,
  'JE-RC494-PREEXISTING-LINE-CONFLICT','ORDER_SETTLEMENT','RC494-PREEXISTING-LINE-CONFLICT',
  'RC494 matching header with conflicting journal lines','DRAFT',0,0,current_date,NULL,
  '49400000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-PREEXISTING-LINE-CONFLICT_2010','je_RC494-PREEXISTING-LINE-CONFLICT',c.id,1,90,0,'Wrong debit amount'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='2010';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-PREEXISTING-LINE-CONFLICT_1020','je_RC494-PREEXISTING-LINE-CONFLICT',c.id,2,0,90,'Wrong credit amount'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='1020';

INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-IDEMPOTENT-LINE-CONFLICT_2010','je_RC494-IDEMPOTENT-LINE-CONFLICT',c.id,1,90,0,'Wrong debit amount'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='2010';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-IDEMPOTENT-LINE-CONFLICT_1020','je_RC494-IDEMPOTENT-LINE-CONFLICT',c.id,2,0,90,'Wrong credit amount'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='1020';

INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-PLATFORM-ROOT_5030','je_RC494-PLATFORM-ROOT',c.id,1,100,0,'Partner commission expense'
FROM public.chart_of_accounts c WHERE c.tenant_id='MNTY-PLATFORM' AND c.account_code='5030';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-PLATFORM-ROOT_1020','je_RC494-PLATFORM-ROOT',c.id,2,0,99,'Partner cash payout'
FROM public.chart_of_accounts c WHERE c.tenant_id='MNTY-PLATFORM' AND c.account_code='1020';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-PLATFORM-ROOT_2050','je_RC494-PLATFORM-ROOT',c.id,3,0,1,'Partner voucher reserve'
FROM public.chart_of_accounts c WHERE c.tenant_id='MNTY-PLATFORM' AND c.account_code='2050';

INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-FAKE-ROOT_5030','je_RC494-FAKE-ROOT',c.id,1,100,0,'Partner commission expense'
FROM public.chart_of_accounts c WHERE c.tenant_id='MNTY-PLATFORM' AND c.account_code='5030';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-FAKE-ROOT_1020','je_RC494-FAKE-ROOT',c.id,2,0,99,'Partner cash payout'
FROM public.chart_of_accounts c WHERE c.tenant_id='MNTY-PLATFORM' AND c.account_code='1020';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-FAKE-ROOT_2050','je_RC494-FAKE-ROOT',c.id,3,0,1,'Partner voucher reserve'
FROM public.chart_of_accounts c WHERE c.tenant_id='MNTY-PLATFORM' AND c.account_code='2050';

INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-TENANT-BUSINESS_2010','je_RC494-TENANT-BUSINESS',c.id,1,100,0,'RC494 merchant payable'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='2010';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-TENANT-BUSINESS_1020','je_RC494-TENANT-BUSINESS',c.id,2,0,100,'RC494 merchant payout'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='1020';

INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-TENANT-WIDE_5030','je_RC494-TENANT-WIDE',c.id,1,100,0,'Partner commission expense'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='5030';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-TENANT-WIDE_1020','je_RC494-TENANT-WIDE',c.id,2,0,99,'Partner cash payout'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='1020';
INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
SELECT 'jel_RC494-TENANT-WIDE_2050','je_RC494-TENANT-WIDE',c.id,3,0,1,'Partner voucher reserve'
FROM public.chart_of_accounts c WHERE c.tenant_id='RC494-TENANT' AND c.account_code='2050';

-- Preserve the 90/90 conflicting journal while it is still a draft.
-- Posted journal headers are immutable; the later idempotency test must reject
-- the balanced 90/90 lines because the settled transaction requires 100/100.
UPDATE public.journal_entries
SET total_debit=90,total_credit=90
WHERE id='je_RC494-IDEMPOTENT-LINE-CONFLICT';

UPDATE public.journal_entries
SET status='POSTED',total_debit=100,total_credit=100,posted_at=now()
WHERE id IN ('je_RC494-PLATFORM-ROOT','je_RC494-FAKE-ROOT','je_RC494-TENANT-BUSINESS','je_RC494-TENANT-WIDE');

UPDATE public.journal_entries
SET status='POSTED',posted_at=now()
WHERE id='je_RC494-IDEMPOTENT-LINE-CONFLICT';

INSERT INTO public.settlement_transactions
  (id,tenant_id,business_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,
   payout_channel,journal_entry_id,status,reference_id)
VALUES
 ('RC494-PLATFORM-ROOT','MNTY-PLATFORM',NULL,'PARTNER','partner-platform-root',100,0,99,1,'BANK_TRANSFER','je_RC494-PLATFORM-ROOT','SETTLED','RC494-PLATFORM-ROOT'),
 ('RC494-FAKE-ROOT','MNTY-PLATFORM',NULL,'PARTNER','partner-fake-root',100,0,99,1,'BANK_TRANSFER','je_RC494-FAKE-ROOT','SETTLED','RC494-FAKE-ROOT'),
 ('RC494-TENANT-BUSINESS','RC494-TENANT','49400000-0000-4000-8000-000000000101','MERCHANT','merchant-business-a',100,0,100,0,'BANK_TRANSFER','je_RC494-TENANT-BUSINESS','SETTLED','RC494-TENANT-BUSINESS'),
 ('RC494-TENANT-WIDE','RC494-TENANT',NULL,'PARTNER','partner-tenant-wide',100,0,99,1,'BANK_TRANSFER','je_RC494-TENANT-WIDE','SETTLED','RC494-TENANT-WIDE'),
 ('RC494-IDEMPOTENT-LINE-CONFLICT','RC494-TENANT','49400000-0000-4000-8000-000000000101','MERCHANT','merchant-business-a',100,0,100,0,'BANK_TRANSFER','je_RC494-IDEMPOTENT-LINE-CONFLICT','SETTLED','RC494-IDEMPOTENT-LINE-CONFLICT'),
 ('RC494-CANCELLED','RC494-TENANT','49400000-0000-4000-8000-000000000101','MERCHANT','merchant-business-a',100,0,100,0,'BANK_TRANSFER',NULL,'CANCELLED','RC494-CANCELLED')
ON CONFLICT (id) DO NOTHING;

DO $rc494_source_contract$
DECLARE
  v_definition text;
  v_line_guard_count integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid)'::regprocedure
  ) INTO v_definition;

  v_line_guard_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition,'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH',''))
  ) / pg_catalog.length('SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH');

  IF pg_catalog.strpos(v_definition,'pg_advisory_xact_lock')=0
     OR pg_catalog.strpos(v_definition,'settlement:')=0
     OR v_line_guard_count < 2 THEN
    RAISE EXCEPTION 'RC494_SETTLEMENT_IDEMPOTENCY_GUARDS_MISSING';
  END IF;
END;
$rc494_source_contract$;

SET LOCAL ROLE service_role;

DO $rc494$
DECLARE
  v_result jsonb;
BEGIN
  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-CANCELLED','RC494-TENANT','MERCHANT','merchant-business-a',
      100,0,100,0,'BANK_TRANSFER','RC494-CANCELLED',
      '49400000-0000-4000-8000-000000000101','cancelled settlement must never be resurrected',
      '49400000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'RC494_CANCELLED_SETTLEMENT_WAS_RESURRECTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'SETTLEMENT_NOT_RETRYABLE' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.settlement_transactions
    WHERE id='RC494-CANCELLED' AND status='CANCELLED' AND journal_entry_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.journal_entries WHERE id='je_RC494-CANCELLED'
  ) THEN
    RAISE EXCEPTION 'RC494_CANCELLED_SETTLEMENT_WAS_MUTATED';
  END IF;

  v_result := public.create_settlement_and_post_journal(
    'RC494-PLATFORM-NEW','MNTY-PLATFORM','PARTNER','partner-platform-new',
    100,0,99,1,'BANK_TRANSFER','RC494-PLATFORM-NEW',NULL,'registry root new settlement test',
    '49400000-0000-4000-8000-000000000001'
  );
  IF v_result->>'status' <> 'SETTLED' OR v_result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ROOT_NEW_SETTLEMENT_FAILED:%',v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.settlement_transactions st
    JOIN public.journal_entries je ON je.id=st.journal_entry_id
    WHERE st.id='RC494-PLATFORM-NEW' AND st.business_id IS NULL
      AND je.tenant_id='MNTY-PLATFORM' AND je.status='POSTED'
      AND EXISTS (SELECT 1 FROM public.general_ledger gl WHERE gl.journal_entry_id=je.id)
  ) THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ROOT_NEW_SETTLEMENT_SCOPE_NOT_PERSISTED';
  END IF;

  v_result := public.create_settlement_and_post_journal(
    'RC494-BUSINESS-NEW','RC494-TENANT','MERCHANT','merchant-business-a',
    100,0,100,0,'BANK_TRANSFER','RC494-BUSINESS-NEW',
    '49400000-0000-4000-8000-000000000101','business scoped new settlement test',
    '49400000-0000-4000-8000-000000000003'
  );
  IF v_result->>'status' <> 'SETTLED' OR v_result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'RC494_BUSINESS_NEW_SETTLEMENT_FAILED:%',v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.settlement_transactions st
    JOIN public.journal_entries je ON je.id=st.journal_entry_id
    WHERE st.id='RC494-BUSINESS-NEW'
      AND st.business_id='49400000-0000-4000-8000-000000000101'
      AND je.business_id='49400000-0000-4000-8000-000000000101'
      AND je.status='POSTED'
      AND EXISTS (SELECT 1 FROM public.general_ledger gl WHERE gl.journal_entry_id=je.id)
  ) THEN
    RAISE EXCEPTION 'RC494_BUSINESS_NEW_SETTLEMENT_SCOPE_NOT_PERSISTED';
  END IF;

  BEGIN
    v_result := public.create_settlement_and_post_journal(
      'RC494-PLATFORM-ROOT','MNTY-PLATFORM','PARTNER','partner-platform-root',
      100,0,99,1,'BANK_TRANSFER','RC494-PLATFORM-ROOT',NULL,'registry root idempotency test',
      '49400000-0000-4000-8000-000000000001'
    );
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ROOT_INITIAL_RETRY_DIAGNOSTIC:%',
      jsonb_build_object(
        'cause',SQLERRM,
        'accounts',(SELECT jsonb_object_agg(account_code,id)
          FROM public.chart_of_accounts
          WHERE tenant_id='MNTY-PLATFORM' AND account_code IN ('1020','2050','5030')),
        'lines',(SELECT jsonb_agg(jsonb_build_object(
          'id',id,'account_id',account_id,'line_number',line_number,
          'debit',debit,'credit',credit,'description',description
        ) ORDER BY line_number)
          FROM public.journal_entry_lines
          WHERE journal_entry_id='je_RC494-PLATFORM-ROOT'),
        'line_count',(SELECT count(*) FROM public.journal_entry_lines
          WHERE journal_entry_id='je_RC494-PLATFORM-ROOT')
      );
  END;
  IF v_result->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RC494_REGISTERED_PLATFORM_ROOT_WITHOUT_MEMBERSHIP_DENIED:%',v_result;
  END IF;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-FAKE-ROOT','MNTY-PLATFORM','PARTNER','partner-fake-root',
      100,0,99,1,'BANK_TRANSFER','RC494-FAKE-ROOT',NULL,'membership-only root must fail',
      '49400000-0000-4000-8000-000000000002'
    );
    RAISE EXCEPTION 'RC494_MEMBERSHIP_ONLY_PLATFORM_ADMIN_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'PLATFORM_ADMIN_REQUIRED' THEN RAISE; END IF;
  END;

  v_result := public.create_settlement_and_post_journal(
    'RC494-TENANT-BUSINESS','RC494-TENANT','MERCHANT','merchant-business-a',
    100,0,100,0,'BANK_TRANSFER','RC494-TENANT-BUSINESS',
    '49400000-0000-4000-8000-000000000101','business-scoped finance test',
    '49400000-0000-4000-8000-000000000003'
  );
  IF v_result->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RC494_BUSINESS_FINANCE_SCOPE_REGRESSED:%',v_result;
  END IF;

  -- Another independently authorized business owner may safely retry the same
  -- completed settlement; the original journal creator is not the caller identity.
  v_result := public.create_settlement_and_post_journal(
    'RC494-TENANT-BUSINESS','RC494-TENANT','MERCHANT','merchant-business-a',
    100,0,100,0,'BANK_TRANSFER','RC494-TENANT-BUSINESS',
    '49400000-0000-4000-8000-000000000101','other authorized owner idempotent retry',
    '49400000-0000-4000-8000-000000000001'
  );
  IF v_result->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RC494_OTHER_AUTHORIZED_OWNER_IDEMPOTENT_RETRY_FAILED:%',v_result;
  END IF;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-CROSS-BUSINESS','RC494-TENANT','MERCHANT','merchant-business-b',
      100,0,100,0,'BANK_TRANSFER','RC494-CROSS-BUSINESS',
      '49400000-0000-4000-8000-000000000102','cross-business access must fail',
      '49400000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'RC494_CROSS_BUSINESS_SETTLEMENT_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'BUSINESS_SCOPE_DENIED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-BUSINESS-TENANT-WIDE','RC494-TENANT','PARTNER','partner-business-actor',
      100,0,100,0,'BANK_TRANSFER','RC494-BUSINESS-TENANT-WIDE',
      NULL,'business role must not settle the whole tenant',
      '49400000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'RC494_BUSINESS_ROLE_TENANT_WIDE_SETTLEMENT_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'TENANT_FINANCE_SCOPE_REQUIRED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-PREEXISTING-CONFLICT','RC494-TENANT','MERCHANT','merchant-business-a',
      100,0,100,0,'BANK_TRANSFER','RC494-PREEXISTING-CONFLICT',
      '49400000-0000-4000-8000-000000000101','pre-existing mismatched journal must fail',
      '49400000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'RC494_PREEXISTING_JOURNAL_CONFLICT_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'SETTLEMENT_IDENTITY_MISMATCH' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-PREEXISTING-LINE-CONFLICT','RC494-TENANT','MERCHANT','merchant-business-a',
      100,0,100,0,'BANK_TRANSFER','RC494-PREEXISTING-LINE-CONFLICT',
      '49400000-0000-4000-8000-000000000101','pre-existing balanced but mismatched lines must fail',
      '49400000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'RC494_PREEXISTING_JOURNAL_LINE_CONFLICT_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH' THEN RAISE; END IF;
  END;
  IF EXISTS (
    SELECT 1 FROM public.settlement_transactions
    WHERE id='RC494-PREEXISTING-LINE-CONFLICT'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE id='je_RC494-PREEXISTING-LINE-CONFLICT' AND status='DRAFT'
  ) OR EXISTS (
    SELECT 1 FROM public.general_ledger
    WHERE journal_entry_id='je_RC494-PREEXISTING-LINE-CONFLICT'
  ) THEN
    RAISE EXCEPTION 'RC494_PREEXISTING_JOURNAL_LINE_CONFLICT_MUTATED_LEDGER';
  END IF;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-BRANCH-SCOPE','RC494-TENANT','MERCHANT','merchant-branch-scope',
      100,0,100,0,'BANK_TRANSFER','RC494-BRANCH-SCOPE',
      '49400000-0000-4000-8000-000000000101','branch-scoped finance must fail',
      '49400000-0000-4000-8000-000000000005'
    );
    RAISE EXCEPTION 'RC494_BRANCH_SCOPED_SETTLEMENT_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'BUSINESS_SCOPE_DENIED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-IDEMPOTENT-LINE-CONFLICT','RC494-TENANT','MERCHANT','merchant-business-a',
      100,0,100,0,'BANK_TRANSFER','RC494-IDEMPOTENT-LINE-CONFLICT',
      '49400000-0000-4000-8000-000000000101','settled idempotent retry with altered posted lines must fail',
      '49400000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'RC494_IDEMPOTENT_JOURNAL_LINE_CONFLICT_SUCCEEDED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.journal_entry_lines
      WHERE journal_entry_id='je_RC494-IDEMPOTENT-LINE-CONFLICT') <> 2
     OR (SELECT count(*) FROM public.general_ledger
         WHERE journal_entry_id='je_RC494-IDEMPOTENT-LINE-CONFLICT') <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.settlement_transactions
       WHERE id='RC494-IDEMPOTENT-LINE-CONFLICT'
         AND status='SETTLED'
         AND journal_entry_id='je_RC494-IDEMPOTENT-LINE-CONFLICT'
     ) THEN
    RAISE EXCEPTION 'RC494_IDEMPOTENT_JOURNAL_LINE_CONFLICT_MUTATED_LEDGER';
  END IF;

  BEGIN
    v_result := public.create_settlement_and_post_journal(
      'RC494-TENANT-WIDE','RC494-TENANT','PARTNER','partner-tenant-wide',
      100,0,99,1,'BANK_TRANSFER','RC494-TENANT-WIDE',
      NULL,'tenant-scoped finance test',
      '49400000-0000-4000-8000-000000000004'
    );
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'RC494_TENANT_WIDE_RETRY_DIAGNOSTIC:%',
      jsonb_build_object(
        'cause',SQLERRM,
        'accounts',(SELECT jsonb_object_agg(account_code,id)
          FROM public.chart_of_accounts
          WHERE tenant_id='RC494-TENANT' AND account_code IN ('1020','2050','5030')),
        'lines',(SELECT jsonb_agg(jsonb_build_object(
          'id',id,'account_id',account_id,'line_number',line_number,
          'debit',debit,'credit',credit,'description',description
        ) ORDER BY line_number)
          FROM public.journal_entry_lines
          WHERE journal_entry_id='je_RC494-TENANT-WIDE'),
        'line_count',(SELECT count(*) FROM public.journal_entry_lines
          WHERE journal_entry_id='je_RC494-TENANT-WIDE')
      );
  END;
  IF v_result->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RC494_TENANT_FINANCE_SCOPE_REGRESSED:%',v_result;
  END IF;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-PLATFORM-ROOT','MNTY-PLATFORM','PARTNER','different-beneficiary',
      100,0,100,0,'BANK_TRANSFER','RC494-IDEMPOTENCY-MISMATCH',NULL,
      'idempotency identity mismatch test',
      '49400000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'RC494_IDEMPOTENCY_MISMATCH_WAS_ACCEPTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'SETTLEMENT_IDENTITY_MISMATCH' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-PLATFORM-ROOT','MNTY-PLATFORM','PARTNER','partner-platform-root',
      120,0,120,0,'BANK_TRANSFER','RC494-PLATFORM-ROOT',NULL,
      'idempotency amount mismatch test',
      '49400000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'RC494_IDEMPOTENCY_AMOUNT_MISMATCH_WAS_ACCEPTED';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'SETTLEMENT_IDENTITY_MISMATCH' THEN RAISE; END IF;
  END;

  -- A settled transaction remains idempotently readable even if its COA accounts
  -- are later made inactive; the function must not attempt to re-post or mutate it.
  UPDATE public.chart_of_accounts
  SET is_active=false
  WHERE tenant_id='MNTY-PLATFORM'
    AND account_code IN ('1020','2050','5030');

  -- Diagnostic evidence for the isolated replay: compare canonical COA IDs and
  -- persisted journal lines before the idempotent retry. This does not mutate data.
  RAISE NOTICE 'RC494_PLATFORM_ROOT_ACCOUNT_IDS: %',
    (SELECT jsonb_object_agg(account_code,id) FROM public.chart_of_accounts
     WHERE tenant_id='MNTY-PLATFORM' AND account_code IN ('1020','2050','5030'));
  RAISE NOTICE 'RC494_PLATFORM_ROOT_JOURNAL_LINES: %',
    (SELECT jsonb_agg(jsonb_build_object(
      'id',id,'account_id',account_id,'line_number',line_number,
      'debit',debit,'credit',credit,'description',description
    ) ORDER BY line_number)
     FROM public.journal_entry_lines WHERE journal_entry_id='je_RC494-PLATFORM-ROOT');

  BEGIN
    v_result := public.create_settlement_and_post_journal(
      'RC494-PLATFORM-ROOT','MNTY-PLATFORM','PARTNER','partner-platform-root',
      100,0,99,1,'BANK_TRANSFER','RC494-PLATFORM-ROOT',NULL,
      'idempotent settled retry after account deactivation',
      '49400000-0000-4000-8000-000000000001'
    );
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ROOT_RETRY_DIAGNOSTIC:%',
      jsonb_build_object(
        'cause',SQLERRM,
        'accounts',(SELECT jsonb_object_agg(account_code,id)
          FROM public.chart_of_accounts
          WHERE tenant_id='MNTY-PLATFORM' AND account_code IN ('1020','2050','5030')),
        'lines',(SELECT jsonb_agg(jsonb_build_object(
          'id',id,'account_id',account_id,'line_number',line_number,
          'debit',debit,'credit',credit,'description',description
        ) ORDER BY line_number)
          FROM public.journal_entry_lines
          WHERE journal_entry_id='je_RC494-PLATFORM-ROOT'),
        'line_count',(SELECT count(*) FROM public.journal_entry_lines
          WHERE journal_entry_id='je_RC494-PLATFORM-ROOT')
      );
  END;
  IF v_result->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RC494_SETTLED_RETRY_WITH_INACTIVE_ACCOUNTS_FAILED:%',v_result;
  END IF;
END;
$rc494$;

RESET ROLE;
ROLLBACK;
