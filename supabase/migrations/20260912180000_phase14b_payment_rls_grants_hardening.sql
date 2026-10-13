BEGIN;

-- ============================================================
-- Phase 14B
-- Payment RLS + Grants Hardening
-- Cash-only / Server-authoritative architecture
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enable RLS on payment tables
-- ------------------------------------------------------------

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Remove direct client privileges
--
-- Clients must NOT be able to create, update or delete
-- payment intents/events directly.
--
-- All payment mutations must go through the backend /
-- SECURITY DEFINER payment RPC where applicable.
-- ------------------------------------------------------------

REVOKE ALL PRIVILEGES
ON TABLE public.payment_intents
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.payment_events
FROM anon, authenticated;

-- ------------------------------------------------------------
-- 3. Explicitly preserve backend service_role access
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
ON TABLE public.payment_intents
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
ON TABLE public.payment_events
TO service_role;

-- ------------------------------------------------------------
-- 4. No client-facing RLS policies are intentionally created
-- for payment_intents/payment_events.
--
-- With RLS enabled and no policies:
--   anon/authenticated => denied
--   service_role       => allowed
--
-- This is intentional because the application uses the
-- server-authoritative Edge Function payment API.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 5. Harden tenant_payment_methods write access.
--
-- Existing tenant-admin RLS policy remains the authority.
-- Remove broad direct client write grants; RLS continues
-- to determine which tenant administrators may manage methods.
-- ------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
ON TABLE public.tenant_payment_methods
FROM anon, authenticated;

-- Preserve SELECT for existing RLS-controlled behavior.
GRANT SELECT
ON TABLE public.tenant_payment_methods
TO anon, authenticated;

-- Preserve backend access.
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
ON TABLE public.tenant_payment_methods
TO service_role;

COMMIT;
