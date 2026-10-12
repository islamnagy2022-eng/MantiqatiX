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

## Percentage scorecard (evidence-based, provisional)
Scoring rule for this first module: equal weight per explicitly listed acceptance gate; VERIFIED = 1 point, PARTIAL = 0.5, NOT VERIFIED = 0. Implementation score counts source/workflow gates present; production-verification score counts gates supported by successful tests against the exact current candidate. A pending CI job earns no verification points. This score is not a claim that uninspected code is absent.

- Administration & Operations — implementation completeness: **86% (6/7 gates present)**. Gates present: admin workspace and role guard; explicit platform-admin scope guard; atomic approval/audit path; CI wiring for guards; corrected platform financial report source plus regression test added; RC522 API-role audit mutation restriction plus integration workflow added. Remaining module-level gate: task closure with evidence/owner/dependency tracking. The audit hardening only blocks API-role direct rewriting/truncation; it does not claim that the table owner is unable to alter history.
- Administration & Operations — production verification: **0% on the current candidate before its CI completes** (0/7 current-candidate gates conclusively passed at the time of this update). CI runs are queued for SHA `c1e258769fa61722ccb8ce77198bb700d770d099`: [Module Professionalization](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38323510654), [Backend-only boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38323510678), [MantiGO privacy](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38323510651), [Audit append-only ACL](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38323510697). Prior candidate SHA `98d1036...` passed the listed source validators and disposable PostgreSQL integrations, but those results do not transfer automatically to the changed candidate.
- Remaining ordered modules — implementation completeness: **0% measured in this scorecard**; production verification: **0% measured in this scorecard**. These are measurement-coverage values only: their module-specific acceptance inventories have not yet been scored; they do **not** mean existing code is 0% complete. Their names and evidence gates will be added and scored in order after the current module closes.
- Administration & Operations status: IN PROGRESS / NOT VERIFIED.
- Overall release: BLOCKED / NOT CERTIFIED.

## Next executable action
Continue the administration/operations gate by waiting for and reviewing CI on exact final candidate SHA `60001924a0c6c2775d51a3793d85b34c2728b4e3`, then live admin/RBAC authorization E2E, and broader audit-log behavior tests. Do not move to the next module until its acceptance criteria are met. If a finding requires a production setting, migration, or privilege change, stage and review it separately and follow the approved release order.
