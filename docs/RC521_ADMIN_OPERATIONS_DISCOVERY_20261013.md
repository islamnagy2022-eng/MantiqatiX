# RC521 — Administration & Operations Discovery
Date: 2026-10-13
Baseline branch: main
Baseline commit: 8a56358d505d2c12878440037f7f24ba65d2ea10
Supabase project: moyhiluyhjsujhwlyeuu

## Scope
This is an evidence ledger for the first ordered module (Administration & Operations). It does not certify the module or the overall release. It records only facts observed during this read-only discovery session.

## Evidence collected

- Repository metadata confirms `islamnagy2022-eng/MantiqaTiX`, default branch `main`, and owner-level repository permissions for the connected GitHub identity.
- Current `main` head observed at `8a56358d505d2c12878440037f7f24ba65d2ea10` (2026-10-11T03:47:11Z). The latest commit only links continuity records in README.
- Required continuity sources exist: `docs/PROJECT_CONTINUITY.md`, `docs/SESSION_LOG.md`, and `docs/MASTER_PRODUCTION_TODO.md`. The continuity file has older baseline/head references; current API state must supersede those older references where they differ.
- The current Pages workflow defines validation before deployment, and deploy is limited to pushes on main or manual dispatch. A successful PR validation is not a production deployment.
- Open PR #217 is a draft for OAuth PKCE/customer membership recovery. Its latest observed Pages validation run #38319703478 succeeded, but the run is for a draft PR and does not deploy. Related Module Professionalization Validation #38319703780, Backend-only Module Boundary #38319703745, and MantiGO privacy run #38319703687 succeeded on head `f5fb9b61bb49dae90543e6b167517580120013bd`. These are PR-head results, not main-head release certification.
- Supabase project status is `ACTIVE_HEALTHY`, Postgres 17.6.1.155. This is service health only, not application readiness.
- A read-only public-table inventory was retrieved. All table rows in the returned inventory showed RLS enabled; this inventory does not prove correct policies or adversarial tenant isolation.
- A read-only live ACL check on `public.audit_logs` found RLS and FORCE RLS enabled, no user-defined triggers, no direct writes for `anon`/`authenticated`, but `service_role` held direct UPDATE, DELETE and TRUNCATE privileges. The table owner is `postgres`. This does not prove the table is globally immutable.
- The live migration history currently ends at `20261008222845` (`rc424_atomic_digital_page_payment_webhook`); the RC449 and RC522 hardening changes are source-branch proposals only and have not been applied to production.
- The current Security Advisor reported:
  - `public.digital_page_payment_events`: RLS enabled with no policy (INFO). Preserve fail-closed behavior; do not add broad policies to silence the warning.
  - `public.get_mnty_targeted_advertisements(...)`: executable by anon as SECURITY DEFINER (WARN); public behavior must be reviewed against the intended contract.
  - 40 SECURITY DEFINER functions executable by authenticated (WARN); review per function/caller path, never blanket-revoke.
- The master TODO and continuity documents explicitly leave critical runtime gates open: multi-user/multi-tenant E2E, customer-provider-order-notification E2E, real Paymob and finance E2E, leaked-password protection, backup/restore, signed Android/device evidence, and final regression.

## Administration & Operations acceptance matrix

| Acceptance item | Current evidence | Status |
|---|---|---|
| Current baseline and ownership identified | Repository metadata + exact main SHA | VERIFIED (discovery only) |
| Open work, dependencies and release blockers inventoried | Master TODO, continuity file, open PR #217 | PARTIAL |
| CI evidence tied to exact commit and event | SHA `98d1036fe324d134a35258072be9583e2cd34c20`: Module Professionalization Validation, Backend-only Module Boundary, MantiGO privacy integration, approval-action audit atomicity, financial journal integration, and targeted-ads search-path integration passed. Final candidate SHA `60001924a0c6c2775d51a3793d85b34c2728b4e3` includes an additional RC449 report-column fix and regression assertion; its CI is queued. Pages deploy job is skipped on the PR branch. | PARTIAL (prior candidate passed; final candidate pending) |
| Task owner, due date, dependency, acceptance criteria and closure result tracked for each task | No current evidence from this read-only pass that every work item has all fields | NOT VERIFIED |
| Admin actions are role-gated | `validate-admin-workspace.mjs` and `validate-mantigo-platform-admin-scope.mjs` are now included in the Production security validators step; that step passed on candidate SHA `1092710ee197122fe7197cd6463c26b17233a06f`. These are source-contract checks, not live browser E2E. | PARTIAL (static contract passed; live authorization E2E open) |
| Sensitive administrative changes have authoritative audit evidence | RC442 approval-action atomicity passed on prior candidate. Live read-only ACL inspection found `service_role` can directly UPDATE/DELETE/TRUNCATE `audit_logs` and there is no user-defined trigger. RC522 now stages revoking those API-role privileges with a disposable PostgreSQL ACL test; final candidate CI is queued. | PARTIAL (gap found; source fix staged; test pending) |
| Error/conflict/idempotency handling verified in operations workflows | RC442 approval/audit integration, RC450 financial journal integration, RC451 targeted-ads search-path integration, and RC446 MantiGO privacy integration passed in disposable PostgreSQL on SHA `98d1036...`. The added RC449 financial-report totals assertion awaits CI on SHA `60001924...`. General admin operations E2E remains open. | PARTIAL |
| Regression tests pass for the current main head | Required focused CI jobs passed on candidate PR head `1092710ee197122fe7197cd6463c26b17233a06f`; no equivalent full gate is established for `main` at this point. | PARTIAL |
| Production release decision is evidence-based | Project continuity and TODO explicitly block certification | VERIFIED: release remains blocked |

