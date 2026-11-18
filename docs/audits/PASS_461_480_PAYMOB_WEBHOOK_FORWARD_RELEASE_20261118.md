# Pass 461–480 — Paymob webhook forward-release gate

Date: 2026-11-18  
Code baseline: `c85115d4dcc247d1dd4f02cde72ee3224930b7ad`  
Current main after source-map reconciliation: `b7d148dab0f3c8b9a1c8f5d0885f1191d3508fc9`.

## Completed source and website reconciliation

- PR #774 (RC474 payment-intent business/branch scope) is merged. Its exact-head PostgreSQL integration, forward migration replay and related checks passed.
- The GitHub Pages production deployment run `44227923453` completed successfully: all three jobs passed; the deploy job completed 13/13 steps, including root/legacy/preview verification and deployed-origin browser checks.
- PR #778 is merged as `b7d148d`. It corrects the Pages truth: `/MantiqatiX/` is the legacy catalog production root, `/legacy/` is the rollback copy, and `/v6-preview/` is a V6 preview alias. No production-root cutover occurred.
- Latest archive `bizcatalog-manager (11).zip` was re-hashed locally: SHA-256 `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`; ZIP integrity passes. It remains a reference-only R7 candidate; Android wrapper files are preserved. The governing directive is stored in `docs/MASTER_SOURCE_OF_TRUTH.md`.

## RC475 Paymob webhook forward repair — PR #776

- PR #776 adds a forward-only migration because historical RC428–RC430 timestamps predate the live Production migration ledger.
- Static source review confirms all four SECURITY DEFINER processors pin an empty `search_path`, revoke direct execution from PUBLIC/anon/authenticated, and grant execution to `service_role`.
- The Edge webhook removes its early idempotent acknowledgement shortcut and routes verified order/subscription success/failure processing through atomic database RPCs.
- Integration tests cover invalid/NULL signature flags, event/intent/provider-order/amount mismatches, exact replay, cross-intent replay, late failure after success, missing reconciliation evidence and rollback of partial state.
- Exact-head PR checks are still queued; the PR has not been merged. No CI success is claimed for this candidate.
- The test suite reviewed here does not yet demonstrate a separate concurrent multi-session webhook replay test. Unique event constraints and row locks are present; deterministic concurrent replay behavior remains a follow-up verification item.

## Production parity — read-only

Supabase project `moyhiluyhjsujhwlyeuu` is `ACTIVE_HEALTHY` on PostgreSQL 17.6.1.155; organization plan is Free.

- Live migration ledger still ends at `20261110150618`; none of RC464–RC475 are applied.
- Live `create_payment_intent_backend` remains SECURITY DEFINER with `search_path=public, pg_temp`, old tenant-only role matching and authenticated EXECUTE (anon denied). RC474 source hardening is merged but not live.
- Live Paymob aggregate: 0 provider events, 0 order payment intents, 0 subscription payment intents. No payment RPC was invoked.
- No verified off-site logical backup or successful restore artifact is available through the connected environment. Free plan does not provide the daily backup control relied on by higher tiers.
- No Production migration, Edge Function, Auth, RLS, GRANT, payment, wallet, settlement or data mutation occurred.

## Release decision

**Production backend rollout remains BLOCKED / NOT CERTIFIED.** Do not apply RC464–RC475 or replace the live Paymob webhook until:
1. PR #776 exact-head migration replay and PostgreSQL integration checks pass, including any identified replay/concurrency gap.
2. A logical off-site backup is exported and a restore is verified.
3. All required forward migrations are applied in the reviewed order as one controlled release.
4. The matching Edge Function versions are deployed only after their RPC dependencies exist.
5. Post-deploy webhook, payment, reconciliation, authorization and idempotency smoke tests pass without initiating real charges.

No claims of live payment readiness are made by merging source code alone.
