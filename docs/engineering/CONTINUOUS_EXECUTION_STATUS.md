# MantiqatiX Continuous Execution Status
Last updated: 2026-10-10 14:10 UTC

## Release status
**NOT CERTIFIED.** Source, CI, and disposable-PostgreSQL evidence are not proof that migrations or function definitions are deployed in production.

## Safety/actions taken
- All live Supabase queries in this execution cycle were read-only.
- No production database migrations, grants, RLS/Auth settings, financial data, payments, or payment Edge Functions were changed/deployed. Static GitHub Pages deployment did occur on the latest main commit and passed smoke verification.
- Source/CI-only PRs #124 (cross-PR migration collision guard), #132 (canonical module aliases), and #133 (local migration-version uniqueness guard) were merged after passing CI.
- No changes were merged that apply database migrations or modify production configuration.

## Current main
- Latest main SHA at the time of this update: `5d3a9df1e6020b8cf1337fbc224dc9bfa34e977e`.
- PR #124 was squash-merged as `cb0b0a594f64def5b55488b0229369473091f495`. Cross-PR migration collision guard is on main. CI on its PR head passed: guard run `38052383301`, Module Professionalization Validation `38052383360`, Backend-only Module Boundary `38052383327`; Pages validation passed but deploy was skipped (`38052383344`).
- PR #132 was squash-merged as `ba94b8469f7f5d1d994d70a2c26e80bb7c11a899`. It aligns canonical module flag codes to UI categories and keeps `ACCOUNTING_SERVICES` under professional services rather than MantiGO. CI on head `0de2a2c07516e2988d52ab4d1f6525f52be0ece4` passed: Module Professionalization Validation `38052923207`, Backend-only Module Boundary `38052923211`, Pages validation `38052923232`; deploy job skipped.
- PR #133 was merged as `7dd8dc4b480f69b1314e9b5b883f3146f367f146`, adding local migration-version uniqueness validation alongside the cross-PR guard. Main-commit checks passed, including `validate-migration-versions` run `38053072649`, health run `38053072662`, and Pages deploy run `38053072656`; deploy logs reported smoke verification passed.
- Main branch metadata reports branch protection disabled and no required status checks. No branch-protection write tool was available in this cycle; this remains a governance risk.

## Relevant PRs
- #84 — OPEN, unmerged. Latest observed head: `934f2fc28ec61bdfc5023479b0e796e743244eb1`. Latest Module Professionalization Validation run `38053053450` completed successfully with all 12 jobs, including payment, checkout recovery, search-path, and MantiGO platform-admin integration. Cross-PR collision guard run `38053053434` passed. This is source/isolated-test evidence only; see the live Edge Function parity audit below. Do not merge until RC424 historical migration immutability and source/production parity are resolved.
- #95 — CLOSED without merge; duplicate migration and migration-specific validator/workflow were removed from its branch. No duplicate migration is retained in the active PR set.
- #121 — CLOSED without merge as superseded by the canonical RC441 integration suite in #84.
- #122 — CLOSED without merge; superseded by #133.
- #123 — CLOSED without merge due stale-base workflow conflict; replaced by #132, now merged.
- #124 — CLOSED, merged as above.
- #125 — CLOSED without merge in favor of #124.
- #131 — CLOSED without merge; superseded by #136.
- #133 — CLOSED, merged as `7dd8dc4b480f69b1314e9b5b883f3146f367f146`; adds local migration-version uniqueness validation and its CI workflow.
- #134 — CLOSED without merge; superseded by #136.
- #135 — CLOSED, merged as `3255966463600c58fe581ac02f557f5100c8ea0f`. Migration-history immutability guard is now on main. CI on its head passed self-test and all validation workflows (`38057071404`, `38057071370`, `38057071412`, `38057071431`; Pages deploy skipped).
- #136 — CLOSED, merged as `5d3a9df1e6020b8cf1337fbc224dc9bfa34e977e`. Updated this status report after #135 merged; Module Professionalization Validation (`38057335158`), Backend-only Module Boundary (`38057335147`), and Pages validation (`38057335146`) passed; deploy was skipped on the PR.

