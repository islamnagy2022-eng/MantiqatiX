# MantiqatiX — Permanent Cross-Session TODO & Request Intake Protocol

**Status: MANDATORY — applies to every project session, chat, continuation, and handoff.**

Master request ledger: https://github.com/islamnagy2022-eng/MantiqatiX/issues/599

Canonical records:
- Detailed execution register: [docs/MASTER_PRODUCTION_TODO.md](./MASTER_PRODUCTION_TODO.md)
- Current handoff: [docs/PROJECT_CONTINUITY.md](./PROJECT_CONTINUITY.md)
- Append-only history: [docs/SESSION_LOG.md](./SESSION_LOG.md)
- Master request ledger: GitHub issue #599.

## Rule for every new request

1. Before implementation, register every new MantiqatiX request in issue #599 and the relevant section of the Master TODO. Assign a request identifier, workstream, priority, status, dependencies, acceptance criteria, and next action.
2. Break compound requests into individually verifiable subtasks. Link related requests instead of duplicating the same task.
3. When implementation begins, set status to IN PROGRESS. Record each meaningful code/data/config/documentation change with branch, commit, PR, and test evidence.
4. On session end, unfinished work remains IN PROGRESS, WAIT, BLOCKED, or NOT VERIFIED. Never discard it or reset it to TODO without explaining why.
5. After PR merge, deployment, and production verification, update the same record. DONE means implementation complete; VERIFIED requires the appropriate tests on the relevant target environment.
6. Fixture-based tests do not prove real live data behavior. CI, source presence, or successful deployment alone do not prove the entire platform is production-ready.
7. Every session begins by reading issue #599, this protocol, PROJECT_CONTINUITY.md, and MASTER_PRODUCTION_TODO.md; then check current main, open PRs/issues, exact-head CI, deployment, live evidence and the first dependency-ordered actionable task.
8. Do not repeat completed work. Do not merge/deploy or mutate production outside the authorized release gates. Do not remove existing UI/functions/data unless explicitly requested.
9. Keep the global production gate BLOCKED / NOT CERTIFIED until every independent release gate has current evidence.

## Mandatory session closeout

Record:
- What request(s) were worked on.
- Status of each principal task and subtask.
- Exact branch / commit / PR / issue.
- Tests and exact CI run results.
- Production impact and whether deployment actually occurred.
- Remaining work, dependencies, risks and next ordered action.

## Cross-session limitation

This protocol is persisted in the repository and GitHub issue. A future session with access to this project/repository must read it before continuing. If a future chat has no project/repository access, it cannot update GitHub automatically; it must reconnect to the project/repository before claiming that a request was registered.
