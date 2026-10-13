# Session C — P0 Security & Release Acceptance
Date: 2026-10-13
Branch: `session-c/p0-security-release-acceptance-20261013`
Base SHA: `8a56358d505d2c12878440037f7f24ba65d2ea10`
Supabase project: `moyhiluyhjsujhwlyeuu`

## Decision
**BLOCKED / NOT CERTIFIED.** This document records an independent, read-only acceptance review. It does not authorize production changes, merge, or deployment.

## Evidence inspected

- Main/default branch observed at base SHA `8a56358d505d2c12878440037f7f24ba65d2ea10`.
- [PR #207](https://github.com/islamnagy2022-eng/MantiqatiX/pull/207) is draft; release-chain and SMM/runtime acceptance caveats remain in its body.
- [PR #218](https://github.com/islamnagy2022-eng/MantiqatiX/pull/218) is draft and unmerged. Its latest body records the live migration ledger ending at `20261008222845 / RC424`, with RC449/RC462/RC522/RC523 not applied.
- [PR #219](https://github.com/islamnagy2022-eng/MantiqatiX/pull/219) is draft and unmerged. Its latest head is `61c50bb454213bf5551d62796fe36d42acc13ad5`; workflow run [38343317017](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38343317017) completed **failure**. The RC462 malformed-permission regression itself printed PASS, but the subsequent integration failed at `get_mantigo_admin_financial_report_backend(...)` with `AUTH_REQUIRED` after switching the simulated JWT subject to the platform admin. This is a real behavioral test failure to diagnose in the disposable auth.uid/request-context fixture or guard flow; it must not be waived as a flaky test. The candidate is not production evidence.
- [PR #220](https://github.com/islamnagy2022-eng/MantiqatiX/pull/220) records remaining webhook replay/atomicity/concurrency and provider-sandbox gaps.
- [PR #221](https://github.com/islamnagy2022-eng/MantiqatiX/pull/221) records an SMM deferred-launch gate candidate; live runtime denial is not certified by source alone.
- [PR #222](https://github.com/islamnagy2022-eng/MantiqatiX/pull/222) is a draft authentication/membership contract branch.
- [PR #224](https://github.com/islamnagy2022-eng/MantiqatiX/pull/224) reports static frontend checks passed on an earlier code commit, with browser E2E/runtime checks still not verified.

Read-only Supabase catalog query returned all four MantiGO functions as `SECURITY DEFINER`, with `search_path=public`, `EXECUTE` available to `authenticated`, and the current live definitions do not call `mnty_can_platform_admin()`. The current bodies accept broad tenant roles for global dashboard/report/settlement/expiry. This is a confirmed P0 authorization boundary defect in live production. Do not invoke settlement/expiry against production to test it.

## Acceptance gate matrix

| Gate | Status | Evidence / closure requirement |
|---|---|---|
| MantiGO dashboard authorization | **FAIL — P0** | Live `get_mantigo_admin_dashboard_backend(uuid)` is SECURITY DEFINER, broad tenant role gate, no platform guard. Apply only an approved forward migration; verify non-admin/tenant-admin denial on staging and live read-only catalog parity. |
| MantiGO financial report confidentiality | **FAIL — P0** | Live `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` exposes global aggregates to broad active membership roles. Require current `auth.uid()` match and explicit active `MNTY-PLATFORM` SUPER_ADMIN with `scope=PLATFORM` and `full_control=true`. |
| MantiGO settlement authorization | **FAIL — P0** | Live `settle_mantigo_captain_backend(uuid,text,text)` permits broad finance/tenant roles for global settlement. Candidate must deny non-platform callers before any ledger/journal/audit/notification mutation. |
| MantiGO stale ride expiry authorization | **FAIL — P0** | Live `expire_stale_mantigo_rides_backend(uuid,integer)` permits broad operational roles for global mutations. Candidate must deny non-platform callers before changing rides or creating side effects. |
| Forged `p_admin_user_id` / unauthenticated identity | **NOT VERIFIED on current candidate head** | Require behavioral SQL tests for all four RPCs: missing `auth.uid()`, caller UUID mismatch, tenant OWNER/ADMIN/OPERATIONS_MANAGER, tenant-scoped SUPER_ADMIN, malformed permission JSON; assert denied calls leave ledger/rides/audit/notifications unchanged. PR #219 workflow failed, so its assertions are not accepted as passing evidence. |
| RC462 malformed permission handling | **BLOCKED** | Candidate uses JSON containment and VOLATILE PL/pgSQL guard to fail closed. Run RC449 → RC462 → dependent migrations in disposable PostgreSQL and prove current-head pass; do not infer pass from source inspection. |
| SMM launch containment | **BLOCKED — P0** | PR #221 proposes a fail-closed gate but says live runtime negative test is unverified. Before public release, prove deployed gateway returns denial (e.g. 503) for all SMM actions and causes no provider/wallet/order side effects; capture deployed version/hash. |
| Payment/webhook idempotency and atomicity | **BLOCKED — P0/P1** | PR #220 explicitly identifies inconsistent cross-entity replay checks and separate event/state API calls in several webhook paths. Add atomic DB RPCs, event/order/status binding, concurrent duplicate delivery and fault-injection tests, then provider sandbox reconciliation. |
| Full chronological migration replay | **FAIL / BLOCKED — P0** | Live ledger has 283 rows and ends at `20261008222845 / RC424`. Earlier clean replay failed on missing historical SECURITY DEFINER function creation dependencies. Recover authoritative historical DDL or obtain explicit approval for test-only baselines; never stub functions or skip migrations. |
| CI exact-head acceptance | **FAIL / NOT VERIFIED** | PR #219 run 38343317017 failed. Existing green runs on earlier SHAs cannot be credited to current heads. Every required workflow must pass on the exact candidate SHA. |
| Branch protection / required checks | **FAIL / NOT VERIFIED** | Prior read-only settings report says `main.protected=false` and no rulesets. Re-check and have a repository administrator configure required reviews/checks and direct/force-push restrictions. |
| Backup / restore / DR | **NOT VERIFIED** | Demonstrate a successful restore in an isolated environment and record measured RPO/RTO; a backup-exists assertion is insufficient. |
| Monitoring / rollback | **NOT VERIFIED** | Attach production monitoring/alert smoke evidence, deployment version/hash, rollback owner/runbook, and a rehearsed forward-fix/containment procedure. |
| Build / browser / app E2E | **PARTIAL / NOT VERIFIED** | Static frontend checks are not browser E2E or production smoke. Test current exact SHA, critical routes, role-based flows, mobile layout, and network failures. |
| Production migration / function parity | **FAIL** | Source RC449/RC462 is not applied evidence. Current live catalog still shows vulnerable bodies; do not certify until approved application and post-change read-only verification. |

## P0 closure plan

1. Keep release gate blocked and do not run financial/operational mutation tests against production.
2. Coordinate with S02/PR #219 owner; do not duplicate or overwrite their migration/test files. Review the failed workflow logs and fix the exact cause on the S02 branch.
3. Run the exact candidate chain RC449 → RC462 and the MantiGO negative integration tests on disposable PostgreSQL. Include unauthenticated, forged UUID, tenant roles, tenant-scoped SUPER_ADMIN, malformed permission values, successful platform admin, and replay/no-duplicate side-effect assertions.
4. Reconcile all migrations against the live ledger. Resolve missing historical function DDL without placeholders and run the complete chronological chain on a clean disposable database.
5. Complete SMM runtime containment and payment/webhook concurrency/atomicity gates; do not treat UI deferral or static contracts as server-side proof.
6. Require current-head CI, branch protection, security review, backup restore, monitoring, runtime parity, and rollback evidence.
7. Only after explicit change approval: apply forward-only migration(s) through the normal release pipeline, then perform read-only catalog/ACL verification and safe negative runtime probes. Do not test settlement/expiry by mutating real production records.

## Rollback / containment
Do not roll back to the vulnerable function bodies or rewrite applied migration history. If authorization rollout fails, stop rollout and use a reviewed forward-fix. An emergency exact-signature EXECUTE revocation is a separate production change requiring explicit operator approval; it is not performed here.

## Work performed in this Session C branch
- Created an independent branch from the observed main SHA.
- Added this evidence-based acceptance report only.
- No production writes, migration applications, Auth/RLS/GRANT changes, Edge Function deployments, financial mutations, merge, or release were performed.


## Autonomous continuation checkpoint — 2026-10-13

### New verified CI findings

- PR #207 / migration replay: run [38347561816](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38347561816), job `replay-all-migrations`, failed before Supabase startup/replay in **Verify temporary baselines are exact copies and untracked**. Exact shell error: `line 32: credit_policies_baseline: unbound variable`. The verification step references three credit baseline variables and three temporary migration path variables without declaring them in that step. Variables from a prior GitHub Actions step do not persist into a new shell. This is a confirmed workflow bootstrap bug; it is not evidence that chronological migration replay passed or failed semantically.
- Coordination: posted finding to [PR #207](https://github.com/islamnagy2022-eng/MantiqatiX/pull/207) as comment [6138521154](https://github.com/islamnagy2022-eng/MantiqatiX/pull/207#issuecomment-6138521154). No workflow file was edited in Session C to avoid concurrent ownership conflict.
- PR #219 / MantiGO: run [38343317017](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38343317017) failed with `AUTH_REQUIRED` at the financial-report RPC after switching the simulated JWT subject to the platform admin. RC462 malformed-permission test itself printed PASS, but the full integration did not pass.
- Coordination: posted exact failure and requested inspection of executed RC523 body/identity value to [PR #219](https://github.com/islamnagy2022-eng/MantiqatiX/pull/219), comment [6138522148](https://github.com/islamnagy2022-eng/MantiqatiX/pull/219#issuecomment-6138522148). No S02-owned migration/test files were modified by Session C.

### Action and safety

- Confirmed current `main` remains at `8a56358d505d2c12878440037f7f24ba65d2ea10` from the latest repository commit query.
- The independent Session C branch remains `session-c/p0-security-release-acceptance-20261013`; this checkpoint is being recorded there.
- No production writes, migrations, Auth/RLS/GRANT changes, financial operations, Edge Function deployment, merge, or release were performed.
- Release decision remains **BLOCKED / NOT CERTIFIED**.

### Next executable actions

1. Wait for PR #207 owner/branch to add the six missing local path assignments to the verification step, preserving all exact-copy/untracked/no-data assertions; then inspect the new exact-head replay run and continue diagnosing any actual migration failure.
2. Wait for PR #219 owner to diagnose `AUTH_REQUIRED` against the exact workflow checkout SHA and executed RC523 function; require a complete passing behavioral run, not just static validation.
3. Continue independent read-only release checks and keep this record updated. Do not alter the owned S02 or migration-chain workflow files without coordination.


## Payment webhook independent review — 2026-10-13

- **Source inspected:** PR #220 branch `test/s06-payment-integrity-20261013`, `supabase/functions/paymob-webhook/index.ts`, blob SHA `04d502fb2e01b1f751e10f6ac68b4814ccf220d5`.
- **Verified source findings:** subscription and MantiGO branches acknowledge an existing provider event based only on `provider + external_event_id` without checking its bound intent/order and compatible status; generic payment-intent branch retrieves `payment_intent_id` but does not compare it with the current intent before returning idempotent success. MantiGO failure/success processing persists event and ledger state in separate REST calls and does not check affected-row count; generic failure inserts event and updates intent separately and ignores the update result. Subscription failure updates status separately and uses a different event-persistence path.
- **Risk:** cross-entity replay can be incorrectly acknowledged, and partial failures or status races can leave provider-event records inconsistent with payment state. Source inspection is not proof that all deployed branches share the same code.
- **Coordination:** posted review to [PR #220](https://github.com/islamnagy2022-eng/MantiqatiX/pull/220), comment [6138530408](https://github.com/islamnagy2022-eng/MantiqatiX/pull/220#issuecomment-6138530408), requesting branch-specific replay tests, atomic event/state transitions, affected-row checks, concurrent delivery/fault injection, and sandbox reconciliation.
- **Not performed:** no payment/refund/settlement operation, no production write, no Edge Function deployment, no changes to S06-owned files.
- **Next step:** require the S06 owner to fix and test cross-intent replay and atomicity on an exact candidate SHA; independently verify its CI result before changing the release gate.


## Live SMM deployed-source recheck — 2026-10-13

- **Verified live function inventory (read-only):** Supabase project `moyhiluyhjsujhwlyeuu` reports `smm-gateway` ACTIVE, version `10`, `verify_jwt=true`, deployed source SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`.
- **Verified deployed source:** the fetched live bundle contains `SMM_INITIAL_LAUNCH_DEFERRED=true` and evaluates the launch decision before calling `getUser(req)`; non-OPTIONS POST actions return `503 SMM_DEFERRED` before database reads/writes, wallet operations, or provider calls. This is stronger evidence than the earlier source-only observation.
- **Still NOT VERIFIED:** no safe live HTTP negative probe was available through the connected tools in this run, so actual response status/body, no-side-effect runtime telemetry, and parity with the exact GitHub candidate bundle are not certified. Do not describe this as runtime PASS. The launch gate must remain fail-closed.
- **Other live runtime inventory:** `paymob-webhook` ACTIVE v8, `payment-intent` ACTIVE v6, `subscription-payment-intent` ACTIVE v2, `digital-page-payment-intent` ACTIVE v3, `mantigo-payment-intent` ACTIVE v3; deployed versions/hashes are recorded in the session's live inventory check, not as proof of business-flow correctness.
- **Migration ledger recheck:** 283 rows; last version remains `20261008222845 / rc424_atomic_digital_page_payment_webhook`. RC449/RC462/RC522/RC523 remain unproven as applied by the source reviewed in this checkpoint.
- **Safety:** read-only catalog/source inspection only; no invocation, database write, migration, deployment, secret change, or payment operation performed.


## Release governance and Auth advisor refresh — 2026-10-13

- **Verified GitHub branch metadata:** `main` currently points to `8a56358d505d2c12878440037f7f24ba65d2ea10`; branch API reports `protected=false`, `protection.enabled=false`, and required-status-check enforcement `off`. Repository rulesets endpoint returned an empty list. The direct branch-protection detail endpoint returned 403, so no deeper required-check configuration could be inspected. This is a release-governance blocker; no settings were changed.
- **Verified Supabase Security Advisor:** current security advisor response reports leaked-password protection disabled. This is a confirmed Auth hardening gap, not something to change through this session because Auth production configuration changes are outside the authorized scope.
- **Advisor interpretation:** the advisor also reports anonymous-role policies on multiple tables. These findings require per-policy intent and predicate review; do not apply blanket RLS/grant changes based on lint labels alone.
- **Action performed:** evidence recorded in this Session C report. No branch protection, Auth, RLS, grants, production data, or deployment settings were modified.
- **Next action:** a repository administrator must enable branch protection and required checks under a separately reviewed governance change; an authorized Auth owner must enable and verify leaked-password protection. Both remain open gates.
