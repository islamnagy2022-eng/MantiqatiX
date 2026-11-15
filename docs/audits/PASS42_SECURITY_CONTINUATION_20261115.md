# Pass 42 — Security continuation and free-CI verification

**Date:** 2026-11-15  
**Base:** `main` at `1b3a7c445ae236ec17748725254cd43125f8c6ce`  
**Branch:** `docs/pass40-continuity-checkpoint-20261115` (documentation checkpoint branch)  
**Production status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`  
**Cost policy:** No paid resources, no paid Supabase branch, no Staging environment, no subscription or upgrade.

## 1. Source and environment boundary

- Verified the uploaded `bizcatalog-manager (11).zip` SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`. It remains an R7 reference archive; it was not modified or used as a substitute for the live Supabase migration source.
- Current GitHub `main` base is `1b3a7c445ae236ec17748725254cd43125f8c6ce`.
- Live Supabase project is healthy. Migration ledger: **310** rows, latest `20261110150618`. RC464/RC465/RC466 are **not applied**.
- No Production migration, grant/RLS/Auth change, Edge deployment, payment, settlement, data mutation, or Staging creation occurred.

## 2. Live platform-admin boundary — confirmed drift

Read-only Production catalog checks found:

- `private.platform_admins`: RLS enabled; FORCE RLS disabled; owner `postgres` with BYPASSRLS.
- `public.mnty_can_platform_admin()`: SECURITY DEFINER, same owner as the registry, current `search_path=public, pg_temp`, and still delegates to `public.mnty_can('admin', NULL, NULL, NULL)`.
- Direct table privileges: `anon` and `authenticated` have no SELECT/INSERT/UPDATE/DELETE; `service_role` has all four. One private-schema policy exists; no user trigger is attached to the registry.
- Four platform-wide MantiGO SECURITY DEFINER RPCs do not yet call the shared strict helper. Four other global helper callers and three RLS policies depend on the helper.
- The service-role-only bootstrap and registration-review functions exist. The bootstrap function checks that the registry is empty and writes an audit entry. The service-role registry mutation/bootstrap/revocation path still requires an explicit least-privilege and audit review before Production rollout.

This is a verified live authorization-boundary drift, not evidence that an unauthorized request was successfully executed. No sensitive registry rows were read.

## 3. Candidate corrections and CI

| Candidate | Scope | Current status |
|---|---|---|
| PR #724 / RC464 | Canonical private-registry platform admin guard; FORCE RLS; harden four global MantiGO RPCs; empty search_path and narrow RPC grants | Draft, not merged/applied |
| PR #725 / RC465 | Order and order-history business/branch read isolation | Draft, not merged/applied |
| PR #727 / RC466 | Business, branch, department, warehouse and inventory scope | Draft, not merged/applied |
| PR #730 | Combined RC464 → RC465 → RC466 replay and integration candidate | Draft, not merged/applied |
| PR #729 | Continuity and audit documentation | Draft |

Exact combined candidate head: `52075482ddcf30749b4eb75768ce891755df85ea`.

Direct GitHub Actions verification returned 14 workflow runs for this exact head; all 14 completed successfully. The focused RC464, RC465, RC466, combined forward-migration replay, and MantiGO platform-admin-scope jobs all returned PASS. The Pages workflow validation succeeded, while `validate_public_only` and `deploy` were skipped for the pull-request event. The owner-provided Pass 41 report records 17/17 checks; the 14 workflow-run records above are the independently re-queried subset.

CI used a disposable local Supabase/PostgreSQL test environment. This is useful free validation, but it is not a Production deployment, current Production backup restore, or measured RPO/RTO rehearsal.

## 4. Security review queue

- 65 authenticated-callable SECURITY DEFINER functions remain in the live review inventory.
- 59 contain a direct `auth.uid()` reference; they still need per-function authorization and isolation tests, not just string-presence checks.
- Six delegated/helper functions had their call chains inspected. Their helpers bind to `auth.uid()` or validate scoped membership, but this does not certify all callers or all downstream behavior.
- Nine RLS-enabled/no-policy tables remain fail-closed with no direct anon/authenticated CRUD grants. Do not add broad policies.
- Leaked Password Protection remains disabled. No safe Auth-configuration write was performed; it remains an owner-side release gate.
- No blanket revoke, policy rewrite, or speculative migration is authorized.

## 5. Cost and release decision

No paid resources were created or enabled. Staging is deferred until the end-of-project cost review. Continue with free disposable CI tests and read-only Production inspection where safe. Do not apply RC464–466 to Production until the exact migration order, recoverable current backup, rollback/restore evidence, service-role bootstrap/revocation path, human SQL review, and explicit rollout approval are satisfied.

**Next action:** continue the 59-function review in risk-ranked batches, starting with platform-wide and finance/payment RPCs; retain per-function positive/negative tenant, business, branch, anonymous-session and actor-mismatch tests. Keep the overall Production gate blocked.
