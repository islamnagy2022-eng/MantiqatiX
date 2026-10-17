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
