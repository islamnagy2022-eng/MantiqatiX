# RC334 — Security Gate Reverification — 2026-10-04

## Live evidence
- Security Advisor still reports one RLS-enabled/no-policy table: `public.digital_page_payment_events`.
- The table is confirmed RLS-enabled in live PostgreSQL.
- The public `get_mnty_targeted_advertisements` SECURITY DEFINER function is intentionally an anonymous advertisement-read boundary; its query only exposes active/approved advertisement metadata and bypasses direct target-location access, whose RLS denies direct access.
- Live privilege inspection confirms sensitive SECURITY DEFINER functions are not anonymously executable except the targeted-advertisement read endpoint.
- Authenticated SECURITY DEFINER functions are deliberate backend/RBAC boundaries; blanket revocation would break protected server paths and was not performed.
- Advisor also reports anonymous-access-policy warnings because the project supports the authenticated role and explicitly denies anonymous JWT sessions through multiple policies. These findings require configuration/runtime interpretation rather than blanket policy deletion.

## Decision
No unsafe production SQL change is justified by the current advisor output alone.

## Remaining P0/P1 evidence gates
- Supabase Leaked Password Protection: WAITING FOR USER / dashboard configuration.
- Multi-account / multi-tenant adversarial E2E: NOT VERIFIED.
- Payment/refund/settlement E2E: WAITING FOR controlled provider credentials/authorization.
- Backup/restore + rollback: NOT VERIFIED.
- Browser/device/PWA/push E2E: NOT VERIFIED.
- Android source reconciliation + signed build/device test: BLOCKED.

## CI
Latest documentation baseline commit `489c6d7f4aa94077c0b592dcaa32796ddb3b34e4` passed GitHub Pages CI run `37165246698`.

## Final status
Production Gate remains OPEN. No synthetic production data or fake runtime evidence was introduced.
