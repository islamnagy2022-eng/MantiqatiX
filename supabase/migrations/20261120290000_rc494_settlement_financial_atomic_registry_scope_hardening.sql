-- RC494: registry-backed platform settlement authority and explicit tenant/business scope.
-- Requires RC449A/RC450 journal schema and RC464 private platform-admin registry hardening.
-- Replaces the service-role-only settlement writer without widening its EXECUTE ACL.

BEGIN;

-- Persist business scope on the settlement row itself. Backfill only from the
-- linked journal entry; unresolved legacy rows remain NULL and fail closed on
-- a business-scoped retry until they are reconciled.
ALTER TABLE public.settlement_transactions
  ADD COLUMN IF NOT EXISTS business_id uuid;

UPDATE public.settlement_transactions st
SET business_id=je.business_id
FROM public.journal_entries je
WHERE st.journal_entry_id=je.id
  AND st.business_id IS NULL
  AND je.business_id IS NOT NULL
  AND je.tenant_id=st.tenant_id
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id=je.business_id AND b.tenant_id=st.tenant_id
  );

DO $business_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.settlement_transactions'::regclass
      AND conname='settlement_transactions_business_id_fkey'
  ) THEN
    ALTER TABLE public.settlement_transactions
      ADD CONSTRAINT settlement_transactions_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;
  END IF;
END;
$business_fk$;

CREATE INDEX IF NOT EXISTS settlement_transactions_business_id_idx
  ON public.settlement_transactions(business_id);

