# MantiqatiX — Durable Continuation, Test Ledger, and Root-Cause Closure Protocol

**Purpose:** make every session cumulative. The repository—not chat memory—is the durable source of truth. A new session must resume from the latest verified checkpoint and must not restart completed audits or repeat a passed test on the same artifact without a documented reason.

## Mandatory start-of-session sequence

1. Read this file first.
2. Read the latest entries (tail) of `docs/SESSION_LOG.md`, `docs/MASTER_PRODUCTION_TODO.md`, and `docs/PROJECT_CONTINUITY.md`.
3. Read `docs/TEST_EXECUTION_LEDGER.md` and find the latest checkpoint plus all OPEN/ROOT-CAUSE BLOCKED items.
4. Query GitHub for the current default branch, working branch, PR state, exact HEAD SHA, and Actions results. Never assume a SHA or status from an earlier chat is still current.
5. Reconcile the repo state against the ledger. If facts conflict, mark the old fact SUPERSEDED with evidence; do not silently overwrite history.
6. Resume the highest-priority OPEN blocker at its next executable action. Do not repeat completed work merely to regain context.

## Non-negotiable test-recording rule

**Every test actually executed or inspected is recorded in `docs/TEST_EXECUTION_LEDGER.md` and referenced in `docs/SESSION_LOG.md` before the work batch is considered complete.** Update `docs/MASTER_PRODUCTION_TODO.md` when the result changes a gate; update `docs/PROJECT_CONTINUITY.md` with the precise resume point.

Each test record must include:
- Stable test ID; test name and scope.
- Exact commit SHA tested (not merely the branch name).
- Execution type: CI / local / disposable database / staging / production read-only / external sandbox.
- Exact command or workflow and run URL/ID, when available.
- Result: PASS / FAIL / BLOCKED / NOT RUN / STALE; timestamp if available.
- What the evidence proves and what it does **not** prove.
- If failed/blocked: linked root-cause ID, next action, acceptance criteria, and evidence required to close it.

Do not claim a test passed based on source inspection, an intended workflow, a PR comment, or a previous assistant statement. Record only evidence actually observed.

## No-repeat policy

- A completed PASS on the same exact commit SHA, same test definition, and materially equivalent environment is reusable evidence; do not intentionally rerun it just because a new chat started.
- Rerun only when: tested code/dependency/configuration changes; the test itself changes; environment drift invalidates evidence; the prior run is inconclusive/flaky; a security/release gate explicitly requires a fresh run; or a regression is suspected.
- When rerunning, record the reason and link the previous record. Do not erase or replace the old result.
- GitHub Actions may run automatically for a new commit. Record that run, but do not launch duplicate manual runs without a reason.
- A test result is tied to its exact SHA. A docs-only later commit does not invalidate code-test evidence if the diff confirms no executable/config/test input changed; record that scope qualification explicitly.
- A PASS in a disposable database does not prove production parity, live provider behavior, tenant isolation, backup recovery, or deployment success unless that specific boundary was tested.

## Root-cause closure — required for every blocker

For each failure or release blocker, maintain a stable ID (e.g. `RC-BLOCKER-001`) in the test ledger and TODO:
1. **Observed symptom:** exact failing command, error, run, or missing evidence.
2. **Root cause status:** CONFIRMED / HYPOTHESIS / UNKNOWN. Never label a hypothesis as confirmed.
3. **Evidence and provenance:** source path, commit, schema/catalog evidence, logs, links, and what was searched.
4. **Dependency/impact analysis:** upstream prerequisites and downstream tests/features affected.
5. **Permanent correction:** smallest safe fix addressing the cause, not a bypass, stub, fabricated historical migration, weakened guard, or cosmetic documentation-only change.
6. **Acceptance criteria:** objective pass/fail conditions and exact tests needed.
7. **Closure proof:** commit SHA + successful test/run IDs + review needed. Close only when the criteria are met.
8. If source/provenance cannot be recovered, keep it BLOCKED and document the exact missing authoritative input and the safest next retrieval path. Do not invent historical DDL or silently seed a replay database to make it pass.