## Migration collision remediation
- Latest main includes migration-history immutability gate #135 and migration-version uniqueness guard #133. PR #84 is stale/conflicted against current main and edits historical RC424; it must be rebuilt against current main with RC424 unchanged before review can proceed.
- Migration-history immutability is enforced by `.github/workflows/migration-history-immutability.yml` and `scripts/validate-migration-history-immutability.mjs`, merged via #135. It only allows adding new migration files; edits/deletions of existing migration files fail the PR gate.
- Migration-history immutability gate #135 is now on main. It rejects PR changes/deletions to existing migration files. Existing PR #84 was opened before this gate and its head is stale/conflicted; do not merge it. Rebase/recreate its candidate so the guard runs against the current base, restore historical RC424 exactly, and move any hardening to a new forward-only migration. Main still lacks required branch-protection checks.
- The real conflict was version `20261009170000`: RC430 subscription success webhook in #84 vs duplicate MantiGO admin migration in #95.
- The duplicate migration was removed from #95 and #95 closed without merge. No applied migration was renamed.
- The #124 guard was fixed to ignore GitHub changed-file entries with status `removed`, with a regression self-test. The guard passed on the corrected PR head and is now on main.
- Local uniqueness guard #122 still provides complementary filename checks with a fixed allowlist of exact legacy collisions.

## Live Supabase findings (read-only)
Project: `moyhiluyhjsujhwlyeuu`.

### Migration ledger/source parity
The latest rows returned for versions >= `20261008000000` are:
- `20261008222845 / rc424_atomic_digital_page_payment_webhook`
- `20261008125422 / rc423_convert_authenticated_guard_policies_to_restrictive`

The canonical source file for RC424 is `20261009010000_rc424_atomic_digital_page_payment_webhook.sql`. This source/ledger version discrepancy is unresolved. Do not rename or replay historical migrations blindly.

