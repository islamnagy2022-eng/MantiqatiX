-- RC458: remove public/pg_temp name resolution from the digital-page payment claim
-- and fulfillment SECURITY DEFINER entrypoints.
--
-- All application relations and helper functions in these definitions are schema-qualified.
-- pg_catalog remains implicitly available when search_path is empty.
-- Preserve the existing authenticated caller contract and all existing function ACLs.
-- Apply only through the approved migration pipeline after isolated replay and regression tests.

alter function public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)
  set search_path = '';

alter function public.release_digital_page_payment_intent_claim_backend(uuid,uuid,text)
  set search_path = '';

alter function public.fulfill_digital_page_publish(uuid,uuid,uuid)
  set search_path = '';