## Safe actions performed
- Read-only GitHub/Supabase inspection plus two repository-branch changes: an evidence report and CI workflow wiring for the admin workspace/platform-admin static guards.
- Candidate-branch CI passed for the validators and listed disposable-PostgreSQL integration jobs on SHA `98d1036fe324d134a35258072be9583e2cd34c20`; Pages validation passed but the deploy job was skipped on this non-main branch. A further RC449 regression was found and fixed on the next candidate: the platform financial report had referenced legacy `amount`/`captain_amount` columns while the canonical ledger uses `gross_amount`/`captain_net_amount`. The report continues returning the existing JSON key `captain_amount` for client compatibility, now sourced from `captain_net_amount`. A regression assertion was added to the disposable PostgreSQL integration test. CI for final candidate SHA `60001924a0c6c2775d51a3793d85b34c2728b4e3` is queued; the fix is not yet counted as test-passed.
- No production SQL writes, migrations, grants/RLS changes, Auth configuration changes, Edge Function deployments, payments, wallet mutations, merges, or releases.
- No customer or membership records were changed.

## Remaining blockers for closing this module
1. Review CI on the exact current candidate SHA; queued checks do not count as passes.
2. Execute live admin/RBAC authorization E2E with authorized test identities and negative cases; static source contracts alone are insufficient.
3. Validate RC522 against the actual production grant model in a controlled migration rehearsal, then require the approved migration/release process before production application.
4. Verify global `audit_logs` actor attribution and fail/rollback behavior across sensitive administrative actions; RC442 only proves one approval path and RC522 restricts API-role direct mutation.
5. Implement and test evidence-backed task closure, owner/dependency/due-date tracking, and closure audit.
6. Reconcile any source/ledger mismatch before database changes; production migrations remain outside this discovery change.

## Percentage scorecard — refreshed against candidate SHA d83a7be0b5482c3c55e9c0536e6bce09625ea645

### Scoring rules
- Implementation % reflects documented implementation gates already present; it is not reset when final E2E evidence is missing.
- Automated test % reflects relevant CI validators/integration workflows completed successfully on this exact candidate SHA.
- Production certification is a separate release gate. Successful disposable PostgreSQL tests do not prove production deployment, live multi-user authorization, real-money flows, or disaster recovery.
- For modules not yet audited gate-by-gate, percentages below are provisional continuity estimates derived from the historical work log, not a claim that every feature was inspected. They must be refined from module inventories, never reset to zero.

### Module 01 — Administration & Operations
- Implementation completeness: **86%** (6/7 documented module gates present).
- Automated candidate verification: **100%** of the 10 defined relevant CI checks completed successfully on the exact candidate SHA: module professionalization, backend-only boundary, RC449 platform-admin scope integration, RC442 approval/audit atomicity, RC450 financial journal integration, MantiGO privacy boundary, RC522 audit ACL integration, migration version uniqueness, migration-history immutability, and open-PR migration collision guard.
- Evidence: [RC449 integration](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310111), [RC522 audit ACL](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310058), [migration history immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310114), [module professionalization](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310066), [backend-only boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310070), [migration uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310043), [collision guard](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38324310131).
- Production E2E: **NOT VERIFIED**. The web workflow's validate job passed, but its deploy job was skipped because this is a pull-request branch. No production migration was applied.
- Remaining implementation gate: evidence-backed task closure with owner, dependency, due date, acceptance criteria, and closure audit.
- Important correction: RC449 historical migration was restored to the exact main contents. Its financial report correction is now a forward-only RC523 migration (20261013200000_rc523_mantigo_financial_report_canonical_columns.sql). The integration fixture deliberately gives legacy aliases incorrect values (999/888) so the regression assertion must use canonical gross/net columns.

