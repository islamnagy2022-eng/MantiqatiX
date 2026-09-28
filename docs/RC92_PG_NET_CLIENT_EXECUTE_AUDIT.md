# RC92 — pg_net Client Execute Boundary Audit

Date: 2026-09-28

## Scope
Audit the pg_net execution boundary after the push-notification trigger was introduced.

## Findings
- pg_net is installed in schema `net`, not `public`.
- The production push trigger `public.mnty_push_notification_hook()` is SECURITY DEFINER and owned by `postgres`.
- The trigger invokes `net.http_post` to enqueue the MantiqaTix push dispatcher request and obtains the dispatch secret from Vault.
- Client-facing table grants on `net` are absent.
- A migration `rc92_lock_pg_net_client_execute` was applied to revoke client/public execute privileges on the pg_net HTTP helper functions.

## Verification limitation
PostgreSQL privilege introspection through the available Supabase interface reports effective EXECUTE for client roles on the extension-owned HTTP helpers even after the revoke. The function ACL itself shows only the extension owner ACL. This is therefore recorded as an infrastructure/extension privilege-introspection limitation rather than a false claim of complete closure.

No push subscription rows or notification rows were created, modified, or deleted by this audit.

## Release status
This does not certify real browser/device push delivery. The production push dispatcher remains separately hardened and real-device delivery remains an external release gate.
