# MantiqatiX — Test Execution Ledger

> Append-only evidence ledger. Never erase earlier outcomes. For each run, record the exact tested SHA and what the test does/does not prove. See [Continuation Protocol](CONTINUATION_PROTOCOL.md).

## Current checkpoint

- Working branch: `fix/rc526-mantigo-intent-claim-20261017`
- PR: [#289](https://github.com/islamnagy2022-eng/MantiqatiX/pull/289), Draft/unmerged at the latest previously verified checkpoint.
- Latest code/validator SHA with exact-head passing evidence: `35a9da40dcca1be0448ebe3cceb7da619bafe87e`.
- Later branch head `2953e1e0fb4de8896e61ce38afbdaa811a7c33a8` was recorded as documentation-only after the tested code SHA; this must be confirmed by comparing the actual current diff before reusing the earlier code-test evidence.
- Release gate: **BLOCKED / NOT CERTIFIED**.
- This ledger is being introduced in this continuation batch. Older test runs below were recorded from existing repository session evidence; they are not newly executed by this batch.

## Test records

### TEST-RC526-001 — RC526 disposable PostgreSQL integration
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI / disposable PostgreSQL
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171037](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171037)
- **Scope:** claim exclusivity, finalize/release, duplicate provider-intent rollback, admin reconciliation.
- **Proves:** those covered integration cases passed against the disposable test database at the recorded SHA.
- **Does not prove:** live Paymob sandbox behavior, production parity, full chronological migration replay, tenant isolation, or release readiness.
- **Repeat rule:** reuse for the same code/test/environment; rerun if relevant executable code, test contract, dependency, or environment changes.

### TEST-RC526-002 — Deno type-check and RC446 privacy integration
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171037](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171037)
- **Scope:** Deno type-check and RC446 privacy integration included in the workflow.
- **Proves:** workflow-covered checks passed at the recorded SHA.
- **Does not prove:** external provider runtime or production release readiness.

### TEST-RC526-003 — Migration version uniqueness
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171079](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171079)
- **Scope:** migration version uniqueness.
- **Does not prove:** chronological replay or correctness of absent historical migration source.

### TEST-RC526-004 — Migration history immutability
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171167](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171167)
- **Scope:** migration history immutability.
- **Does not prove:** complete migration replay or provenance of missing DDL.

### TEST-RC526-005 — Open PR migration collision guard
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171044](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171044)
- **Scope:** cross-PR migration collision guard.
- **Does not prove:** that conflicting historical migrations are safe to merge.

### TEST-RC526-006 — Approval action audit atomicity
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171097](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171097)

### TEST-RC526-007 — Backend-only module boundary
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171149](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171149)

### TEST-RC526-008 — Module professionalization validation
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI
- **Result:** PASS (previously observed; not rerun in this batch)
- **Run:** [39008171062](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171062)

### TEST-RC526-009 — Pages validation
- **Tested SHA:** `35a9da40dcca1be0448ebe3cceb7da619bafe87e`
- **Type:** CI / pull request
- **Result:** validation PASS; deploy job SKIPPED (not a deployment)
- **Run:** [39008171088](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171088)
- **Proves:** Pages validation passed for the PR run.
- **Does not prove:** a Pages deployment occurred or production site parity.

## Root-cause blockers — open

### RC-BLOCKER-001 — Historical migration provenance for counter-offer RPC
- **Status:** BLOCKED; root cause of replay failure is confirmed as missing authoritative creation migration in available migration history, but original intended DDL/version remains unknown.
- **Observed symptom:** full chronological replay cannot apply `20260927095000_revoke_unused_security_definer_execute.sql` because `public.counter_offer_indrive_bid(uuid,uuid,numeric)` is absent at that point.
- **Evidence:** [continuity record](PROJECT_CONTINUITY.md); source search found the later revoke migration and documentation, but not the authoritative creation migration. Existing production definition is not proof of its historical source/version.
- **Permanent fix:** recover the original migration from authoritative Git history, a trusted release artifact, or a verified source-control backup; compare exact function body and dependency/grant behavior. If original provenance cannot be recovered, create an explicitly reviewed forward-repair migration with a new version only if maintainers approve the changed migration semantics—never backdate it or invent historical DDL.
- **Acceptance criteria:** chronological disposable replay passes from a documented valid bootstrap without pre-seeding the missing function; migration history/collision guards pass; function security and grants are tested; all results are logged with exact SHA/run IDs.
- **Next action:** inspect historical branches/PR commits and trusted release artifacts for the original function-creation migration and its version; record searched refs and results before any code change.

