# RC337 — Current security/release gate snapshot — 2026-10-04

## Scope
This record captures the post-RC336 production security state and the reusable verification contract added in RC337. It does not mark external runtime gates as complete.

## Verified production state
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Database: PostgreSQL 17.6.1.155
- Project status: `ACTIVE_HEALTHY`
- Latest migration history ends at `20261004003842 rc336_harden_authenticated_security_definer_search_paths`.
- RC335 hardened the intentionally public targeted-advertisement SECURITY DEFINER RPC.
- RC336 hardened the nine authenticated-callable SECURITY DEFINER RPCs.
- A read-only verification contract is stored at `scripts/verify-rc337-security-definer-hardening.sql`.

## Current Security Advisor
1. `digital_page_payment_events`: RLS enabled with no policies — INFO. Live privilege review shows no direct `anon`/`authenticated` table access. It remains an intentionally backend-only event ledger.
2. One anonymous-callable SECURITY DEFINER: `get_mnty_targeted_advertisements(...)`. This is the intentional public advertisement-serving boundary and has `search_path=public, pg_temp`.
3. Nine authenticated-callable SECURITY DEFINER functions remain intentionally exposed as workflow/RBAC boundaries. All deny `anon` execution and have `search_path=public, pg_temp`.
4. Anonymous-access policy warnings remain because anonymous Auth sessions are still enabled; these require contextual review and/or managed Auth configuration, not mass policy deletion.
5. Leaked Password Protection remains disabled and requires the managed Supabase Auth setting.

## Performance
The live Performance Advisor currently reports 107 unindexed foreign keys and 24 multiple-permissive-policy findings, plus unused-index observations. No mass index/policy rewrite was performed without workload/query-plan evidence.

## Static web security spot-check
- No `eval()` or `new Function()` usage was found.
- No direct browser `service_role` exposure was found by repository search.
- Inspected `localStorage` use is non-secret UI/workspace/pending-flow state.
- Reviewed public-home dynamic `innerHTML` paths escape user/database text before insertion.
- Public advertisement URLs are normalized to HTTP/HTTPS before rendering.
This remains static evidence only and does not replace browser E2E.

## Release blockers
- Leaked Password Protection.
- Two-user/two-tenant adversarial E2E.
- Customer → provider → order → status → notification E2E.
- Real Paymob payment/refund/settlement/GL E2E.
- Browser/PWA/push device E2E.
- Backup/restore and rollback rehearsal.
- Android source reconciliation, signed artifact and real-device verification.
- Final CI/deployment evidence for latest docs/source commits where the available workflow-run connector does not expose a verified push run.

## Decision
**Final Production Gate: OPEN — NOT PRODUCTION READY YET.**
