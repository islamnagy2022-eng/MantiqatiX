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

## Latest exact-head verification — 2026-10-11 17:08 UTC

Candidate commit: `b4776f088204c87ec9e723030bd6a026e8a4cb44` (PR #207 remains draft).

- Core Module Professionalization Validation [38158356144](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38158356144): **15/15 jobs passed**. This includes the core `validate` job, financial journal RC450/RC457, MantiGo Paymob atomicity/platform-admin scope, digital-page payment binding, subscription intent, ERP branch scope, checkout recovery, matrimony privacy, targeted-ads search path, SECURITY DEFINER search path, receiving, and order-line integration. The SMM-only wallet/gateway job is deliberately excluded from this core suite.
- Migration Version Uniqueness [38158356140](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38158356140): passed.
- Migration History Immutability [38158356121](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38158356121): passed.
- Pages workflow [38158356081](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38158356081): workflow conclusion is success, but inspect the `deploy` job result before treating this as an actual publication. A green workflow can mean validation passed while deployment was skipped.
- Full chronological Supabase replay is still not proven: preflight remains blocked on ten legacy SECURITY DEFINER creation dependencies. Production migration ledger reconciliation, backup/restore rehearsal, repository branch protection, exact production parity, and final end-to-end acceptance are outstanding.

### Explicit launch scope confirmation

**Yes: SMM product development is deferred until after the initial production launch.** Do not make provider ordering, SMM wallet, provider administration, or the SMM storefront a feature-completion prerequisite for initial launch. Keep the existing internal **Marketing & Advertising** module in launch scope; it is a different module.

However, SMM deferral is not permission to leave a risky API exposed. Before launch, the separately tracked P0 [#212](https://github.com/islamnagy2022-eng/MantiqatiX/issues/212) must prove the live SMM gateway is denied/disabled server-side, with negative tests showing no provider call, order mutation, or wallet change. This is a small launch containment requirement, not a requirement to finish SMM. No production deployment or SMM backend change is authorized or claimed by this document.

Next execution order: (1) finish non-SMM core and integration gates; (2) reconcile migration history/ledger and full replay; (3) finish security, data isolation, backup/restore and production parity evidence; (4) under separate approval, contain SMM gateway before launch; (5) stage rollout only after every global gate passes. Keep PR #207 draft and release status BLOCKED / NOT CERTIFIED until then.

### Exact latest candidate verification — `81968da66a2d3bba894def90f5071b8e99586f7d`

Fresh workflows triggered by the latest scope/evidence update have completed:

- Core Module Professionalization Validation [38158493757](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158493757): **success, 15/15 jobs passed** on the exact candidate SHA.
- Migration Version Uniqueness [38158496914](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496914): **success**.
- Migration History Immutability [38158496895](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496895): **success**.
- Cross-PR Migration Collision Guard [38158496904](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496904): **success**.
- MantiGO Open Ride Privacy Boundary [38158496937](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496937): **success**.
- Backend-only Module Boundary [38158496906](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496906): initial validator passed; integration jobs were still running at the last check, so this workflow is not yet recorded as a full pass.
- SMM Deferred Module Validation [38158496938](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496938): **failed only in the SMM-specific security validator**; its wallet idempotency test and static holding-page quarantine test passed. This is intentionally separate from core acceptance, but the live server-side API containment issue #212 remains mandatory before launch.
- Pages workflow [38158496932](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38158496932): validation passed; deploy job skipped. No production deployment is claimed.

These results improve confidence in core modules but do not clear the full production gate: chronological migration replay, exact live ledger reconciliation after RC424, server-side SMM containment, backup/restore rehearsal, production parity and branch-protection evidence are still outstanding.