### RC-BLOCKER-002 — Historical creation provenance for SMM provider credentials table
- **Status:** BLOCKED pending authoritative migration-chain reproduction; previous continuity records state a chronological replay failed at `20260927074200_harden_smm_table_api_privileges.sql` because `public.smm_provider_credentials` did not yet exist in replay.
- **Root cause status:** CONFIRMED as a migration-order/source gap in the replay path; exact original DDL/version not yet established here.
- **Permanent fix:** locate the authoritative table-creation migration or trusted artifact; if unavailable, propose a separately reviewed forward repair based on the verified schema snapshot and explicit security review. Do not preseed the table silently or add speculative history.
- **Acceptance criteria:** isolated replay follows the documented bootstrap and chronological migrations without manual table injection; table shape, RLS, grants, credential secrecy, and service/RPC access tests pass.
- **Next action:** trace all references and historical commits for the table-creation statement and document the first failing replay step with run/log evidence.

### RC-BLOCKER-003 — Live Paymob sandbox end-to-end
- **Status:** NOT VERIFIED; requires authorized sandbox credentials and a controlled test plan.
- **Permanent closure:** exercise create-intention, exact amount/currency/reference correlation, checkout handoff, webhook signature/idempotency, finalization/reconciliation and failure/timeout behavior in sandbox.
- **Acceptance criteria:** provider-confirmed sandbox test IDs and webhook evidence, no real charge, duplicate/replay cases covered, exact candidate SHA recorded.

### RC-BLOCKER-004 — Two-user/two-tenant authorization E2E
- **Status:** NOT VERIFIED; no claim of isolation based only on RLS enabled or static scans.
- **Permanent closure:** run adversarial tests with two independent authenticated users in separate tenants against representative reads/writes and sensitive RPCs.
- **Acceptance criteria:** own-tenant actions succeed as intended; cross-tenant reads/writes and role escalation fail; exact identities/fixtures are disposable test-only, with secrets excluded from logs.

### RC-BLOCKER-005 — Backup/restore and recovery rehearsal
- **Status:** NOT VERIFIED.
- **Permanent closure:** perform an approved isolated restore/recovery rehearsal with verified backup source, record timing and integrity checks, and test application connectivity/data consistency after restore.
- **Acceptance criteria:** evidence for RPO/RTO and successful restore; never claim a rehearsal from backup existence alone.

## Update policy

Append new results chronologically. Keep old results, mark them superseded/stale with a reason when needed, and update blocker status only with evidence. The latest checkpoint must always include exact branch/PR/HEAD and a single next executable action.


## DOC-PROTOCOL-001 — Documentation commit workflow lookup
- **Checkpoint SHA queried:** `6560d2fc7a055c12b4466c1b0a7692559c9e6f13`
- **Type:** GitHub Actions status lookup (not an application test)
- **Observed result:** the commit-workflow lookup returned an empty list. This connector only exposes PR-triggered runs; an empty result is **INCONCLUSIVE**, not PASS, FAIL, or proof that no workflow ran.
- **Test suite rerun:** none intentionally launched in this batch.
- **Required follow-up:** inspect the live PR/checks UI or use a workflow-run lookup that can see the branch's runs. Record each actual result before claiming the documentation commits passed CI.


## 2026-10-17 — SESSION-RESUME-VERIFY-002 — latest branch head, CI results, and RC-BLOCKER-001 provenance search

