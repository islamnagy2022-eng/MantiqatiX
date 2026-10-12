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
| CI evidence tied to exact commit and event | Candidate PR head `1092710ee197122fe7197cd6463c26b17233a06f`: Module Professionalization Validation, Backend-only Module Boundary, MantiGO privacy integration, approval-action audit atomicity, financial journal integration, and targeted-ads search-path integration passed. Pages validation passed; deploy job was skipped because this is not `main`. | VERIFIED (candidate branch only) |
| Task owner, due date, dependency, acceptance criteria and closure result tracked for each task | No current evidence from this read-only pass that every work item has all fields | NOT VERIFIED |
| Admin actions are role-gated | `validate-admin-workspace.mjs` and `validate-mantigo-platform-admin-scope.mjs` are now included in the Production security validators step; that step passed on candidate SHA `1092710ee197122fe7197cd6463c26b17233a06f`. These are source-contract checks, not live browser E2E. | PARTIAL (static contract passed; live authorization E2E open) |
| Sensitive administrative changes have authoritative audit evidence | Approval-action audit atomicity integration workflow passed on candidate SHA, exercising the RC442 migration against disposable PostgreSQL. This proves that specific approval transition's audit atomicity contract, not global `audit_logs` append-only behavior or every administrative action. | PARTIAL |
| Error/conflict/idempotency handling verified in operations workflows | RC442 approval/audit integration, RC450 financial journal integration, RC451 targeted-ads search-path integration, and RC446 MantiGO privacy integration passed in disposable PostgreSQL on the candidate branch. General admin operations E2E remains open. | PARTIAL |
| Regression tests pass for the current main head | Required focused CI jobs passed on candidate PR head `1092710ee197122fe7197cd6463c26b17233a06f`; no equivalent full gate is established for `main` at this point. | PARTIAL |
| Production release decision is evidence-based | Project continuity and TODO explicitly block certification | VERIFIED: release remains blocked |

## Safe actions performed
- Read-only GitHub/Supabase inspection plus two repository-branch changes: an evidence report and CI workflow wiring for the admin workspace/platform-admin static guards.
- Candidate-branch CI passed for the validators and the listed disposable-PostgreSQL integration jobs; Pages validation passed but the deploy job was skipped on this non-main branch.
- No production SQL writes, migrations, grants/RLS changes, Auth configuration changes, Edge Function deployments, payments, wallet mutations, merges, or releases.
- No customer or membership records were changed.

## Remaining blockers for closing this module
1. Establish a reproducible current-main validation run and record exact SHA plus all required jobs; candidate-branch green checks do not substitute for main/release certification.
2. Execute live/admin authorization E2E with authorized test identities and negative cases; static regex/source contracts alone are insufficient.
3. Verify global `audit_logs` actor attribution, append-only expectations, and fail/rollback behavior across sensitive administrative actions; RC442 only proves one approval-action path.
4. Verify task/work-item closure requires evidence and cannot be marked VERIFIED merely because implementation is present.
5. Reconcile any source/ledger mismatch before database changes; production migrations remain outside this discovery change.

## Percentages
- Implementation completeness: NOT RATED. The discovery evidence does not provide a complete, enumerated implementation inventory sufficient for a defensible percentage.
- Production verification: NOT RATED. Main-head regression, live authorization E2E, audit behavior, and operations workflow tests have not been demonstrated by this session.
- Module status: IN PROGRESS / NOT VERIFIED.
- Overall release: BLOCKED / NOT CERTIFIED.

## Next executable action
Continue the administration/operations gate with exact-main CI evidence, live admin/RBAC authorization E2E, and broader audit-log behavior tests. Do not move to the next module until its acceptance criteria are met. If a finding requires a production setting, migration, or privilege change, stage and review it separately and follow the approved release order.
