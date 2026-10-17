# MantiqatiX — Append-only Session Log

This is the chronological handoff ledger for material project decisions and execution across ChatGPT sessions. The latest state is summarized in `docs/PROJECT_CONTINUITY.md`; the open work list is `docs/MASTER_PRODUCTION_TODO.md`.

## 2026-10-11 — SESSION-001 — Establish cross-session continuity and capture release blockers

- **User requirement:** Every material thing agreed or done across sessions must be referenced in project files so a new session can resume in sequence without re-asking or repeating work.
- **Repository baseline verified:** `main` at `735f0451bf6dae9ed8cf681f83c4856a4b029041`.
- **Verified:** production gate run [38108142127](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38108142127) failed closed; release remains blocked.
- **Verified:** production migration ledger contains 283 migrations through `20261008222845` (RC424); RC425–432 and RC434–441 source files are absent from main and not applied in production.
- **Verified:** PR #202 and PR #84 disagree on RC434 migration `20261009200000_rc434_atomic_erp_purchase_receiving.sql`; collision guard must remain enabled. PR #202 has missing-script CI failures for `scripts/validate-smm-payment-safety.mjs` and `scripts/test-checkout-secret-crypto.mjs`.
- **Verified source parity:** live payment-intent v6, paymob-webhook v8, digital-page-payment-intent v3, subscription-payment-intent v2 match main/PR #202, not PR #84; erp-purchase-receive v1 matches neither PR; smm-gateway v6 matches none of the compared sources.
- **Verified:** live subscription payment flow does not use RC439 encrypted checkout recovery; required columns are not in the live table schema and RC439 is not applied.
- **Verified from live SMM source:** unsafe global-admin fallback via tenant membership roles; no explicit provider-call timeout; ambiguous provider failures can trigger automatic refund; some persistence outcomes are unchecked; status updates lack a terminal-state guard.
- **Verified advisor snapshot:** 94 mixed-severity lints; leaked-password protection disabled; SECURITY DEFINER and policy findings require scoped review, not blanket changes.
- **Action performed:** this continuity protocol and session log are being committed to the repository. Documentation is not a software fix and does not change production.
- **Not performed:** no production DDL/data mutation, no function deployment, no PR merge, no release approval.
- **Next action:** reconcile RC434 variants and the missing migration chain; fix missing CI scripts from authoritative contracts; isolated full replay; then close SMM/payment/security gaps with tests.
- **Release state:** **BLOCKED / NOT CERTIFIED**.

## Logging convention for future sessions

Append a new dated section. Never rewrite or delete historical entries; if a fact is superseded, add a later correction that links to the earlier entry and explains the new evidence. Each session entry should include user decisions, exact code/commit/PR/run references, tests/results, production impact, unresolved risks, and the next executable action.


## 2026-10-17 — SESSION-REMEDIATION — RC565 MantiGO financial report source fix (review required)

- **Live evidence:** Supabase project `moyhiluyhjsujhwlyeuu` reported 283 applied migrations through `20261008222845` (RC424). Do not infer later migrations are applied.
- **Live schema evidence:** `public.mantigo_financial_ledger` contains `gross_amount`, `commission_amount`, and `captain_net_amount`; the deployed `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` references nonexistent `amount` and `captain_amount`.
- **Live authorization evidence:** deployed report RPC authorizes broad tenant roles and does not require platform scope. The existing RC449 source has a platform-admin predicate but still contains the bad amount-column references.
- **Change authored on branch:** `fix/mantigo-financial-report-columns-20261017`. Added forward migration `20261017100000_rc565_mantigo_financial_report_column_scope_fix.sql`, which uses the live ledger columns, requires `public.mnty_can_platform_admin()`, rejects invalid time windows, sets an empty search_path, and explicitly grants EXECUTE only to authenticated after revoking PUBLIC/anon.
- **CI source contract:** added `scripts/validate-mantigo-financial-report.mjs` and wired it into `.github/workflows/pages.yml`. This checks source markers only; it is not proof of PostgreSQL execution.
- **Commit sequence:** `0b7e3c10f5ff5c54f6cec4aea636a833f525df0a` (migration), `bc29518478a75c4e90c5b328c33075d05901a29a` (contract test), `92e4dba1e604523ad9389ea33b3545cda82c50eb` (workflow).
- **Not performed:** no migration was applied to Supabase production; no live function was replaced; no payment or settlement was created; no PR was merged; no production deployment was approved.
- **Still required:** execute the new source-contract test in CI; run migration on isolated PostgreSQL against a representative schema and test authorized/unauthorized actors and empty/boundary date windows; validate all migration-chain dependencies; then open/update a reviewed PR. Production gate remains **BLOCKED / NOT CERTIFIED**.

