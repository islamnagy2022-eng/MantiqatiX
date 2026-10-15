-- RC522: prevent API roles from rewriting or truncating audit history.
-- The table owner remains the controlled break-glass authority; application roles are append/read only.
begin;
revoke update, delete, truncate on table public.audit_logs from public, anon, authenticated, service_role;
commit;
