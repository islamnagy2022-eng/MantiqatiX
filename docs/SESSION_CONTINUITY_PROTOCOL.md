# MantiqaTix — Mandatory Session Continuity & Evidence Protocol

**Protocol version:** 1.0  
**Effective date:** 2026-10-14  
**Applies to:** every ChatGPT session, engineer, agent, workstream, PR, and release activity for this repository.  
**Goal:** a new or resumed session must continue from the recorded state without losing work, repeating completed reviews without cause, or deviating from the approved production-release plan.

## 1. Non-negotiable rule

Before doing project work, read `docs/NEXT_SESSION_RESUME.md` first, then this protocol, `docs/MASTER_PRODUCTION_TODO.md`, `docs/PROJECT_CONTINUITY.md`, the tail of `docs/SESSION_LOG.md`, and the relevant domain record. Do not restart from memory or from a chat transcript when repository records are available.

At the end of every work batch, update the continuity records in the same branch/PR as the work. A batch is not considered handed off until the resume file, master TODO, and append-only session log agree on status and next action.

## 2. Source-of-truth hierarchy

When records disagree, resolve them in this order and document the resolution:
1. **Live verified system evidence** for actual runtime/production state (read-only inspection unless an approved change explicitly permits writes).
2. **Exact GitHub repository state**: branch, commit SHA, PR, files, checks, and review status.
3. **Current evidence artifacts** with timestamps, command/query details, result, environment, and commit SHA.
4. **`docs/NEXT_SESSION_RESUME.md`** — the compact current handoff and next action.
5. **`docs/MASTER_PRODUCTION_TODO.md`** — canonical requirement/task register.
6. **`docs/SESSION_LOG.md`** — append-only history of work batches.
7. **`docs/PROJECT_CONTINUITY.md`, baseline and audit docs** — context and domain evidence.
8. Conversation history — helpful context, never the sole record of completed work.

Never silently overwrite conflicting history. Append a correction with evidence and keep the original entry.

## 3. Required status vocabulary

Use only the following task statuses and do not conflate them:
- `TODO`: not started.
- `IN PROGRESS`: actively being worked.
- `WAIT`: awaiting an external dependency, owner action, or scheduled event.
- `BLOCKED`: a known blocker prevents safe progress.
- `DONE`: implementation/action completed, but not necessarily tested.
- `VERIFIED`: the expected result passed with a cited, current, reproducible evidence reference.
- `NOT VERIFIED`: evidence is absent or insufficient.
- `PARTIAL`: some, but not all, required work/evidence is complete.
- `NOT APPLICABLE`: explicitly justified with rationale.
- `SUPERSEDED`: replaced by a newer record; preserve the old record and link to the replacement.

**DONE is not VERIFIED. VERIFIED is not Production Ready.** Release certification requires every mandatory release gate and explicit evidence.

## 4. Required record for every work batch

Every implementation, fix, review, comparison, test, deployment, or decision must record:
1. Work-batch ID and UTC timestamp.
2. Domain and approved plan step/requirement IDs.
3. Starting branch and commit SHA; working branch and resulting commit SHA.
4. Exact files, functions, migrations, configuration, or systems inspected/changed.
5. Why the action was needed and what triggered it (new change, failure, stale evidence, conflict, required next plan step, or owner decision).
6. Action performed and exact evidence references (PR/commit/path/check/run/query/report).
7. Result and status using the vocabulary above.
8. Tests actually run, environment, and outcome. Distinguish static checks, isolated integration tests, staging tests, and production E2E.
9. Side effects: what was not changed, especially production DB, data, secrets, payment systems, deployed functions, and release settings.
10. Open risks/blockers and the owner/action required.
11. One exact next action, its prerequisites, and a completion criterion.
12. Whether a prior review is now superseded, still valid, or needs rerun—and why.

If any field is unknown, record `NOT VERIFIED`; do not invent it.

## 5. Preventing unnecessary repetition