- **Working branch / PR:** `fix/rc526-mantigo-intent-claim-20261017`, [PR #289](https://github.com/islamnagy2022-eng/MantiqatiX/pull/289), Draft/open/unmerged.
- **Exact HEAD verified:** `67ff58063d616cd077ab8ac91a82acb7f805ae32`; base `main` at `f4059890c656d53d1235ba28d97f703ab35c7299`.
- **Diff reuse decision:** compare `35a9da40dcca1be0448ebe3cceb7da619bafe87e...67ff58063d616cd077ab8ac91a82acb7f805ae32` returned 11 commits and only five documentation paths (`docs/CONTINUATION_PROTOCOL.md`, `docs/MASTER_PRODUCTION_TODO.md`, `docs/PROJECT_CONTINUITY.md`, `docs/SESSION_LOG.md`, `docs/TEST_EXECUTION_LEDGER.md`). No executable code, test, workflow, dependency, or runtime config changed in that range. Therefore prior RC526 code-test evidence at `35a9da40...` remains reusable for that code scope; it was not intentionally rerun.

### CI results inspected at exact HEAD `67ff58063d616cd077ab8ac91a82acb7f805ae32`

These were automatic GitHub Actions runs, not manually rerun tests. Every result below is scoped to its named workflow only.

| Stable record | Workflow / result | Evidence |
|---|---|---|
| CI-289-HEAD-001 | Open PR Migration Collision Guard — PASS | [39009838137](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838137) |
| CI-289-HEAD-002 | Migration Version Uniqueness — PASS | [39009838047](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838047) |
| CI-289-HEAD-003 | Migration History Immutability — PASS | [39009838052](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838052) |
| CI-289-HEAD-004 | Approval Action Audit Atomicity — PASS | [39009838104](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838104) |
| CI-289-HEAD-005 | MantiGO Open Ride Privacy Boundary — PASS (PR event) | [39009838110](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838110) |
| CI-289-HEAD-006 | Backend-only Module Boundary — PASS (PR event) | [39009838061](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838061) |
| CI-289-HEAD-007 | Module Professionalization Validation — PASS (PR event) | [39009838100](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838100) |
| CI-289-HEAD-008 | Module Professionalization Validation — PASS (push event) | [39009836978](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009836978) |
| CI-289-HEAD-009 | Backend-only Module Boundary — PASS (push event) | [39009836834](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009836834) |
| CI-289-HEAD-010 | MantiGO Open Ride Privacy Boundary — PASS (push event) | [39009836894](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009836894) |
| CI-289-HEAD-011 | Deploy MantiqatiX Web workflow — validation PASS; deploy job SKIPPED for PR | [39009838063](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39009838063) |

- **Scope limitation:** these results do not include a new RC526 PostgreSQL/Deno integration run at the docs-only HEAD. The previously successful RC526 + Deno/RC446 run remains [39008171037](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39008171037) on code SHA `35a9da40dcca1be0448ebe3cceb7da619bafe87e`. Passing CI does not certify production, full chronological migration replay, live Paymob, tenant isolation, or backup recovery.
- **Status lookup:** commit status API returned `pending` with zero legacy status entries; the actual workflow/check-run records above were inspected directly. Do not interpret zero legacy statuses as a failure or as an all-checks pass beyond the listed runs.

### RC-BLOCKER-001 — additional provenance investigation (still BLOCKED)

- Queried repository code search for `counter_offer_indrive_bid`; returned only documentation and the later revoke migration, with no function-creation migration.
- Queried commit history for `supabase/migrations/20260927095000_revoke_unused_security_definer_execute.sql`; only creation commit found was `aaae0b57db23b487c9089a74421094f268b0ab00` (message `security: revoke unused privileged RPC execution`), whose diff adds the revoke file only. It contains no creation DDL.
- Checked the revoke migration on these refs: `main`, `reconcile/rc425-441-migration-sources-20261011`, `reconcile/rc425-441-migration-sources-clean-20261011`, `recovery/historical-migrations-rc425-rc441-20261016`, `recovery/rc425-441-source-only-20261016`, `recovery/verified-rc425-441-sources-20261014`, and `fix/production-gate-migration-chain-20261011`. All returned the same blob SHA `8d3fb7330680056b45b4992d298ce1363f069e9d` for the revoke file; this confirms consistency of that file across these refs, not provenance of the function creation.
- Inspected `20261007021500_reverse_bidding_server_authority_v1.sql` on `main` and recovery/reconcile branches. It creates `create_indrive_request_backend` and `create_indrive_bid_backend`, not `counter_offer_indrive_bid`; its timestamp is later than the revoke migration and therefore cannot, by itself, satisfy that earlier replay dependency.
- **Root cause status:** CONFIRMED replay dependency gap; original creation source/version remains UNKNOWN. Existing live `pg_get_functiondef` is current-state evidence only and does not establish historical order.
- **Permanent correction / acceptance:** continue searching authoritative historical PRs/commits, trusted source backup/release artifact, or verified migration archive. If none exists, prepare a separately reviewed forward-only repair plan with a new version and explicit maintainer approval; never backdate, fabricate historical DDL, seed the replay database silently, or skip the revoke.
- **No production changes; no manual tests rerun; no merge/deploy/payment.** Release remains BLOCKED / NOT CERTIFIED.


## 2026-10-17 — SESSION-RESUME-EXEC-003 — historical RPC provenance and repair-path review

- **Working branch / PR:** `fix/rc526-mantigo-intent-claim-20261017`, [PR #289](https://github.com/islamnagy2022-eng/MantiqatiX/pull/289), Draft/open/unmerged.
- **Proposal commit:** `b9a8946a6b0a666775c60302d1569be522219120` adds `docs/release/COUNTER_OFFER_FORWARD_REPAIR_PROPOSAL_20261017.md`. This is a documentation/design artifact only; no migration/function code was changed.
- **Additional historical search:** reviewed all changed-file patches for PR #218 (137 files), PR #207 (329), PR #198 (17), and PR #193 (6). The exact function identifier appears in documentation and in the explicitly test-only live-derived baseline on PR #207, not in an authoritative historical creation migration.
- **Trusted live-derived snapshot located:** PR #207 branch `reconcile/rc425-458-current-main-20261011`, head `676adc5ceeaf774dd27329b42361355b7b2c08eb`; file `supabase/tests/baselines/legacy_security_definer_functions.sql`, blob SHA `ed4270f8fbfa2881fbfd6b251161ec4cbe7fd2c7`. Its header states it is a read-only live catalog snapshot dated 2026-10-12, not recovered historical DDL, and is only for disposable CI replay.
- **Definition metadata in the existing decision record:** owner `postgres`, `SECURITY DEFINER`, `search_path=public`, fingerprint `b0032d51962bddf93a74a679e8449644`; `anon` and `authenticated` cannot execute it in the inspected live ACL. The observed function validates caller/anonymous state and non-negative price, binds bid/request IDs, checks request ownership and editable state, and updates the bid price/note.
- **Critical architectural finding:** a later forward migration cannot fix the earlier missing-function error at `20260927095000_revoke_unused_security_definer_execute.sql`. To exercise later migrations without original source, the only candidate discussed here is a separately approved, test-only live-derived baseline; that result must not be called a complete historical replay. No baseline was copied or enabled on PR #289.
- **Security review note:** a baseline must explicitly restore the captured least-privilege ACL immediately after creating the function; PostgreSQL's default EXECUTE-to-PUBLIC behavior must not accidentally widen access. The current snapshot also lacks an explicit request-row lock; any concurrency hardening requires a separately reviewed behavior contract and tests.
- **CI already inspected on prior exact HEAD `f801dcee6f8d6a808af14216520cac26df186d43`:** 11 automatic workflow runs completed successfully: Migration History Immutability [39010052412], Open PR Migration Collision Guard [39010052400], Migration Version Uniqueness [39010052343], Approval Action Audit Atomicity [39010052490], Module Professionalization Validation [39010052469], Backend-only Module Boundary [39010052480], MantiGO Open Ride Privacy Boundary [39010052381], plus duplicate push-triggered runs [39010048675], [39010048681], [39010048693]. Web workflow [39010052358] concluded success with deploy skipped for the PR. These are checks on `f801dcee...`, not on the later proposal commit.
- **Tests intentionally run in this session:** none. Historical search/review only; no replay, SQL tests, production queries, migration application, deployment, payment, or merge was performed.
- **Next action:** continue seeking a trusted original source/archive. If unavailable, request explicit review/approval for a disposable-only baseline proposal. Keep historical provenance unresolved and release blocked until the chosen replay method and all later blockers are independently verified.


## 2026-10-17 — SESSION-RESUME-VERIFY-003 — reviewed-baseline forward replay and current PR head

### Exact-head PR #289 checks

- PR #289 remains Draft/open/unmerged. Verified head: `74f6768eba37898ef13c66fa057ecb71ebbc3e81`.
- Automatic GitHub Actions runs on that exact SHA:
  - Migration History Immutability — PASS: [39010308171](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308171)
  - Migration Version Uniqueness — PASS: [39010308169](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308169)
  - Approval Action Audit Atomicity — PASS: [39010308167](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308167)
  - Web workflow validation — workflow PASS, deploy job skipped for PR: [39010308176](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308176)
  - Module Professionalization Validation — PASS (PR): [39010308154](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308154)
  - Backend-only Module Boundary — PASS (PR): [39010308164](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308164)
  - Open PR Migration Collision Guard — PASS: [39010308173](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308173)
  - MantiGO Open Ride Privacy Boundary — PASS (PR): [39010308163](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010308163)
  - MantiGO Open Ride Privacy Boundary — PASS (push): [39010304692](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010304692)
  - Backend-only Module Boundary — PASS (push): [39010304784](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010304784)
  - Module Professionalization Validation — PASS (push): [39010304686](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010304686)
- Scope: these are static/targeted CI workflows. Web deploy was skipped; no deployment occurred. None proves production readiness or full historical chronological replay.

### Disposable forward replay — PASS (separate test-only branch)

- Branch: `test/production-baseline-forward-replay-20261017`.
- Exact tested commit: `a79b2caa5b883817f5c1b550d044b09780f06820` (`test(db): include RC526 in reviewed baseline forward replay`).
- Workflow: [Reviewed Production Baseline Forward Replay run 39010395892](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010395892).
- Exact job steps all completed successfully: baseline validator fail-closed tests; baseline provenance/review check; isolated Supabase stack startup using PostgreSQL major 17; schema snapshot restore and forward migrations; upload of exact-run evidence artifact; isolated stack shutdown.
- Artifact metadata observed: `production-baseline-forward-replay-39010395892`, 2336 bytes, not expired at inspection. The artifact contents/count of migrations were not independently read in this inspection, so no numeric forward-migration count is claimed.
- The manifest checkpoint is `20261008222845`, 283 applied versions; schema snapshot SHA-256 `ee16d095177110de67dac57f1b9a1e67610b40a3712981e850eff17d637a67a2`; ledger SHA-256 `0b60096967ef51a912a08b437a10377e2f12d357dd6b25d5dc80677b1f8832b2`.
- **What this proves:** the test-only live-schema baseline, guarded to a disposable local Supabase database, accepted the ordered migrations newer than the checkpoint on that exact test-branch commit, including the RC526 addition.
- **What this does not prove:** original historical creation provenance for `counter_offer_indrive_bid`; blank-database historical replay; production migration approval; live Paymob; tenant isolation; backup/restore; production deployment. This test branch's `APPROVED_FOR_DISPOSABLE_REPLAY` status is scoped to that branch/test environment only, not PR #284 or production.
- Do not rerun this exact test on the same commit/environment unless code, test, dependency, or environment changes or the prior result becomes inconclusive.

### Root blocker remains open

`RC-BLOCKER-001`: authoritative original creation DDL/version for `public.counter_offer_indrive_bid(uuid,uuid,numeric)` remains unavailable in the searched repository history, migration ledger, and checked source refs. The forward replay is a useful separate validation path, but it is not a substitute for the missing historical provenance and must not be presented as full chronological replay.

No production mutations, migrations, deployments, payments, merges, or releases occurred. Release remains **BLOCKED / NOT CERTIFIED**.