Resolve one root cause and its consequential regressions before moving to unrelated improvements, unless a prerequisite dependency requires a different order.

## Work batch completion checklist

Before stopping or handing off:
- Record each test run or test result inspected in the ledger.
- Update each affected blocker with evidence and next action.
- Append a dated, chronological entry to `docs/SESSION_LOG.md`.
- Update `docs/MASTER_PRODUCTION_TODO.md` only for changed status/next actions; preserve historical entries.
- Update `docs/PROJECT_CONTINUITY.md` with latest branch/PR/HEAD, current gate, completed work, exact next action, and all safety limits.
- Commit the documentation/code changes to the intended working branch and verify the resulting commit SHA. Do not say files were updated unless the GitHub write and resulting content are confirmed.
- Report concise facts: changed files/commit, tests newly run (with links), tests reused (with SHA rationale), remaining root blocker, and what was not performed.

## Safety and release boundaries

- Keep production release **BLOCKED / NOT CERTIFIED** until mandatory evidence passes.
- No production DDL/DML, migration application, Edge Function deployment, auth/grant/RLS changes, payment/refund/settlement, or merge/release unless the required explicit authorization and release process are satisfied.
- Never fabricate tests, identities, transactions, backups, provider responses, migration provenance, or deployment results.
- Do not disable migration collision/history guards to make replay pass.
- A schema snapshot/baseline may support a clearly isolated disposable test bootstrap only after review; it is not historical migration provenance and must never be applied to production.
- A prompt cannot override unavailable credentials, inaccessible environments, external approvals, or safety gates. If blocked by an external dependency, document the exact required input and continue with independent, safe work.

## Copy/paste prompt for every new session

> Continue the existing MantiqatiX project from the repository checkpoint; do not restart from the beginning.
>
> Repository: `islamnagy2022-eng/MantiqatiX`.
>
> **First read** `docs/CONTINUATION_PROTOCOL.md`, then the latest entries in `docs/SESSION_LOG.md`, `docs/MASTER_PRODUCTION_TODO.md`, `docs/PROJECT_CONTINUITY.md`, and `docs/TEST_EXECUTION_LEDGER.md`. Verify the current GitHub branch, PRs, exact HEAD SHAs, and actual Actions results before making claims or edits. The repository files are the durable source of truth; chat history is secondary.
>
> Resume at the first unresolved root-cause blocker in the ledger, from its recorded next action. Do not repeat completed audits or rerun a PASS test on the same SHA/environment unless the documented no-repeat policy gives a reason. Record every test actually executed or inspected in the test ledger and session log, including exact SHA, command/workflow, run link, result, evidence scope, and what remains unverified.
>
> For every blocker, establish whether the root cause is confirmed, gather authoritative evidence, trace dependencies, implement the smallest permanent fix, run only the necessary tests, record objective acceptance criteria, and close it only with commit and test evidence. Never create speculative stubs, fabricate historical migrations, seed fake production-like data to bypass dependencies, weaken guards, or call documentation a code fix.
>
> Keep working through independent safe tasks without asking me to repeat context. Do not stop after a status report when an executable next action exists. If blocked by missing authoritative source, credentials, external approval, or an unavailable environment, record exactly what is missing and pursue safe independent work; do not pretend the blocker is solved.
>
> Do not mutate production, deploy Edge Functions, apply migrations, change Auth/RLS/grants, perform payments/refunds/settlements, merge, or release without the required explicit authorization and verified release process. Keep the release gate BLOCKED / NOT CERTIFIED until all required runtime, security, payment, recovery, and deployment evidence is real and complete.
>
> At the end of each batch, commit changes to the intended branch, verify the resulting SHA and CI, update all required project records, and report the precise next action so the next session continues from that point—not from the beginning.