- **Local source-contract test:** ran the fetched RC565 migration and validator in a scratch Node.js environment; result: `RC565 MantiGO financial report source contract: PASS`. This is static/source evidence only, not PostgreSQL execution.
- **Draft PR opened:** [#282](https://github.com/islamnagy2022-eng/MantiqatiX/pull/282), head branch `fix/mantigo-financial-report-columns-20261017`, head SHA at PR creation `75c1f5ad3abf90a0c51cfe10c890c5194ea41743`. The PR includes 16 recovered historical migration sources and RC565; keep draft because the RC434 authoritative-source collision and full replay remain unresolved.
- **GitHub checks:** no status checks/workflow runs were returned for head SHA at the time of this check. Do not treat CI as passed.


## 2026-10-17 — follow-up verification correction for RC565 / PR #282

- **Correction to the prior checkpoint above:** GitHub Actions are now present for PR head `1d3dec9b6fc3c3cfd15e785c34d6992af234d7ff`; the earlier statement that checks were not yet evidenced applied to an earlier checkpoint.
- **Exact-head workflow evidence:** Migration Version Uniqueness run 38972815308 PASS; Migration History Immutability run 38972815385 PASS; Open PR Migration Collision Guard run 38972815388 PASS; MantiGO Open Ride Privacy Boundary run 38972815408 PASS; Approval Action Audit Atomicity run 38972815488 PASS; Module Professionalization Validation run 38972815484 PASS; Pages workflow validation run 38972815505 PASS. Pages deploy job was **SKIPPED** because this was a pull request, not a main-branch production Pages deployment.
- **Validator execution:** the Pages workflow's `Syntax check` step passed; its command block invokes `node scripts/validate-mantigo-financial-report.mjs`. This proves the source-contract script ran successfully in CI, not that PostgreSQL executed RC565.
- **Live schema recheck:** read-only `information_schema.columns` query confirms the ledger has `gross_amount`, `commission_amount`, `captain_net_amount`, `payment_status`, `settlement_status`, and `created_at`. The live function definition still references nonexistent `amount` and `captain_amount`.
- **Migration source review:** recovered RC434 source is byte-for-byte present on the prior candidate source branch; its comment describes the known pre-RC437/RC438 lack of purchase-order-line enforcement. That source provenance does not prove full replay. Preserve the historical source and do not resolve the chain by inventing or editing applied migration history.
- **PR status:** #282 remains open, draft, unmerged, and GitHub reports `mergeable=false`. Full chronological replay remains NOT RUN / NOT CERTIFIED; the current main branch still has no `supabase/config.toml` in the tested path, and prior replay evidence identifies missing authoritative creation DDL for `public.smm_provider_credentials`.
- **Production impact:** read-only queries only. No production migration, RPC replacement, payment, settlement, Edge Function deployment, or production Pages deployment occurred in this checkpoint.
- **Next action:** add a reproducible disposable replay/bootstrap path from authoritative schema history; stop at first failure; run the complete chain and RC565 behavior tests against isolated PostgreSQL; refresh CI on the resulting exact head. Keep the production gate BLOCKED.


## 2026-10-17 — replay blocker refinement (correction to RC565 follow-up)

- **Correction/precision:** the original historical creation DDL for `public.smm_provider_credentials` is not recovered in the main migration history, but an owner-approved schema-only test baseline does exist on the separate draft reconciliation branch for disposable replay: `supabase/tests/baselines/smm_provider_credentials.sql` (paired with `smm_providers.sql`). Therefore, do not report that table as an unresolved test-bootstrap blocker when that approved fixture is used. It remains test-only and must never be applied to production.
- The separate full-replay candidate's documented deeper failure is missing historical creation DDL for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` before `20260927095000_revoke_unused_security_definer_execute.sql`; prior replay stopped there after schema-baseline preflight. The approved SMM table baseline does not authorize creating placeholder privileged functions.
- PR #282 does not include the full disposable replay workflow/baseline fixtures and does not itself establish complete replay. Its green exact-head checks are static/collision/targeted integration checks only.
- Required next step: recover the authoritative legacy function creation source or obtain explicit approval for a separately reviewed test-only function baseline; do not stub the function, skip the revoke migration, or alter historical SQL. Then rerun the full disposable chain and record the first failing migration if another dependency is missing.


## 2026-10-17 — MantiGO platform-wide RPC scope audit (read-only)

- **Live definitions verified:** `get_mantigo_admin_dashboard_backend(uuid)` uses the correct ledger amount columns, but authorizes broad active membership roles including tenant OWNER/ADMIN/MANAGER/OPERATIONS. `settle_mantigo_captain_backend(uuid,text,text)` likewise accepts broad tenant finance/admin roles for globally scoped MantiGO settlement. `mnty_can_platform_admin()` currently delegates to `mnty_can('admin', NULL, NULL, NULL)`, so it is not itself a strict platform boundary.
- **Live ACLs verified:** all four inspected functions (dashboard, financial report, platform-admin helper, settlement) are SECURITY DEFINER, executable by `authenticated`, and not executable by `anon` or `service_role` according to `has_function_privilege`. Do not blanket-revoke; the primary finding is insufficient platform-vs-tenant authorization scope.
- **Scope of candidate fix:** RC441 introduces explicit `MNTY-PLATFORM` / `SUPER_ADMIN` / `scope=PLATFORM` / `full_control=true` checks for dashboard, report, and settlement. RC565 then fixes the report's ledger column names and validates its time window. These are source-only until the chronological chain is replayed and separately approved; applying RC565 without the preceding platform-scope correction would not be safe.
- **Remaining source robustness note:** the RC441 helper casts `permissions ->> 'full_control'` to boolean; malformed text can raise an exception (fail-closed but operationally brittle). A separate RC462 candidate was identified in prior PR work; review its provenance/order before claiming this edge case closed.
- **Production impact:** read-only catalog/function/ACL queries only. No function was replaced and no settlement/payment was performed. Platform-wide MantiGO access remains a P0 release blocker.


## 2026-10-17 — RC565 PostgreSQL integration wired; RC462 workflow path repair

- Added `supabase/tests/rc565_mantigo_financial_report_integration.sql` to exercise the actual RC565 function on disposable PostgreSQL after RC449 and RC565 are applied in order.
- The test intentionally sets stale fixture aliases `amount` and `captain_amount` to values different from `gross_amount` and `captain_net_amount`; it checks the half-open time window (lower bound included, upper bound excluded), report aggregates, empty-range zeros, invalid-range rejection, tenant OWNER denial, and actor/id mismatch.
- Updated `.github/workflows/mantigo-platform-admin-scope.yml` to run both static validators and then the RC449 authorization integration followed by RC565 SQL integration. Added RC565/test/validator paths to both pull_request and main push filters.
- Exact-head status at SHA `9c7a7580b6efb3628d9f4f0f8ff28d39a368591c`: migration version uniqueness and migration-history immutability passed; cross-PR migration collision guard passed; RC449/RC565 PostgreSQL workflow was in progress, not yet a pass. The subsequent workflow push-filter-only commit advanced to `54436d66973edbd2ae7763731855b50cae23ca17`; exact-head checks were queued at last observation.
- RC462 remains canonical in PR #248; its workflow was corrected there to use the real RC449 migration/fixture and the RC462 test is now included as a job in the existing module-professionalization workflow, which is active on the PR. Its exact-head PostgreSQL regression is queued/not yet passed.
- The full chronological migration replay still lacks authoritative historical creation DDL for `public.counter_offer_indrive_bid(uuid,uuid,numeric)`. Do not stub it or skip/alter the historical revoke migration.
- No production SQL/function replacement, migration, payment, settlement, deployment, or merge was performed. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-17 — RC565 PostgreSQL regression PASS (exact code head)

- **PASS — exact head `44fd01d6d5dafbd2b130e023a806328ebe2766ed`:** MantiGO Platform Admin Scope Hardening workflow [run 38993005417](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993005417) completed successfully. The `platform-admin-postgres` job passed source validators, applied the disposable RC449 fixture + RC449 platform-scope migration + RC565 financial-report migration, and executed both RC449 authorization and RC565 behavioral SQL tests.
- The RC565 regression proves the report uses `gross_amount` / `commission_amount` / `captain_net_amount` rather than deliberately conflicting legacy aliases; it verifies lower-inclusive/upper-exclusive date bounds, aggregates, empty-range zeros, invalid-window rejection, tenant OWNER denial, and actor identity mismatch.
- **PASS on same head:** migration version uniqueness [run 38993005451](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993005451) and migration history immutability [run 38993005429](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993005429).
- Pages/web validation passed on this head, while the deployment job was skipped. Cross-PR migration collision, module professionalization, and MantiGO privacy workflows were still in progress/queued at the time of evidence capture; do not mark the entire PR suite green yet.
- This is focused disposable PostgreSQL evidence only; it is not a full chronological migration replay, live production RPC deployment, or payment/settlement E2E.
- Production remains at 283 migrations through `20261008222845` (RC424); read-only live function definitions still show the old report columns and generic platform-admin helper. No production writes or deployments were performed.
- RC462 malformed-permission regression remains in PR #248; exact-head PostgreSQL job was queued/not yet passed. Full replay still lacks authoritative creation DDL for `counter_offer_indrive_bid(uuid,uuid,numeric)`.


## 2026-10-17 — consolidated RC449 → RC462 → RC565 candidate

- **Correction to the prior note:** RC462 is now also included in PR #282 using the byte-identical canonical migration/test from PR #248. The RC462 migration blob SHA is exactly `8be8dd4537c8e79f3590b5451d9d0d8a08082787`, matching PR #248; the test source was copied byte-for-byte. No migration SQL was reconstructed or edited.
- The MantiGO platform-admin workflow now applies the disposable fixture, RC449 platform-scope migration, RC462 malformed-permission guard and regression, RC449 authorization regression, then RC565 report fix and behavioral regression, in timestamp order.
- The latest PR #282 code head is `2339be895579f335918cdb9a974aa9467df4e954`; all newly triggered exact-head checks are queued. The earlier focused RC449 + RC565 SQL integration passed on `44fd01d6d5dafbd2b130e023a806328ebe2766ed`; RC462's separate focused PostgreSQL regression passed on PR #248 code head `8ca3130985f15401138cfd063c26e1cc38a7851f`. The consolidated three-migration sequence has not yet completed.
- Keep both PRs draft/unmerged while the exact-head consolidated tests and full chronological replay remain incomplete. No production changes.


## 2026-10-17 — consolidated CI first attempt failed in static validator; corrected

- The first consolidated RC449 → RC462 → RC565 run [38993169378](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993169378) failed **before SQL execution** because the newly extended `validate-mantigo-platform-admin-scope.mjs` had an invalid JavaScript string escape in the JSON-containment assertion. The PostgreSQL test step was skipped; this was a validator syntax defect, not a database behavior failure.
- Corrected the assertion to use a JavaScript template literal in commit `1af21eb5534f7891349d0fe01da84524a8a0ae9f`. The exact-head CI batch for that fix was queued at the last observation.
- Do not count the consolidated three-migration sequence as passed until a new exact-head run executes the static validators and PostgreSQL steps successfully.
