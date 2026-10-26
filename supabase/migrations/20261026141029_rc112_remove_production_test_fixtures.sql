DO $cleanup$
DECLARE
  v_count bigint;
BEGIN
  -- Remove the explicit production tenant-isolation fixture only when its
  -- identity and sole business still match the known synthetic fixture.
  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id='MNTY-TEST-B'
      AND code='TEST-B'
      AND name='MantiqatiX Isolation Test B'
  ) THEN
    SELECT count(*) INTO v_count
    FROM public.businesses
    WHERE tenant_id='MNTY-TEST-B';
    IF v_count <> 1 OR NOT EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id='29951544-47ec-41e8-aa62-a55540f11a3e'
        AND tenant_id='MNTY-TEST-B'
        AND code='MANTIQA-TEST-0294C6DC'
        AND settings->>'registration_source'='super_admin_test_fixture'
    ) THEN
      RAISE EXCEPTION 'REFUSED: MNTY-TEST-B no longer matches the single known isolation fixture';
    END IF;

    IF EXISTS (SELECT 1 FROM public.orders WHERE tenant_id='MNTY-TEST-B' OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e')
       OR EXISTS (SELECT 1 FROM public.payment_intents WHERE tenant_id='MNTY-TEST-B')
       OR EXISTS (SELECT 1 FROM public.financial_obligations WHERE tenant_id='MNTY-TEST-B' OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e')
       OR EXISTS (SELECT 1 FROM public.general_ledger WHERE tenant_id='MNTY-TEST-B' OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e')
       OR EXISTS (SELECT 1 FROM public.journal_entries WHERE tenant_id='MNTY-TEST-B' OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e')
       OR EXISTS (SELECT 1 FROM public.wallet_transactions WHERE tenant_id='MNTY-TEST-B')
       OR EXISTS (SELECT 1 FROM public.inventory_transactions WHERE tenant_id='MNTY-TEST-B' OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e')
       OR EXISTS (SELECT 1 FROM public.refund_transactions WHERE tenant_id='MNTY-TEST-B' OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e') THEN
      RAISE EXCEPTION 'REFUSED: unexpected transactional or financial records found in MNTY-TEST-B';
    END IF;

    -- Immutable audit rows are not deleted by this cleanup.
    IF EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE tenant_id='MNTY-TEST-B'
         OR business_id='29951544-47ec-41e8-aa62-a55540f11a3e'
    ) THEN
      RAISE EXCEPTION 'REFUSED: audit records exist for the MNTY-TEST-B fixture; review them before retiring the tenant';
    END IF;

    DELETE FROM public.ticket_messages
    WHERE ticket_id='ISOLATION-TEST-B-001';
    DELETE FROM public.support_tickets
    WHERE id='ISOLATION-TEST-B-001'
      AND tenant_id='MNTY-TEST-B'
      AND subject='Cross-Tenant Isolation Test';
    DELETE FROM public.approval_actions
    WHERE approval_request_id='APR-TEST-MANTIQA-952aee632d6d41e19fba8f5aa67d889f';
    DELETE FROM public.approval_requests
    WHERE id='APR-TEST-MANTIQA-952aee632d6d41e19fba8f5aa67d889f'
      AND tenant_id='MNTY-TEST-B'
      AND metadata->>'registration_source'='super_admin_test_fixture';
    DELETE FROM public.notifications
    WHERE tenant_id='MNTY-TEST-B'
      AND entity_id IN ('ISOLATION-TEST-B-001','APR-TEST-MANTIQA-952aee632d6d41e19fba8f5aa67d889f');

    DELETE FROM public.catalog_item_options
    WHERE tenant_id='MNTY-TEST-B'
      AND catalog_item_id IN (
        SELECT id FROM public.catalog_items
        WHERE tenant_id='MNTY-TEST-B'
          AND business_id='29951544-47ec-41e8-aa62-a55540f11a3e'
      );
    DELETE FROM public.catalog_item_prices
    WHERE tenant_id='MNTY-TEST-B'
      AND catalog_item_id IN (
        SELECT id FROM public.catalog_items
        WHERE tenant_id='MNTY-TEST-B'
          AND business_id='29951544-47ec-41e8-aa62-a55540f11a3e'
      );
    DELETE FROM public.catalog_items
    WHERE tenant_id='MNTY-TEST-B'
      AND business_id='29951544-47ec-41e8-aa62-a55540f11a3e';
    DELETE FROM public.catalog_business_settings
    WHERE tenant_id='MNTY-TEST-B'
      AND business_id='29951544-47ec-41e8-aa62-a55540f11a3e';
    DELETE FROM public.user_memberships
    WHERE tenant_id='MNTY-TEST-B';
    DELETE FROM public.branches
    WHERE id='MANTIQA-MAIN-TEST'
      AND tenant_id='MNTY-TEST-B'
      AND business_id='29951544-47ec-41e8-aa62-a55540f11a3e';
    DELETE FROM public.businesses
    WHERE id='29951544-47ec-41e8-aa62-a55540f11a3e'
      AND tenant_id='MNTY-TEST-B'
      AND code='MANTIQA-TEST-0294C6DC'
      AND settings->>'registration_source'='super_admin_test_fixture';
    DELETE FROM public.tenants
    WHERE id='MNTY-TEST-B'
      AND code='TEST-B'
      AND name='MantiqatiX Isolation Test B';
  END IF;

  -- Remove the explicitly documented, inactive, synthetic provider fixture.
  IF EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id='1771c77a-8a4a-4a0a-afe2-133928188660'
      AND tenant_id='MNTY-PLATFORM'
      AND code='MNTY-BERKET-TEST'
      AND status='INACTIVE'
      AND settings->>'fixture'='true'
      AND settings->>'purpose'='production-e2e-test'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.marketing_provider_profiles
      WHERE id='1f9cae57-8469-4ce2-9565-993256983fae'
        AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660'
        AND status='PENDING'
        AND settings->>'fixture'='true'
        AND settings->>'purpose'='production-e2e-test'
    ) THEN
      RAISE EXCEPTION 'REFUSED: the Berket test provider profile no longer matches the known fixture';
    END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.payment_intents pi JOIN public.orders o ON o.id=pi.order_id WHERE o.business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.financial_obligations WHERE business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.general_ledger WHERE business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.journal_entries WHERE business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.refund_transactions WHERE business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.business_referral_events WHERE business_id='1771c77a-8a4a-4a0a-afe2-133928188660')
       OR EXISTS (SELECT 1 FROM public.marketing_project_participants WHERE provider_id='1f9cae57-8469-4ce2-9565-993256983fae')
       OR EXISTS (SELECT 1 FROM public.marketing_leads WHERE requester_business_id='1771c77a-8a4a-4a0a-afe2-133928188660' OR assigned_provider_id='1f9cae57-8469-4ce2-9565-993256983fae')
       OR EXISTS (SELECT 1 FROM public.provider_onboarding_requests WHERE business_name='MNTY Berket El Sabaa Test Provider') THEN
      RAISE EXCEPTION 'REFUSED: transactional or linked production activity exists for MNTY-BERKET-TEST';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.advertisements
      WHERE id='MNTY-AD-BERKET-20260929'
        AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660'
        AND coalesce(status,'') <> 'PENDING_APPROVAL'
    ) THEN
      RAISE EXCEPTION 'REFUSED: the fixture advertisement changed from its audited pending state';
    END IF;

    DELETE FROM public.advertisement_target_locations
    WHERE advertisement_id='MNTY-AD-BERKET-20260929';
    DELETE FROM public.advertisements
    WHERE id='MNTY-AD-BERKET-20260929'
      AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660'
      AND status='PENDING_APPROVAL';

    DELETE FROM public.catalog_item_options
    WHERE tenant_id='MNTY-PLATFORM'
      AND catalog_item_id IN (
        SELECT id FROM public.catalog_items
        WHERE tenant_id='MNTY-PLATFORM'
          AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660'
      );
    DELETE FROM public.catalog_item_prices
    WHERE tenant_id='MNTY-PLATFORM'
      AND catalog_item_id IN (
        SELECT id FROM public.catalog_items
        WHERE tenant_id='MNTY-PLATFORM'
          AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660'
      );
    DELETE FROM public.catalog_items
    WHERE tenant_id='MNTY-PLATFORM'
      AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660';
    DELETE FROM public.catalog_business_settings
    WHERE tenant_id='MNTY-PLATFORM'
      AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660';
    DELETE FROM public.marketing_provider_profiles
    WHERE id='1f9cae57-8469-4ce2-9565-993256983fae'
      AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660'
      AND settings->>'fixture'='true'
      AND settings->>'purpose'='production-e2e-test';
    DELETE FROM public.branches
    WHERE id='MNTY-BERKET-MAIN'
      AND tenant_id='MNTY-PLATFORM'
      AND business_id='1771c77a-8a4a-4a0a-afe2-133928188660';
    DELETE FROM public.businesses
    WHERE id='1771c77a-8a4a-4a0a-afe2-133928188660'
      AND tenant_id='MNTY-PLATFORM'
      AND code='MNTY-BERKET-TEST'
      AND status='INACTIVE'
      AND settings->>'fixture'='true'
      AND settings->>'purpose'='production-e2e-test';
  END IF;
END
$cleanup$;
