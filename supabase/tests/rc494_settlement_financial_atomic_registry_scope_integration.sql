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
  ('49400000-0000-4000-8000-000000000004','authenticated','authenticated','rc494-tenant-finance@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc494_fixture":true}'::jsonb,now(),now(),false,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants(id,name,code,status,settings)
VALUES
 ('MNTY-PLATFORM','MantiqaTix Platform','MNTY-PLATFORM','ACTIVE','{}'::jsonb),
 ('RC494-TENANT','RC494 isolated settlement tenant','RC494-TENANT','ACTIVE','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.businesses(id,tenant_id,name,code,status,settings)
VALUES
 ('49400000-0000-4000-8000-000000000101','RC494-TENANT','RC494 Business A','RC494-BUSINESS-A','ACTIVE','{}'::jsonb),
 ('49400000-0000-4000-8000-000000000102','RC494-TENANT','RC494 Business B','RC494-BUSINESS-B','ACTIVE','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO private.platform_admins(user_id)
VALUES ('49400000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_memberships
  (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status,created_at)
VALUES
 ('RC494-FAKE-PLATFORM-MEMBERSHIP','49400000-0000-4000-8000-000000000002','MNTY-PLATFORM',NULL,NULL,NULL,'SUPER_ADMIN','{"scope":"PLATFORM","full_control":true}'::jsonb,'ACTIVE',now()-interval '1 day'),
 ('RC494-BUSINESS-FINANCE-MEMBERSHIP','49400000-0000-4000-8000-000000000003','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,'ACCOUNTANT','{}'::jsonb,'ACTIVE',now()-interval '1 day'),
 ('RC494-TENANT-FINANCE-MEMBERSHIP','49400000-0000-4000-8000-000000000004','RC494-TENANT',NULL,NULL,NULL,'FINANCE_MANAGER','{}'::jsonb,'ACTIVE',now()-interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.journal_entries
  (id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
   description,status,total_debit,total_credit,entry_date,posted_at,created_by)
VALUES
 ('je_RC494_PLATFORM_ROOT','MNTY-PLATFORM',NULL,NULL,NULL,'RC494-JE-PLATFORM-ROOT','PARTNER_COMMISSION_SETTLEMENT','RC494-PLATFORM-ROOT','RC494 idempotent platform fixture','POSTED',100,100,current_date,now(),'49400000-0000-4000-8000-000000000001'),
 ('je_RC494_FAKE_ROOT','MNTY-PLATFORM',NULL,NULL,NULL,'RC494-JE-FAKE-ROOT','PARTNER_COMMISSION_SETTLEMENT','RC494-FAKE-ROOT','RC494 fake platform fixture','POSTED',100,100,current_date,now(),'49400000-0000-4000-8000-000000000002'),
 ('je_RC494_BUSINESS','RC494-TENANT',NULL,'49400000-0000-4000-8000-000000000101',NULL,'RC494-JE-BUSINESS','ORDER_SETTLEMENT','RC494-TENANT-BUSINESS','RC494 business fixture','POSTED',100,100,current_date,now(),'49400000-0000-4000-8000-000000000003'),
 ('je_RC494_TENANT','RC494-TENANT',NULL,NULL,NULL,'RC494-JE-TENANT','ORDER_SETTLEMENT','RC494-TENANT-WIDE','RC494 tenant fixture','POSTED',100,100,current_date,now(),'49400000-0000-4000-8000-000000000004')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settlement_transactions
  (id,tenant_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,
   payout_channel,journal_entry_id,status,reference_id)
VALUES
 ('RC494-PLATFORM-ROOT','MNTY-PLATFORM','PARTNER','partner-platform-root',100,0,100,0,'BANK_TRANSFER','je_RC494_PLATFORM_ROOT','SETTLED','RC494-PLATFORM-ROOT'),
 ('RC494-FAKE-ROOT','MNTY-PLATFORM','PARTNER','partner-fake-root',100,0,100,0,'BANK_TRANSFER','je_RC494_FAKE_ROOT','SETTLED','RC494-FAKE-ROOT'),
 ('RC494-TENANT-BUSINESS','RC494-TENANT','MERCHANT','merchant-business-a',100,0,100,0,'BANK_TRANSFER','je_RC494_BUSINESS','SETTLED','RC494-TENANT-BUSINESS'),
 ('RC494-TENANT-WIDE','RC494-TENANT','PARTNER','partner-tenant-wide',100,0,100,0,'BANK_TRANSFER','je_RC494_TENANT','SETTLED','RC494-TENANT-WIDE')
ON CONFLICT (id) DO NOTHING;

DO $rc494$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.create_settlement_and_post_journal(
    'RC494-PLATFORM-ROOT','MNTY-PLATFORM','PARTNER','partner-platform-root',
    100,0,100,0,'BANK_TRANSFER','RC494-PLATFORM-ROOT',NULL,'registry root idempotency test',
    '49400000-0000-4000-8000-000000000001'
  );
  IF v_result->>'idempotent' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'RC494_REGISTERED_PLATFORM_ROOT_WITHOUT_MEMBERSHIP_DENIED:%',v_result;
  END IF;

  BEGIN
    PERFORM public.create_settlement_and_post_journal(
      'RC494-FAKE-ROOT','MNTY-PLATFORM','PARTNER','partner-fake-root',
      100,0,100,0,'BANK_TRANSFER','RC494-FAKE-ROOT',NULL,'membership-only root must fail',
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

  v_result := public.create_settlement_and_post_journal(
    'RC494-TENANT-WIDE','RC494-TENANT','PARTNER','partner-tenant-wide',
    100,0,100,0,'BANK_TRANSFER','RC494-TENANT-WIDE',
    NULL,'tenant-scoped finance test',
    '49400000-0000-4000-8000-000000000004'
  );
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
END;
$rc494$;

ROLLBACK;