### Existing module continuity estimates
These non-zero values preserve previously documented work. They are provisional until each module's full acceptance-gate inventory is rescored; they are not production certification.

| # | Module | Implementation % | Automated test evidence % | Evidence/qualification |
|---:|---|---:|---:|---|
| 01 | Administration & Operations | 86% | 100% | Exact-candidate CI passed; production E2E still open |
| 02 | Technology & Programming | 82% | 78% | Core runtime and CI validators exist; release/security integration gaps remain |
| 03 | Accounting & Finance | 78% | 72% | Finance workspace/journal integration documented; production money-flow E2E remains open |
| 04 | Marketing & Advertising | 76% | 68% | Marketing workspace and lead/ads paths documented; live SMM gateway intentionally deferred |
| 05 | Design & Brand Identity | 70% | 55% | Existing design system/assets work; full accessibility and visual acceptance audit remains |
| 06 | CRM | 85% | 78% | Unified CRM workspace documented with prior CI; live multi-tenant E2E remains open |
| 07 | Service Providers & Sectors | 77% | 65% | Provider onboarding and sector surfaces exist; full service lifecycle E2E remains open |
| 08 | Users, Roles & Permissions | 81% | 70% | Central RBAC guards exist; independent multi-user/cross-tenant runtime verification remains |
| 09 | Database & Security | 75% | 74% | RLS/security validators and recent ACL integrations passed; outstanding advisor/Auth findings remain |
| 10 | Unified Site, App & Platform | 84% | 78% | Unified runtime and workspace layer documented; public runtime/device release checks remain |
| 11 | Analytics & Reports | 80% | 70% | Real-data analytics workspace documented; production metric reconciliation remains |
| 12 | Operations & Task Management | 76% | 68% | Operations workspace and attention queue documented; authoritative task source/closure flow remains |
| 13 | Automation & Notifications | 73% | 62% | Existing notifications and automation paths; end-to-end delivery and failure recovery remain |
| 14 | Content & Platform Management | 72% | 60% | Existing content/platform features; full publication/permission regression inventory remains |
| 15 | Monitoring & Maintenance | 76% | 68% | Health/security center and monitor history exist; production alert-to-remediation verification remains |
| 16 | Backup & Disaster Recovery | 48% | 30% | Explicit outstanding restore/recovery evidence; not certified until a restore rehearsal passes |
| 17 | Testing & Quality Assurance | 82% | 78% | Several CI suites pass on candidate; end-to-end/device and live integration suites remain |
| 18 | Releases & Deployment | 70% | 65% | Candidate validation passes; PR deployment is skipped and production release remains blocked |
| 19 | Governance & Oversight | 75% | 68% | Governance/audit work and migration guards exist; complete action-closure audit remains |

### Current release state
- PR #218 remains open and draft; candidate SHA: d83a7be0b5482c3c55e9c0536e6bce09625ea645.
- Automated candidate checks listed above passed. The deploy workflow's validate job passed; deploy was skipped.
- Release state remains **BLOCKED / NOT CERTIFIED** pending live authorization/tenant E2E, production migration review/application through the approved process, payment/settlement E2E, Auth/security remediation, and restore/device verification.
- No production migration, live financial mutation, merge, or release was performed.

## Next executable action
1. Confirm the RC523 workflow actually applies RC449 then RC523 then runs the poisoned-alias regression fixture (completed in the passing platform-admin workflow).
2. Continue a module-by-module evidence audit using the existing implementation and acceptance records, starting with remaining Administration & Operations gate closure.
3. Keep SMM live gateway isolated/deferred until the release is safe; do not deploy it as part of this batch.


## Continuation update — RC524–RC526 — 2026-10-13

### Additional source recovery and CI changes
- Restored 16 migration sources RC425–RC432 and RC434–RC441 from the reconciled PR #207 branch. The 16 file blob SHAs matched across PR #207, PR #202, and PR #84; the restored candidate blobs were verified against PR #207.
- Added a source-presence assertion to scripts/validate-production-migration-chain-gate.mjs. All 30 required migration filenames in that gate were confirmed to exist in the candidate tree before adding the assertion.
- Added seven disposable PostgreSQL integration jobs for RC425, RC431, RC434, RC435, RC436, RC439 and RC440, plus their fixtures/integration SQL, in .github/workflows/recovered-migration-focused-integration.yml.
- Expanded the migration-chain source list from 28 to 30 by adding RC522 audit-log append-only and RC523 canonical financial-report migrations.
- PR #218 title/body updated to accurately describe source recovery and focused regression gates. It remains a draft and unmerged.