Before repeating any review or comparison:
1. Search the current evidence register and session log for the exact target and method.
2. Confirm whether the underlying commit, file hash, PR head, schema version, runtime version, configuration, or test environment changed.
3. If no relevant change occurred and the evidence is still valid, reuse and cite the existing result.
4. Rerun only when at least one trigger applies:
   - the relevant input/commit/source/runtime/configuration changed;
   - a previous test failed, was cancelled, incomplete, or had an unclear result;
   - evidence is stale for a time-sensitive control;
   - new contradictory evidence exists;
   - the earlier check did not cover the current scope;
   - a release gate explicitly requires a fresh run.
5. Record the trigger before rerunning, then record the new result and whether it supersedes the old one.

Never rerun broad audits merely to appear busy. Never skip a mandatory fresh gate because an old run passed.

## 6. Change safety and release discipline

- Follow the existing master TODO and release-gate ordering; do not create a parallel implementation or alternate architecture without an explicit decision.
- Do not merge drafts, deploy, apply production migrations, modify production data, rotate secrets, change Auth settings, or perform real financial transactions without explicit authorization and the required preconditions.
- Migration work requires source/ledger reconciliation, uniqueness and order/dependency checks, review of SQL and dependent Edge Functions, and a successful disposable chronological replay before production consideration.
- Never add broad RLS policies or blanket grants/revokes just to silence an advisor. Review each table/function's access contract and least-privilege boundary.
- Do not claim CI passed unless the exact current commit has a returned successful check. Distinguish cancelled, skipped, pending, failed, and absent checks.
- Preserve auditability: forward-only migrations, append-only session history, no secrets in repository, no fabricated evidence, no false green status.
- If blocked, do safe independent work only when it does not bypass the blocker; record the blocker and next required action.

## 7. Session start checklist

- [ ] Read `docs/NEXT_SESSION_RESUME.md`.
- [ ] Confirm current repository, branch, HEAD SHA, active PR, and working tree/PR state.
- [ ] Read the last 3 session-log entries and current TODO for the active domain.
- [ ] Check whether any relevant commit, PR head, workflow, migration ledger, runtime, or security finding changed since the last evidence.
- [ ] Reuse still-valid evidence; do not repeat unchanged comparisons.
- [ ] Execute only the exact next action, unless new evidence requires a documented plan adjustment.
- [ ] Before changing code or production state, verify preconditions and authorization.

## 8. Session close / handoff checklist

- [ ] Update `docs/MASTER_PRODUCTION_TODO.md` with statuses and evidence.
- [ ] Append a unique entry to `docs/SESSION_LOG.md`; never rewrite old entries.
- [ ] Update `docs/PROJECT_CONTINUITY.md` when baseline, blockers, domain status, or plan changes.
- [ ] Update `docs/NEXT_SESSION_RESUME.md` last, after all other records, so it points to the exact latest state.
- [ ] Record branch, final commit SHA, PR link/state, and actual CI state.
- [ ] Record exact next action and acceptance criteria.
- [ ] Verify that links/files exist and that the records agree.
- [ ] State explicitly what was not done and why.
- [ ] Do not mark a task VERIFIED or a release gate PASS without evidence.

## 9. Required handoff template

```text
SESSION / BATCH ID:
UTC timestamp:
Repository / branch / start SHA:
Working branch / final SHA:
Active PR / status:
Plan domain and requirement IDs:
Trigger for this batch:
Actions performed:
Files and systems changed:
Evidence references:
Tests and environment:
Status by task:
Risks / blockers / owner actions:
Production side effects (or explicit none):
Previously completed checks reused:
Checks rerun and why:
Exact next action:
Acceptance criteria:
Release gate state:
```

## 10. Current canonical records

- Current handoff: `docs/NEXT_SESSION_RESUME.md`
- This protocol: `docs/SESSION_CONTINUITY_PROTOCOL.md`
- Master requirements/tasks: `docs/MASTER_PRODUCTION_TODO.md`
- Append-only history: `docs/SESSION_LOG.md`
- Project state and decisions: `docs/PROJECT_CONTINUITY.md`
- Baseline: `docs/PRODUCTION_BASELINE.md`
- Evidence audit: `docs/PRODUCTION_AUDIT.md`
- Schema/migration gate: `docs/SCHEMA_RECONCILIATION.md`
- Machine-readable release gate: `docs/release/production-migration-reconciliation.json`

This protocol remains active across new, deleted, or inaccessible chat sessions because the repository records—not the session transcript—carry the project state.
