# Initial Production Launch Scope — SMM Deferred

**Decision:** Keep the internal **Marketing & Advertising** module in the initial release scope. Defer the separate **Digital Marketing Services (SMM)** storefront and its provider/order/wallet/admin functionality until after the platform's actual production launch.

**Current release status: BLOCKED / NOT CERTIFIED.** This scope decision removes SMM feature-readiness from the initial product acceptance list; it does not waive platform-wide security, migration, payment, data-isolation, backup/restore, or deployment gates.

## What the customer sees

- The homepage continues to show an SMM entry, explicitly labelled **"قيد التطوير — خارج نطاق الإطلاق الأول"**.
- `web/smm.html` is a static holding page and must not load `web/smm.js` or expose order, wallet, provider, or admin controls.
- The ordinary **Marketing & Advertising** module remains distinct and is not deferred. It covers MantiqaTix's own campaigns, marketing-company collaboration, advertising, and lead generation.
- No SMM order, provider credential, wallet top-up, refund, or provider-admin operation is part of initial launch acceptance.

## Critical backend caveat

The static page only quarantines the browser storefront. Read-only source inspection shows that the production `smm-gateway` Edge Function is still active (live version 6 was previously observed), and the candidate gateway source does not yet meet its provider timeout/ambiguous-outcome/refund safety contract. Hiding the page is **not** equivalent to disabling the API.

Before the initial launch, the release owner must ensure that the live SMM API is inaccessible to ordinary customers while deferred. This requires an explicitly approved, reviewed server-side disable/deny gate or equivalent verified server-side access control, plus a live negative test proving customer requests are rejected without creating orders or changing wallets. No production Edge Function was changed or deployed by this PR. Do not certify launch based on the static page alone.

## CI separation

- Core module validation now excludes the SMM-only wallet/security job so SMM-specific unfinished work does not prevent independent progress on other modules.
- SMM wallet idempotency and gateway safety checks live in `.github/workflows/smm-deferred-validation.yml`. They remain visible and can fail; failures must not be relabelled as passes.
- The deferred SMM workflow is not an initial-launch acceptance check. Do not add it to required checks while SMM remains intentionally deferred.
- General-purpose checks removed from the SMM job were moved into the core `validate` job so unrelated release protections remain enforced.

## Launch blockers that remain regardless of SMM deferral

1. **Historical migration replay:** the chronological chain stops at `20260927095000_revoke_unused_security_definer_execute.sql` because ten legacy SECURITY DEFINER functions are missing from earlier committed creation history. The SMM table baselines are approved for test-only replay; a legacy function baseline is not approved. Recover authoritative DDL/history or obtain separate explicit approval before using a test-only baseline. Do not create placeholder functions, skip the revoke migration, rewrite applied history, or backdate production migrations.
2. **Production migration reconciliation:** live ledger evidence currently ends at RC424; required post-RC424 migrations are not proven applied. The release gate must remain fail-closed.
3. **Cross-module acceptance:** tenant/branch isolation, payment-finance E2E, backup/restore rehearsal, Edge Function parity, Auth hardening, and module registry/entitlement checks need current evidence.
4. **Repository protection:** `main` had no active branch protection/ruleset reported by read-only inspection. Configure required reviews and core release status checks and prohibit direct/force pushes before certified release.

## Evidence and safe execution order

1. Keep SMM storefront as a holding page; keep the internal marketing module enabled.
2. Securely disable the live SMM backend before launch, under separate approval, and verify negative access behavior in production.
3. Resolve historical replay dependencies without changing production or rewriting migration history.
4. Run the full disposable migration replay and core integration/security suites.
5. Reconcile exact live migration ledger/source versions and complete module-by-module production readiness checks.
6. Rehearse backup restoration and rollback; confirm observability and incident response.
7. Only then authorize a staged production rollout. Keep this PR draft and the production gate blocked until all gates pass.

## Non-goals

This decision does not claim the platform is production-ready, does not certify SMM, does not authorize a production migration or Edge Function deployment, and does not turn any failed or unrun check into a pass.


## Current execution evidence — 2026-10-11

- Core module suite run [38157684756](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38157684756) completed **success** on candidate commit `4f6562b8b38ad43131c614e5838fa8ab24e535ba`. All 15 jobs in that run passed, including financial journal RC450/RC457, MantiGo Paymob atomicity and platform-admin scope, digital-page payment binding, subscription intent, ERP branch scope, checkout recovery, matrimony privacy, targeted ads search path, SECURITY DEFINER search path, receiving, and order-line integration. SMM-only wallet validation was intentionally separated from this core suite.
- The newer core suite [38157693424](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38157693424) completed **success** on candidate commit `8bc538e7f0802c57a6762f5bbc8448cba01d6249`; all 15 jobs passed, including the previously in-progress receiving, platform-admin scope, checkout recovery, and finance RC457 checks.
- Migration version uniqueness and migration-history immutability checks passed on the newer candidate. The disposable full chronological migration replay remains **blocked** by the ten legacy SECURITY DEFINER function dependencies documented in `MIGRATION_REPLAY_BLOCKERS.md`.
- GitHub Pages workflow [38157693453](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38157693453) passed its validation job, but its deploy job was skipped. This is not evidence of a completed production deployment.
- Release remains **BLOCKED / NOT CERTIFIED**. The SMM deferral is a product-scope choice, not a waiver of the independent global release blockers. In particular, the live SMM gateway must be disabled or denied server-side under approved change control before launch; the static holding page alone is insufficient.

### Read-only production migration ledger reconciliation

Read-only query against the live Supabase migration ledger on 2026-10-11 returned **283 applied migrations**, latest version `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). The current `main` repository directory contains 139 SQL migration files. This difference must be reconciled through the project's established migration-history process; do not infer that a lower file count means applied migrations are missing or recreate historical files from guesses.

Repository migrations with timestamps after the live ledger's latest version were observed as:

- `20261009010000_rc424_atomic_digital_page_payment_webhook.sql` — same RC label, later timestamp; investigate as a distinct candidate migration and collision/history concern.
- `20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql`.
- `20261010120000_rc442_approval_action_audit_atomicity.sql`.
- `20261010140000_rc444_crm_business_scope_rls.sql`.
- `20261010150000_rc447_matrimony_profile_privacy_boundary.sql`.
- `20261010161000_rc448_matrimony_request_lifecycle_authority.sql`.
- `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`.
- `20261010175000_rc449a_financial_journal_schema_prerequisites.sql`.
- `20261010180000_rc450_financial_journal_service_role_boundary.sql`.
- `20261010200000_rc451_targeted_ads_empty_search_path.sql`.
- `20261010210000_rc452_marketing_crm_tenant_scope.sql`.
- `20261010220000_rc453_marketing_campaign_backend.sql`.
- `20261011010000_rc456_smm_service_role_access_boundary.sql` — SMM-specific; defer from initial-launch scope only after a dependency review confirms it is not a prerequisite for any core gate. Never skip or apply it by label alone.

The full ordered replay is currently fail-closed before database startup because the earlier historical revoke migration references ten legacy SECURITY DEFINER functions whose authoritative creation DDL is absent from the chronological repository history. Consequently, the list above is an inventory, **not an approved production migration batch**. Before any production migration, reconcile the live ledger with exact SQL hashes/definitions, recover authoritative history, pass the full disposable replay, then obtain explicit rollout approval.