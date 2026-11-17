-- These are trigger-only functions. Direct RPC execution is unnecessary.
-- Revoking API-role EXECUTE does not prevent PostgreSQL from invoking them as triggers.
REVOKE EXECUTE ON FUNCTION public.assign_default_owner_to_unowned_business() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_commission_rule_audit() FROM PUBLIC, anon, authenticated;
