# RC335 — Targeted Advertisement SECURITY DEFINER Hardening

Date: 2026-10-04

## Result

- VERIFIED: `public.get_mnty_targeted_advertisements(...)` remains the intentional public advertisement-serving RPC.
- VERIFIED: It remains `SECURITY DEFINER` and callable by `anon`/`authenticated`; revoking anonymous execution would break the public advertisement-serving contract.
- IMPLEMENTED: Hardened the function execution search path from `public` to `public, pg_temp`.
- VERIFIED: Live Postgres now reports `proconfig = {search_path=public, pg_temp}` for the function.
- VERIFIED: No grant was revoked and no user-facing behavior was intentionally removed.
- VERIFIED: `public.digital_page_payment_events` remains RLS-enabled, has zero client table grants for `anon`/`authenticated`, and has zero policies. This remains a deliberate fail-closed backend event ledger; no broad policy was added.
- VERIFIED: Security Advisor still reports the intentional anonymous SECURITY DEFINER finding, the 9 authenticated SECURITY DEFINER findings, and the single RLS-no-policy INFO finding. These are not falsely marked closed by suppressing the advisor.

## Security decision

Do not revoke the targeted-ad RPC's anonymous execution until a replacement public advertisement delivery contract exists and is E2E verified. The safe change in this RC is search-path hardening only.

## Remaining release blockers

- Leaked Password Protection is still disabled and requires the Supabase Auth managed setting.
- Two-user/two-tenant adversarial E2E is not verified.
- Real Paymob/payment/refund/settlement E2E is not verified.
- Backup/restore and rollback rehearsal are not verified.
- Browser/device/PWA/push E2E is not verified.
- Android signed build/device evidence remains blocked.

Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**.