DO $preflight$
DECLARE
  v_function oid := pg_catalog.to_regprocedure(
    'public.create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid)'
  );
  v_registry oid := pg_catalog.to_regclass('private.platform_admins');
  v_registry_helper oid := pg_catalog.to_regprocedure('public.mnty_can_platform_admin()');
  v_function_owner oid;
  v_registry_owner oid;
  v_owner_bypassrls boolean;
  v_function_security_definer boolean;
  v_helper_owner oid;
  v_helper_security_definer boolean;
  v_helper_config text[];
  v_registry_rls boolean;
  v_registry_force_rls boolean;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'RC494_SETTLEMENT_FUNCTION_MISSING';
  END IF;
  IF v_registry IS NULL THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_REGISTRY_MISSING';
  END IF;
  IF v_registry_helper IS NULL THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_REGISTRY_HELPER_MISSING';
  END IF;

  SELECT p.proowner, p.prosecdef
    INTO v_function_owner, v_function_security_definer
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_function;

  SELECT c.relowner, c.relrowsecurity, c.relforcerowsecurity
    INTO v_registry_owner, v_registry_rls, v_registry_force_rls
  FROM pg_catalog.pg_class c
  WHERE c.oid = v_registry;

  SELECT r.rolbypassrls INTO v_owner_bypassrls
  FROM pg_catalog.pg_roles r
  WHERE r.oid = v_function_owner;

  IF NOT v_function_security_definer THEN
    RAISE EXCEPTION 'RC494_SETTLEMENT_FUNCTION_MUST_REMAIN_SECURITY_DEFINER';
  END IF;
  IF v_function_owner <> v_registry_owner OR NOT coalesce(v_owner_bypassrls, false) THEN
    RAISE EXCEPTION 'RC494_SETTLEMENT_AND_REGISTRY_OWNER_BYPASS_MISMATCH';
  END IF;
  IF NOT coalesce(v_registry_rls, false) OR NOT coalesce(v_registry_force_rls, false) THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_REGISTRY_RLS_NOT_FORCED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_registry AND a.attname = 'user_id' AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_REGISTRY_USER_ID_MISSING';
  END IF;
  IF pg_catalog.has_table_privilege('anon', v_registry, 'SELECT')
     OR pg_catalog.has_table_privilege('anon', v_registry, 'INSERT')
     OR pg_catalog.has_table_privilege('anon', v_registry, 'UPDATE')
     OR pg_catalog.has_table_privilege('anon', v_registry, 'DELETE')
     OR pg_catalog.has_table_privilege('authenticated', v_registry, 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', v_registry, 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', v_registry, 'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated', v_registry, 'DELETE') THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_REGISTRY_CLIENT_TABLE_GRANT_FOUND';
  END IF;
  IF NOT pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC494_SETTLEMENT_FUNCTION_EXECUTE_ACL_UNEXPECTED:anon=%,authenticated=%,service_role=%,anon_member_service_role=%,authenticated_member_service_role=%,acl=%',
      pg_catalog.has_function_privilege('anon',v_function,'EXECUTE'),
      pg_catalog.has_function_privilege('authenticated',v_function,'EXECUTE'),
      pg_catalog.has_function_privilege('service_role',v_function,'EXECUTE'),
      pg_catalog.pg_has_role('anon','service_role','MEMBER'),
      pg_catalog.pg_has_role('authenticated','service_role','MEMBER'),
      (SELECT coalesce(array_to_string(p.proacl,','),'(default ACL)') FROM pg_catalog.pg_proc p WHERE p.oid=v_function);
  END IF;
  SELECT p.proowner, p.prosecdef, p.proconfig
    INTO v_helper_owner, v_helper_security_definer, v_helper_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_registry_helper;

  IF v_helper_owner <> v_registry_owner OR NOT coalesce(v_helper_security_definer, false)
     OR NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(v_helper_config, ARRAY[]::text[])) AS setting(value)
       WHERE setting.value = 'search_path=""'
     ) THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_HELPER_SECURITY_CONTRACT_UNEXPECTED';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated', v_registry_helper, 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', v_registry_helper, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC494_PLATFORM_ADMIN_HELPER_EXECUTE_ACL_UNEXPECTED';
  END IF;
  IF pg_catalog.has_schema_privilege('anon', 'public', 'CREATE')
     OR pg_catalog.has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'RC494_PUBLIC_SCHEMA_CREATE_NOT_REVOKED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='journal_entries'
      AND column_name IN ('id','tenant_id','organization_id','business_id','branch_id','entry_number','reference_type','reference_id','description','status','total_debit','total_credit','entry_date','posted_at','created_by')
    GROUP BY table_name HAVING count(DISTINCT column_name)=15
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='journal_entry_lines' AND column_name='line_number'
  ) THEN
    RAISE EXCEPTION 'RC494_RC449A_RC450_JOURNAL_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='businesses'
      AND column_name IN ('id','tenant_id','status')
    GROUP BY table_name HAVING count(DISTINCT column_name)=3
  ) THEN
    RAISE EXCEPTION 'RC494_BUSINESS_SCOPE_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='settlement_transactions'
      AND column_name IN ('id','tenant_id','business_id','beneficiary_type','beneficiary_id','gross_amount','platform_fee','net_payout','voucher_reserve','payout_channel','journal_entry_id','status','reference_id')
    GROUP BY table_name HAVING count(DISTINCT column_name)=13
  ) THEN
    RAISE EXCEPTION 'RC494_SETTLEMENT_TRANSACTION_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chart_of_accounts'
      AND column_name IN ('id','tenant_id','account_code','is_active')
    GROUP BY table_name HAVING count(DISTINCT column_name)=4
  ) THEN
    RAISE EXCEPTION 'RC494_CHART_OF_ACCOUNTS_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='journal_entry_lines'
      AND column_name IN ('id','journal_entry_id','account_id','line_number','debit','credit','description')
    GROUP BY table_name HAVING count(DISTINCT column_name)=7
  ) THEN
    RAISE EXCEPTION 'RC494_JOURNAL_ENTRY_LINES_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='general_ledger' AND column_name='journal_entry_id'
  ) THEN
    RAISE EXCEPTION 'RC494_GENERAL_LEDGER_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entries'
      AND t.tgname='trg_post_journal_to_gl' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entries'
      AND t.tgname='trg_validate_journal_balance' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'RC494_JOURNAL_POSTING_TRIGGERS_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_memberships'
      AND column_name IN ('user_id','tenant_id','business_id','branch_id','role','status','created_at')
    GROUP BY table_name HAVING count(DISTINCT column_name)=7
  ) THEN
    RAISE EXCEPTION 'RC494_MEMBERSHIP_SCOPE_SCHEMA_NOT_READY';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.create_settlement_and_post_journal(
  p_id character varying,
  p_tenant_id character varying,
  p_beneficiary_type character varying,
  p_beneficiary_id character varying,
  p_gross numeric,
  p_platform_fee numeric,
  p_net numeric,
  p_voucher numeric,
  p_channel character varying,
  p_reference_id character varying,
  p_business_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text,
  p_actor_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing public.settlement_transactions%rowtype;
  v_je_id varchar := 'je_' || p_id;
  v_account_2010 varchar;
  v_account_1020 varchar;
  v_account_2050 varchar;
  v_account_5030 varchar;
  v_total numeric;
  v_line_count integer := 0;
  v_role varchar;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'ACTOR_REQUIRED'; END IF;
  IF p_id IS NULL OR p_id='' OR p_tenant_id IS NULL OR p_tenant_id='' THEN
    RAISE EXCEPTION 'SETTLEMENT_ID_AND_TENANT_REQUIRED';
  END IF;

  -- The platform tenant is root-only. A SUPER_ADMIN membership row is not
  -- sufficient; the actor must be present in the private registry.
  IF p_tenant_id = 'MNTY-PLATFORM' THEN
    IF NOT EXISTS (
      SELECT 1 FROM private.platform_admins pa
      WHERE pa.user_id = p_actor_user_id
    ) THEN
      RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED';
    END IF;
    IF p_business_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = p_business_id
        AND b.tenant_id = p_tenant_id
        AND b.status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'BUSINESS_SCOPE_DENIED';
    END IF;
  ELSE
    SELECT m.role INTO v_role
    FROM public.user_memberships m
    WHERE m.user_id=p_actor_user_id
      AND m.tenant_id=p_tenant_id
      AND m.status='ACTIVE'
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF v_role IS NULL THEN RAISE EXCEPTION 'TENANT_ACCESS_DENIED'; END IF;
    IF upper(v_role) NOT IN ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN
      RAISE EXCEPTION 'FINANCE_ROLE_REQUIRED';
    END IF;

    IF p_business_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id=p_business_id
          AND b.tenant_id=p_tenant_id
          AND b.status='ACTIVE'
      ) THEN
        RAISE EXCEPTION 'BUSINESS_SCOPE_DENIED';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.user_memberships m
        WHERE m.user_id=p_actor_user_id
          AND m.tenant_id=p_tenant_id
          AND m.business_id=p_business_id
          AND m.branch_id IS NULL
          AND m.status='ACTIVE'
          AND upper(m.role) IN ('OWNER','BUSINESS_OWNER','ADMIN','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
      ) THEN
        RAISE EXCEPTION 'BUSINESS_SCOPE_DENIED';
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.user_memberships m
        WHERE m.user_id=p_actor_user_id
          AND m.tenant_id=p_tenant_id
          AND m.business_id IS NULL
          AND m.branch_id IS NULL
          AND m.status='ACTIVE'
          AND upper(m.role) IN ('OWNER','ADMIN','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
      ) THEN
        RAISE EXCEPTION 'TENANT_FINANCE_SCOPE_REQUIRED';
      END IF;
    END IF;
  END IF;

  IF p_beneficiary_type IS NULL OR p_beneficiary_type NOT IN ('PARTNER','MERCHANT') THEN RAISE EXCEPTION 'INVALID_BENEFICIARY_TYPE'; END IF;
  IF p_beneficiary_id IS NULL OR p_beneficiary_id='' THEN RAISE EXCEPTION 'BENEFICIARY_REQUIRED'; END IF;
  IF p_beneficiary_type='MERCHANT' AND p_business_id IS NULL THEN RAISE EXCEPTION 'BUSINESS_SCOPE_REQUIRED'; END IF;
  IF p_gross IS NULL OR p_platform_fee IS NULL OR p_net IS NULL OR p_voucher IS NULL
     OR p_gross < 0 OR p_platform_fee < 0 OR p_net < 0 OR p_voucher < 0 THEN
    RAISE EXCEPTION 'INVALID_SETTLEMENT_AMOUNT';
  END IF;
  IF round(p_gross,2) <> round(p_platform_fee+p_net+p_voucher,2) THEN RAISE EXCEPTION 'SETTLEMENT_BREAKDOWN_MISMATCH'; END IF;
  IF p_beneficiary_type='PARTNER' AND round(p_net+p_voucher,2)<>round(p_gross,2) THEN RAISE EXCEPTION 'PARTNER_SETTLEMENT_MUST_EQUAL_GROSS'; END IF;
  IF p_beneficiary_type='MERCHANT' AND p_voucher<>0 THEN RAISE EXCEPTION 'MERCHANT_VOUCHER_MUST_BE_ZERO'; END IF;

  -- Serialize retries by the settlement primary key. Without this lock, two first-time
  -- requests can both observe no row; one posts successfully while the other races
  -- through ON CONFLICT line inserts and then fails on the settlement primary key.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('settlement:' || p_id, 0)
  );

  SELECT id INTO v_account_2010 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='2010' AND is_active=true LIMIT 1;
  SELECT id INTO v_account_1020 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='1020' AND is_active=true LIMIT 1;
  SELECT id INTO v_account_2050 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='2050' AND is_active=true LIMIT 1;
  SELECT id INTO v_account_5030 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='5030' AND is_active=true LIMIT 1;
  IF v_account_1020 IS NULL THEN RAISE EXCEPTION 'COA_1020_MISSING'; END IF;
  IF p_beneficiary_type='MERCHANT' AND v_account_2010 IS NULL THEN RAISE EXCEPTION 'COA_2010_MISSING'; END IF;
  IF p_beneficiary_type='PARTNER' AND (v_account_2050 IS NULL OR v_account_5030 IS NULL) THEN RAISE EXCEPTION 'COA_PARTNER_ACCOUNTS_MISSING'; END IF;

  v_total := CASE WHEN p_beneficiary_type='PARTNER' THEN p_gross ELSE p_net END;
  IF v_total<=0 THEN RAISE EXCEPTION 'SETTLEMENT_TOTAL_MUST_BE_POSITIVE'; END IF;

  SELECT * INTO v_existing
  FROM public.settlement_transactions
  WHERE id=p_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_existing.business_id IS DISTINCT FROM p_business_id
       OR v_existing.beneficiary_type IS DISTINCT FROM p_beneficiary_type
       OR v_existing.beneficiary_id IS DISTINCT FROM p_beneficiary_id
       OR v_existing.gross_amount IS DISTINCT FROM p_gross
       OR v_existing.platform_fee IS DISTINCT FROM p_platform_fee
       OR v_existing.net_payout IS DISTINCT FROM p_net
       OR v_existing.voucher_reserve IS DISTINCT FROM p_voucher
       OR (p_channel IS NOT NULL AND v_existing.payout_channel IS DISTINCT FROM p_channel)
       OR v_existing.reference_id IS DISTINCT FROM p_reference_id
       OR (v_existing.journal_entry_id IS NOT NULL AND v_existing.journal_entry_id IS DISTINCT FROM v_je_id)
       OR (v_existing.status='SETTLED' AND v_existing.journal_entry_id IS NULL) THEN
      RAISE EXCEPTION 'SETTLEMENT_IDENTITY_MISMATCH';
    END IF;
    IF v_existing.journal_entry_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id=v_je_id
        AND je.tenant_id=p_tenant_id
        AND je.business_id IS NOT DISTINCT FROM p_business_id
        AND je.organization_id IS NULL
        AND je.branch_id IS NULL
        AND je.reference_type IS NOT DISTINCT FROM CASE
          WHEN p_beneficiary_type='PARTNER' THEN 'PARTNER_COMMISSION_SETTLEMENT'
          ELSE 'ORDER_SETTLEMENT'
        END
        AND je.reference_id IS NOT DISTINCT FROM coalesce(p_reference_id,p_id)
        AND je.created_by IS NOT DISTINCT FROM p_actor_user_id
        AND je.status='POSTED'
        AND je.posted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'SETTLEMENT_IDENTITY_MISMATCH';
    END IF;
    IF v_existing.status='SETTLED' AND v_existing.journal_entry_id IS NOT NULL THEN
      -- Idempotent retries must validate the posted journal contents too; a matching
      -- settlement row/header cannot bless altered, missing or extra journal lines.
      IF (SELECT count(*) FROM public.journal_entry_lines
          WHERE journal_entry_id=v_je_id) <> CASE WHEN p_beneficiary_type='PARTNER' THEN 3 ELSE 2 END THEN
        RAISE EXCEPTION 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH';
      END IF;

      IF p_beneficiary_type='PARTNER' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.journal_entry_lines
          WHERE id='jel_'||p_id||'_5030' AND journal_entry_id=v_je_id
            AND account_id=v_account_5030 AND line_number=1
            AND debit IS NOT DISTINCT FROM p_gross AND credit IS NOT DISTINCT FROM 0::numeric
            AND description IS NOT DISTINCT FROM 'Partner commission expense'
        ) OR NOT EXISTS (
          SELECT 1 FROM public.journal_entry_lines
          WHERE id='jel_'||p_id||'_1020' AND journal_entry_id=v_je_id
            AND account_id=v_account_1020 AND line_number=2
            AND debit IS NOT DISTINCT FROM 0::numeric AND credit IS NOT DISTINCT FROM p_net
            AND description IS NOT DISTINCT FROM 'Partner cash payout'
        ) OR NOT EXISTS (
          SELECT 1 FROM public.journal_entry_lines
          WHERE id='jel_'||p_id||'_2050' AND journal_entry_id=v_je_id
            AND account_id=v_account_2050 AND line_number=3
            AND debit IS NOT DISTINCT FROM 0::numeric AND credit IS NOT DISTINCT FROM p_voucher
            AND description IS NOT DISTINCT FROM 'Partner voucher reserve'
        ) THEN
          RAISE EXCEPTION 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH';
        END IF;
      ELSE
        IF NOT EXISTS (
          SELECT 1 FROM public.journal_entry_lines
          WHERE id='jel_'||p_id||'_2010' AND journal_entry_id=v_je_id
            AND account_id=v_account_2010 AND line_number=1
            AND debit IS NOT DISTINCT FROM p_net AND credit IS NOT DISTINCT FROM 0::numeric
            AND description IS NOT DISTINCT FROM 'Close merchant payable'
        ) OR NOT EXISTS (
          SELECT 1 FROM public.journal_entry_lines
          WHERE id='jel_'||p_id||'_1020' AND journal_entry_id=v_je_id
            AND account_id=v_account_1020 AND line_number=2
            AND debit IS NOT DISTINCT FROM 0::numeric AND credit IS NOT DISTINCT FROM p_net
            AND description IS NOT DISTINCT FROM 'Merchant cash payout'
        ) THEN
          RAISE EXCEPTION 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH';
        END IF;
      END IF;

      RETURN jsonb_build_object('id',p_id,'status',v_existing.status,'journalEntryId',v_existing.journal_entry_id,'idempotent',true);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id=v_je_id
      AND (
        je.tenant_id IS DISTINCT FROM p_tenant_id
        OR je.business_id IS DISTINCT FROM p_business_id
        OR je.organization_id IS NOT NULL
        OR je.branch_id IS NOT NULL
        OR je.reference_type IS DISTINCT FROM CASE
          WHEN p_beneficiary_type='PARTNER' THEN 'PARTNER_COMMISSION_SETTLEMENT'
          ELSE 'ORDER_SETTLEMENT'
        END
        OR je.reference_id IS DISTINCT FROM coalesce(p_reference_id,p_id)
        OR je.created_by IS DISTINCT FROM p_actor_user_id
        OR je.status IS DISTINCT FROM 'DRAFT'
      )
  ) THEN
    RAISE EXCEPTION 'SETTLEMENT_IDENTITY_MISMATCH';
  END IF;

  INSERT INTO public.journal_entries(
    id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
    description,status,total_debit,total_credit,entry_date,posted_at,created_by
  )
  VALUES(
    v_je_id,p_tenant_id,NULL,p_business_id,NULL,'JE-'||p_id,
    CASE WHEN p_beneficiary_type='PARTNER' THEN 'PARTNER_COMMISSION_SETTLEMENT' ELSE 'ORDER_SETTLEMENT' END,
    coalesce(p_reference_id,p_id),coalesce(p_description,'Atomic settlement '||p_id),'DRAFT',
    0,0,current_date,NULL,p_actor_user_id
  )
  ON CONFLICT(id) DO NOTHING;

  IF p_beneficiary_type='PARTNER' THEN
    INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description) VALUES
      ('jel_'||p_id||'_5030',v_je_id,v_account_5030,1,p_gross,0,'Partner commission expense'),
      ('jel_'||p_id||'_1020',v_je_id,v_account_1020,2,0,p_net,'Partner cash payout'),
      ('jel_'||p_id||'_2050',v_je_id,v_account_2050,3,0,p_voucher,'Partner voucher reserve')
    ON CONFLICT(id) DO NOTHING;
    v_line_count:=3;
  ELSE
    INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description) VALUES
      ('jel_'||p_id||'_2010',v_je_id,v_account_2010,1,p_net,0,'Close merchant payable'),
      ('jel_'||p_id||'_1020',v_je_id,v_account_1020,2,0,p_net,'Merchant cash payout')
    ON CONFLICT(id) DO NOTHING;
    v_line_count:=2;
  END IF;

  -- An existing journal ID is not sufficient evidence of idempotency. Verify that
  -- the complete line set is exactly the one this settlement is authorized to post.
  -- This prevents ON CONFLICT DO NOTHING from silently accepting forged, stale,
  -- incomplete, extra or amount/account-mismatched journal lines.
  IF (SELECT count(*) FROM public.journal_entry_lines
      WHERE journal_entry_id=v_je_id) <> v_line_count THEN
    RAISE EXCEPTION 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH';
  END IF;

  IF p_beneficiary_type='PARTNER' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.journal_entry_lines
      WHERE id='jel_'||p_id||'_5030'
        AND journal_entry_id=v_je_id
        AND account_id=v_account_5030
        AND line_number=1
        AND debit IS NOT DISTINCT FROM p_gross
        AND credit IS NOT DISTINCT FROM 0::numeric
        AND description IS NOT DISTINCT FROM 'Partner commission expense'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.journal_entry_lines
      WHERE id='jel_'||p_id||'_1020'
        AND journal_entry_id=v_je_id
        AND account_id=v_account_1020
        AND line_number=2
        AND debit IS NOT DISTINCT FROM 0::numeric
        AND credit IS NOT DISTINCT FROM p_net
        AND description IS NOT DISTINCT FROM 'Partner cash payout'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.journal_entry_lines
      WHERE id='jel_'||p_id||'_2050'
        AND journal_entry_id=v_je_id
        AND account_id=v_account_2050
        AND line_number=3
        AND debit IS NOT DISTINCT FROM 0::numeric
        AND credit IS NOT DISTINCT FROM p_voucher
        AND description IS NOT DISTINCT FROM 'Partner voucher reserve'
    ) THEN
      RAISE EXCEPTION 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.journal_entry_lines
      WHERE id='jel_'||p_id||'_2010'
        AND journal_entry_id=v_je_id
        AND account_id=v_account_2010
        AND line_number=1
        AND debit IS NOT DISTINCT FROM p_net
        AND credit IS NOT DISTINCT FROM 0::numeric
        AND description IS NOT DISTINCT FROM 'Close merchant payable'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.journal_entry_lines
      WHERE id='jel_'||p_id||'_1020'
        AND journal_entry_id=v_je_id
        AND account_id=v_account_1020
        AND line_number=2
        AND debit IS NOT DISTINCT FROM 0::numeric
        AND credit IS NOT DISTINCT FROM p_net
        AND description IS NOT DISTINCT FROM 'Merchant cash payout'
    ) THEN
      RAISE EXCEPTION 'SETTLEMENT_JOURNAL_LINES_IDENTITY_MISMATCH';
    END IF;
  END IF;

  UPDATE public.journal_entries
  SET status='POSTED',total_debit=v_total,total_credit=v_total,posted_at=now()
  WHERE id=v_je_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.general_ledger gl
    WHERE gl.journal_entry_id=v_je_id
  ) THEN
    RAISE EXCEPTION 'GENERAL_LEDGER_POSTING_FAILED';
  END IF;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.settlement_transactions(
      id,tenant_id,business_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,
      payout_channel,journal_entry_id,status,reference_id
    )
    VALUES(
      p_id,p_tenant_id,p_business_id,p_beneficiary_type,p_beneficiary_id,p_gross,p_platform_fee,p_net,p_voucher,
      coalesce(p_channel,'BANK_TRANSFER'),v_je_id,'SETTLED',p_reference_id
    );
  ELSE
    UPDATE public.settlement_transactions
    SET business_id=p_business_id,gross_amount=p_gross,platform_fee=p_platform_fee,net_payout=p_net,voucher_reserve=p_voucher,
        payout_channel=coalesce(p_channel,payout_channel),journal_entry_id=v_je_id,status='SETTLED',reference_id=p_reference_id
    WHERE id=p_id;
  END IF;

  RETURN jsonb_build_object('id',p_id,'status','SETTLED','journalEntryId',v_je_id,'lineCount',v_line_count,'idempotent',false);
END;
$function$;

COMMENT ON FUNCTION public.create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid) IS
  'RC494: service-role settlement writer; tenant/business scope is rechecked in SQL and MNTY-PLATFORM requires private platform-admin registry membership.';

COMMIT;
