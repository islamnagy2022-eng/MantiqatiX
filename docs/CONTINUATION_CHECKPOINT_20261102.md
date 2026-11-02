# Continuation checkpoint — 2026-11-02

## Baseline and boundaries
- Current main after the evidence refresh: `f3cc30c509f937fc6958bca43bb61936f9853cdf` (PR #651 merged).
- PR #650 scoped catalog Pages deployment run: [41433049776](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41433049776).
- PR #650 main validation run: [41433049782](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41433049782).
- Uploaded AI Studio archive SHA-256: `e49e202716c38c5564b8a82db9a74b4fe2c93ebbdecb4a347a7a110b799d6df2` (matches the prior request ledger).
- Archive fixtures and persistence are reference-only: do not import `src/data/seedData.ts`, browser `localStorage` state, or in-process `server.ts` notification memory into production.
- Preserve the live production activities and their authoritative data source. The archive is a UX reference, not a backend or database replacement.
- Do not deploy Edge Functions, apply/repair Production migrations, modify Production grants/RLS/Auth, execute payments/refunds/settlements, or perform financial writes in this workstream.

## Release evidence snapshot
- PR #651 is merged as documentation-only commit `f3cc30c509f937fc6958bca43bb61936f9853cdf`.
- Supabase ledger: 309 records through `20261101140105`; exact comparison to 42 required canonical migration IDs: 0/42. Treat this as identity/source reconciliation; do not infer missing physical effects solely from version IDs.
- Security Advisor: 9 RLS-enabled tables without policies; 3 anon-executable and 67 authenticated-executable SECURITY DEFINER functions; leaked-password protection disabled.
- Performance Advisor: 132 unindexed foreign keys, 375 RLS init-plan findings, 75 unused indexes, 28 multiple-permissive-policy findings.
- Six critical Edge mismatches: `order-create` v8, `payment-intent` v8, `paymob-webhook` v10, `digital-page-payment-intent` v5, `subscription-payment-intent` v4, `financial-journal` v3.
- Latest full verifier snapshot: 32/60 selected physical object checks non-PASS; RC449A/RC450 journal prerequisites absent; payment/finance E2E, backup/restore/RPO/RTO, Auth hardening and adversarial tenant isolation remain NOT VERIFIED.
- `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Open PR triage
| PR | Current disposition |
|---|---|
| #652 | This continuation checkpoint and live ACL/Edge evidence note; documentation only. |
| #648 | Closed as superseded. The canonical pharmacy-precedence + eight-column mobile browser regression is already present on main in its later adapted form; the static taxonomy validator is byte-identical to main. No test coverage was removed. |
| #647 | Marketplace Home + separate search conflicts with keeping AI Studio V4 directory as default entry. Optional addition; requires owner choice and a reconciled navigation decision before merge. |
| #646 | Subscriber portal candidate. Do not merge as-is if it removes current merchant/professional/Super Admin navigation. Port additively; keep cross-membership switching disabled until backend parity. |
| #645 | Doctor batch staging change. Doctor expansion is paused by owner instruction; leave untouched until reprioritized. |
| #644 | Monufia doctor inventory documentation; no database import. Doctor work remains paused. |
| #609 | First-paint/perf branch is behind/diverged and non-mergeable. Rebase/port only after diff and exact-head validation; real user performance measures remain unverified. |

## Next execution sequence
1. PR #648 is now closed as superseded by the current-main regression already covered by PR #650's later exact-head checks; no duplicate cherry-pick is needed.
2. Continue screen-by-screen V4 parity against deployed main. Preserve current production activities and do not import archive demo/localStorage/server-memory data.
3. Review existing isolated candidate PRs for RC463 / RC449A / RC450 and their dependencies. A focused PostgreSQL fixture passing is not a Production rollout approval.
4. Resolve current-main support/ERP/medical/sector access-path mismatches through server-side contracts and isolated authorization tests; do not blanket-grant table privileges.
5. Keep six Edge parity gaps bundled with their database/ACL/payment/rollback dependencies; do not deploy functions one at a time.
6. Complete signed Paymob sandbox callback/idempotency and financial ledger reconciliation in an isolated environment.
7. Establish a credential-scrubbed restorable backup and complete restore/rollback/RPO/RTO evidence before any schema release.
8. Keep all unfinished work open in #599 and append results to Session Log/TODO/continuity. DONE is not VERIFIED.

## Database isolation
- Current Supabase branch inventory contains only the default `main` branch; no isolated development branch is available.
- No new branch or project has been created. Cost and restore requirements must be checked and approved before creating an isolated rehearsal environment.
- No Production migration, schema, data, ACL, Auth/RLS, Edge, payment, or finance mutation was performed.

## Website convergence decisions still open
- Review V4 screen-by-screen parity after PR #650 and preserve the V4 directory as the default entry.
- PR #647 is a candidate optional homepage, not an approved replacement.
- Keep member-to-member messages hidden/deferred until durable persistence, recipient/tenant authorization, audit, abuse controls and notification delivery are verified.
- Keep wallet, payments, finance and campaigns read-only/disabled unless existing backend contracts are fully proven.
- Present any website-only capability absent from V4 before removal or material redesign.

## Status
This file is a dated handoff; it does not claim implementation, CI success, merge, deployment or Production verification beyond the events explicitly recorded above. The global release gate remains BLOCKED / NOT CERTIFIED.