### Latest verification status
- Latest repository head at this report update: 7b97899677781a34b209df8202fdd12fa12b62f8. The latest code-containing candidate is 7cf34432de0d5b604121e00f662f04771de18568; the intervening commit only appends continuity documentation.
- GitHub Actions runs for the new migration-focused workflow and related validators were still queued at the latest inspection. Therefore no new pass is claimed for RC524–RC526 changes. Earlier passing CI on d83a7be0b5482c3c55e9c0536e6bce09625ea645 applies only to that older candidate and its then-present files.
- The workflow is validation-only on this PR; its deployment job is not evidence of production deployment.
- Production migration history was last observed through RC424. RC425+ and RC522/RC523 have not been proven applied to production.

### Remaining blockers
1. Observe completed CI for the latest code-containing candidate; queued/cancelled checks do not count as passes.
2. Run the full chronological disposable migration replay. Earlier historical SECURITY DEFINER function-creation dependencies remain unresolved; do not create stubs or silently expand approved test baselines.
3. Add or restore focused behavioral tests for the remaining required migration contracts where absent; RC432 SMM remains deferred under the launch-scope decision.
4. Complete production authorization/tenant E2E, Paymob and settlement E2E, Auth/security remediation, backup/restore rehearsal, Android signed artifact/device checks, and final regression.

### Percentage and certification interpretation
- The historical module implementation and automated-test percentages above are continuity estimates, not a claim that all features were inspected. They should not be reset to zero because production E2E is incomplete.
- Module-specific production-verification percentages are **not yet defensibly scored** because the denominator of mandatory production acceptance checks has not been inventoried for each of the 19 modules. Do not fill this gap with arbitrary percentages. Overall release certification remains **0% approved / BLOCKED / NOT CERTIFIED** until every mandatory release gate passes.
- No production database writes, migration application, ledger edits, grants/RLS/Auth changes, Edge Function deployments, financial/wallet operations, merge, or release were performed.


## Continuation update — RC527 — 2026-10-13

- Restored three additional migration files (RC457 financial-journal idempotency convergence, RC458 ERP branch organization scope, RC462 malformed platform-admin permission guard) and five associated test sources for RC457, RC441, RC437 and RC458. These restored blobs were checked against the reconciled PR #207 tree.
- Expanded the focused PostgreSQL workflow from seven to twelve integration jobs by adding RC450, RC457, platform-admin RC441/RC449/RC462, RC437 order-line, and RC458 ERP branch-scope jobs.
- Expanded the fail-closed migration-chain list from 30 to 33 ordered required migration sources. The new three files are included in source-existence checks.
- CI for the newest candidate must be inspected; no pass is claimed while runs are queued. Full chronological replay, production migration approval/application, tenant/payment/Auth/security E2E, backup/restore and device-release gates remain open.
- No production changes or release. Overall certification remains **0% approved / BLOCKED / NOT CERTIFIED**.


## Continuation update — RC528 — 2026-10-13

- Revalidated exact PR #218 head `5fd777dacda37e97f4289cb408423135d464ffe7`; draft/open/unmerged.
- Rechecked current-head Actions runs. All inspected runs remained queued at retrieval, including the 12-job focused integration workflow; no new pass is claimed.
- Reviewed the Pages workflow source: deployment requires successful validation and only runs for a push to main or explicit workflow_dispatch, not for a pull-request event.
- Confirmed the migration-chain validator requires 33 source files to exist in timestamp order and separately requires live reconciliation and runtime evidence before release certification.
- No production changes, migrations, deployments, financial operations, merge, or release. Overall release remains **0% approved / BLOCKED / NOT CERTIFIED**.


## RC529 update — 2026-10-13

- Added a disposable PostgreSQL regression test for the RC523 MantiGO financial report. It deliberately separates canonical ledger amounts from legacy amount columns and checks report totals and the stable `captain_amount` JSON key.
- Added the dedicated `mantigo-financial-report-rc523-integration` job to the focused integration workflow and included the RC523 migration/test paths in the trigger filters.
- Current focused workflow run: [38326313929](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38326313929). At inspection, the RC523 job was queued; no pass is claimed.
- No production changes, financial operations, merge, or release. Certification remains blocked pending completed CI and required production/runtime evidence.
