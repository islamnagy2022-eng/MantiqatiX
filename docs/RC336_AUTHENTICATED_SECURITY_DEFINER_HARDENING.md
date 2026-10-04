# RC336 — Authenticated SECURITY DEFINER Search-Path Hardening

Date: 2026-10-04

## VERIFIED

- Re-inventoried all 9 `SECURITY DEFINER` functions currently executable by `authenticated`.
- All 9 remain `anon_execute=false` and `authenticated_execute=true`.
- The intentional public targeted-ad RPC remains the only `anon`-callable SECURITY DEFINER function.
- Live Postgres now reports `search_path=public, pg_temp` for all 9 authenticated-callable SECURITY DEFINER functions.
- Source/runtime review confirms the critical backend/RBAC functions use `auth.uid()`, active membership or centralized permission checks as applicable; the change did not alter their grants or authorization predicates.
- Security Advisor was re-run after the change. The SECURITY DEFINER warnings remain because the functions are intentionally executable through authenticated RPC boundaries; they are not falsely suppressed.

## NOT CHANGED

- No EXECUTE grants were revoked.
- No RLS policy was broadened.
- No financial data or production business data was created.
- No public advertisement delivery behavior was disabled.

## Remaining P0/P1 release gates

- Leaked Password Protection: WAITING FOR USER / Auth managed setting.
- Multi-user/two-tenant adversarial E2E: NOT VERIFIED.
- Paymob/payment/refund/settlement E2E: WAITING FOR controlled production credentials/authorization.
- Backup/restore/rollback: NOT VERIFIED.
- Browser/device/PWA/push E2E: NOT VERIFIED.
- Android signed build/device evidence: BLOCKED.

Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.
