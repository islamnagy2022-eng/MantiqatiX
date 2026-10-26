# Candidate branch reconciliation — 2026-10-26

## Current PR divergence

Read-only GitHub compare results against `main`:

| PR | Branch | Ahead of merge base | Main commits after merge base | Merge status |
|---|---|---:|---:|---|
| #86 | `fix/restaurant-module-hardening-20261009` | 72 | 173 | Open, draft, non-mergeable |
| #282 | `fix/mantigo-financial-report-columns-20261017` | 73 | 110 | Open, draft, non-mergeable |
| #374 | `feat/digital-page-self-service-20261025` | Candidate web/catalog work | Current head is mergeable against its base | Open, draft |

Compare results:
- PR #86 merge base: `f1f653d2112124dda85cc717d47127e03e1af541`
- PR #282 merge base: `e020cc08cef06f7f56a34d775ec8c6c7db9d442e`

The older PRs are substantially behind `main`; this is not safe to treat as a small metadata-only conflict. Their migrations and application code must be reconciled against the current canonical tree. Do not force-push, rewrite migration history, or merge them solely because a disposable candidate replay passes.

## What has passed

- PR #374 candidate combined forward replay passed in disposable Supabase: [run 40240992894](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40240992894), using pinned PR #86 and PR #282 heads plus PR #374 code-equivalent head `e8de019129b5d2521710e8ce93c7e4f32de92aa3`.
- Independent forward-chain replay passed: [run 40240992922](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40240992922).
- On the subsequent docs-updated PR #374 head, exact-head migration uniqueness, migration-history immutability, collision guard, web validation, and security/module boundary checks were started again. The latest run set is tracked by GitHub Actions; do not mark queued or in-progress runs as passes.
- The latest candidate commit updates release documentation only; it does not change application or migration source.

## Safe reconciliation procedure

1. Freeze the exact candidate heads and inventory every changed migration by filename timestamp, RC label, and content hash.
2. Compare candidate files against current `main` and all open PRs; identify duplicate timestamps, RC434 provenance, dependencies, and function-definition order.
3. Resolve application-code conflicts separately from migration-source conflicts. Historical applied migration sources are immutable; use a forward-only correction migration when behavior must change.
4. Rebuild the combined candidate from current canonical `main` plus reviewed changes, then run the collision guard and full disposable replay from the captured RC424 production-schema checkpoint.
5. Run focused authorization, tenant isolation, payment/finance, and browser lifecycle tests on the exact resulting head.
6. Only after all release gates pass, obtain explicit rollout approval and stage migration/deployment/rollback. Until then, production remains untouched.

## Decision

**BLOCKED / NOT CERTIFIED.** The successful disposable replay is useful compatibility evidence but does not resolve branch conflicts, historical migration provenance, or runtime release gates.