### Payment RPCs
- Live `process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)` has `search_path=public, pg_temp`, but the current live definition lacks the provider-order binding and replay-status guards expected by RC424/RC431 source/runbook.
- Live finalizer is the legacy four-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`; RC431 source expects a five-argument signature.
- `subscription_payment_intents` lacks `checkout_secret_ciphertext`, `checkout_secret_iv`, and `checkout_secret_key_version`; RC439 encrypted checkout recovery is not reflected in the live schema.
- These are release blockers. Reconcile the exact deployed RC424 artifact and ledger first, then plan a reviewed ordered migration chain and sandbox verification. No production change was made.

### MantiGO platform-wide RPCs
Read-only catalog checks show the following live RPCs remain `SECURITY DEFINER`, use `search_path=public`, are executable by `authenticated`, and do not call `mnty_can_platform_admin()`:
- `get_mantigo_admin_dashboard_backend`
- `get_mantigo_admin_financial_report_backend`
- `settle_mantigo_captain_backend`
- `expire_stale_mantigo_rides_backend`

RC441 source hardens these RPCs behind an active `MNTY-PLATFORM` membership with `SUPER_ADMIN`, `scope=PLATFORM`, and `full_control=true`. CI integration coverage passed, including new ACL assertions, but RC441 is not recorded in the inspected live migration ledger and has not been applied. This is a critical release blocker.

### RLS/table ACL triage
- Supabase advisors reported one anon-executable SECURITY DEFINER function, 40 authenticated-executable SECURITY DEFINER functions, leaked-password protection disabled, and several `auth_allow_anonymous_sign_ins` labels.
- For the inspected finance/module tables, those advisor labels did not match actual `anon` policies: policies were scoped to `authenticated`, and direct `anon` SELECT/INSERT privileges were false on all inspected tables.
- `refund_transactions`, `settlement_attempts`, `settlement_transactions`, `wallet_accounts`, `wallet_transactions`, and `tenant_modules` had FORCE RLS enabled. `digital_page_payment_events` had RLS enabled, no policies, and direct SELECT/INSERT denied to anon/authenticated; this is consistent with backend-only access but must remain an explicit contract.
- Do not bulk-revoke SECURITY DEFINER grants based solely on advisor counts; review each function's intended exposure and authorization behavior.


### Live payment Edge Function parity (read-only audit, 2026-10-10)
- Deployed `paymob-webhook` (live version 8) does not contain the branch's atomic MantiGO/subscription payment RPC paths or the provider-order mismatch guards. It still has direct table writes for parts of the ledger/event/notification flow and an early return on existing events before full replay binding. The deployed source is behind the PR #84 source.
- Deployed `subscription-payment-intent` (live version 2) lacks the RC439 checkout-encryption version/key handling and encrypt/decrypt recovery helpers. This confirms encrypted checkout recovery is not deployed; do not infer more than that from the audit.
- Deployed `digital-page-payment-intent` (live version 3) still uses the legacy four-argument finalizer; the source chain expects the five-argument order-bound finalizer.
- Deployed `payment-intent` (live version 6) lacks the provider-outcome-unknown / already-initialized guards and provider-order persistence expected by the branch.
- No Edge Functions were deployed because the migration ledger, live RPC signatures, and source are not reconciled. A comment documenting these blockers was added to PR #84 (comment ID `6098132918`).

## CI evidence and limits
- RC440 search-path integration passed on #84's tested code head; it tests anon/authenticated exposure, already-hardened and service-only exclusions, grant preservation, and temporary-table shadowing.
- RC441 platform-admin integration passed on #84's tested code head, including positive platform-admin flow, tenant role denials, settlement replay/idempotency, stale-ride expiry/audit/notification, and ACL assertions.
- #84's tested head: `cffbe446630ba717bb5fd05c51ce28cd54bcd0a8`. Later head `6aec05eb58a75c6a5292caa638fe467238d0bfaf` only added read-only diagnostic SQL to `docs/runbooks/VERIFY_PAYMOB_RC424_RC431.sql`; no SQL runtime code changed after the passing tests.
- CI passes do not establish production migration application, real Paymob sandbox E2E, or payment Edge Function deployment. Main commit `7dd8dc4b480f69b1314e9b5b883f3146f367f146` did deploy the static GitHub Pages site and smoke verification passed; that does not certify payment/backend production readiness.

## Next actions, in order
1. Reconcile RC424 source/ledger mismatch and actual live function definition without renumbering or replaying history blindly.
2. Prepare one ordered, reviewable migration release for RC431/RC439/RC440/RC441 and related dependencies; validate full chain on disposable PostgreSQL.
3. Run signed Paymob sandbox E2E: success/failure/replay/conflicting replay, amount/currency/order tampering, callback-before-persistence, concurrency, ambiguous provider timeout, and encrypted checkout recovery. No live payments.
4. Apply RC441 only through a separately reviewed and approved release process; then verify live RPC definitions, grants, and role-negative cases read-only.
5. Triage all SECURITY DEFINER advisor findings per function; address leaked-password protection via authorized Supabase Auth settings.
6. Continue two-user/two-tenant E2E, Auth/OTP, module source-of-truth and membership checks, finance/inventory regression, backup restore on an isolated environment, monitoring/alerts, rollback, and Android build/signing/device gates.
7. Enable main branch protection/required checks through a controlled GitHub repository settings action; main is currently unprotected.

## Status vocabulary
- SOURCE_FIXED: source changed, not yet validated.
- CI_VERIFIED: CI passed for an exact commit.
- ISOLATED_DB_VERIFIED: disposable PostgreSQL integration passed.
- PRODUCTION_VERIFIED: production state checked after approved rollout.
- NOT VERIFIED: no adequate evidence.
