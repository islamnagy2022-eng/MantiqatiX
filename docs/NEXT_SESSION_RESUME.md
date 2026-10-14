# MantiqaTix — Next Session Resume (Read First)

**Last updated:** 2026-10-14 UTC  
**Release decision:** `BLOCKED / NOT CERTIFIED`  
**Repository:** `islamnagy2022-eng/MantiqaTix` (GitHub display may resolve as `MantiqatiX`)  
**Production Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Live site:** https://islamnagy2022-eng.github.io/MantiqaTix/

> This file is the compact handoff, not the entire history. Read it first at every new session. Follow `docs/SESSION_CONTINUITY_PROTOCOL.md`. Do not repeat completed checks unless a documented trigger applies.

## Current active work

- **Active PR:** [#247 — docs: establish evidence-led production baseline](https://github.com/islamnagy2022-eng/MantiqaTix/pull/247)
- **Working branch:** `docs/production-baseline-recovery-2026-10-14`
- **PR base SHA at creation:** `8a56358d505d2c12878440037f7f24ba65d2ea10`
- **PR head before continuity update:** `7eda2e605b90a5c942a72c1fdda9a18715af028d` (will advance as these records are committed; use the live PR head as the final authority).
- **Scope of PR #247:** documentation-only baseline, audit, schema reconciliation, master TODO, continuity, and session history. It is a draft and has not been merged.
- **Production changes in this workstream:** none. No production DDL, migration application, data changes, function deployment, secret changes, financial transaction, or release approval.

## Verified state and evidence already captured

1. GitHub repository default branch is `main`; baseline commit recorded as `8a56358d505d2c12878440037f7f24ba65d2ea10` (`docs: link mandatory project continuity records`).
2. Supabase project reports `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.155`, region `us-east-2`. This is infrastructure health metadata only, not launch readiness.
3. Read-only live migration ledger has 283 records, first version `20260808000000`, latest `20261008222845` / `rc424_atomic_digital_page_payment_webhook`.
4. Existing release manifest documents exact RC424 SQL statement match: one statement, 7208 bytes in both source and live ledger, `exact_statement_match=true`, `history_rewritten=false`. Preserve the applied ledger version; the source filename timestamp difference is documented as a legacy alias.
5. The release verifier enumerates 28 required migration source files. Exact current-main inventory: **12 present, 16 missing**. Missing files: RC425–RC432 and RC434–RC441. Present files: RC446, RC442, RC444, RC447–RC450, RC451–RC453, RC456. See the complete table in `docs/SCHEMA_RECONCILIATION.md`.
6. PR migration-patch comparisons already completed:
   - PR #84 vs #202: no differing shared migration patches.
   - PR #207 vs #218: 33 common migration files, no differing common migration patches.
   - PR #84 vs #207: 16 common migration files, no differing common migration patches.
   These findings apply only to shared migration patches; PRs differ in non-migration files and additional migration sets. Do not repeat these exact comparisons unless inputs change or contradictory evidence appears.
7. Security Advisor snapshot on 2026-10-14: RLS enabled/no policies on `public.digital_page_payment_events`; `public.get_mnty_targeted_advertisements(...)` callable by `anon` as SECURITY DEFINER; 40 authenticated-executable SECURITY DEFINER findings. Review individually; do not add broad policies or blanket revoke grants.
8. Historical continuity files had a stale main HEAD reference `735f0451...`; correction was appended without rewriting history.

## Current domain status

- Domain 1 — baseline and requirements register: **PARTIAL**. Evidence is recorded, but the full weighted requirement matrix and release evidence remain incomplete.
- Domain 2 — schema/migration reconciliation: **BLOCKED**. Required source files are missing from main; candidate PR overlap and full-chain ordering/dependencies/replay are not closed.
- Global release: **BLOCKED / NOT CERTIFIED**.
- Do not present the previously discussed rough percentages as calculated progress; no complete weighted requirements matrix has established them.

## Exact next action (continue here; do not restart)

**Build a canonical 28-row migration reconciliation matrix** from `scripts/production/verify-production.mjs`, the live 283-row ledger, current `main`, and candidate PRs #84/#202/#207/#218. For each required migration, record:
- exact filename/version and current-main presence;
- candidate PR(s) containing it and exact patch/source identity;
- live ledger presence/version/name (not inferred from source);
- duplicate or conflicting version definitions;
- chronological ordering and prerequisite/dependency edges;
- relevant fixtures/tests and their exact status;
- whether disposable chronological replay has passed (currently NOT RUN);
- explicit safe next action.

Before continuing, refresh only the minimal live state that can invalidate this handoff: current main HEAD, active candidate PR heads/states, and live migration ledger latest/count. Do not repeat unchanged patch comparisons already listed above. If these inputs have not changed, reuse their recorded results and proceed with the missing rows/dependency checks.

**Acceptance criteria for closing Domain 2:** all 28 entries reconciled to source and live ledger; missing source explained and recovered from authoritative candidate source; no duplicate/conflicting versions; dependency order documented; full chain successfully replayed in disposable PostgreSQL/Supabase; relevant tests and diffs captured; no production migration applied without explicit approval.

## Files to read in order

1. `docs/NEXT_SESSION_RESUME.md` (this file)
2. `docs/SESSION_CONTINUITY_PROTOCOL.md`
3. `docs/MASTER_PRODUCTION_TODO.md` (latest appended entries and active domain)
4. `docs/SESSION_LOG.md` (latest session entries; append only)
5. `docs/PROJECT_CONTINUITY.md`
6. `docs/PRODUCTION_BASELINE.md`
7. `docs/PRODUCTION_AUDIT.md`
8. `docs/SCHEMA_RECONCILIATION.md`
9. `docs/release/production-migration-reconciliation.json`
10. Relevant release verifier, PR patches, and CI evidence.

## Close-of-session requirement

Before stopping, update the master TODO, append a unique session-log entry, update continuity when needed, then update this resume file **last** with the actual final branch/commit/PR/check status and one exact next action. Verify the files were committed and reread from GitHub. Never rely on chat memory alone.


## Continuation correction — 2026-10-14 (supersedes the earlier matrix-creation next action)
- The canonical matrix has now been created at `docs/release/migration-reconciliation-matrix-20261014.json`; do not recreate it or repeat the completed shared-patch comparisons unless inputs change.
- Latest verified live migration ledger snapshot: 283 rows, latest `20261008222845` / `rc424_atomic_digital_page_payment_webhook`. All 28 required post-RC424 release migrations are absent from that ledger snapshot. Current-main source inventory: 12 present, 16 missing (RC425–RC432 and RC434–RC441).
- Fresh candidate PR states/heads and patch comparisons are captured in the matrix and latest `docs/SESSION_LOG.md`. #202 is closed/unmerged; #84/#207/#218 are open drafts. Matching patches do not authorize merge or production application.
- **Exact next action:** inspect migration prerequisites/dependencies and the one out-of-scope RC458 patch difference across candidates; recover authoritative SQL sources for the 16 missing files into a review-only branch with exact version uniqueness and ordering; validate the full chain in a disposable PostgreSQL/Supabase environment; capture test and schema-diff evidence. Do not run production DDL or merge PRs.
- Acceptance remains unmet until all 28 rows have source/ledger identity reconciled, version/alias uniqueness and dependency order verified, chronological disposable replay passes, and relevant runtime/security/finance tests are evidenced. Release remains `BLOCKED / NOT CERTIFIED`.
