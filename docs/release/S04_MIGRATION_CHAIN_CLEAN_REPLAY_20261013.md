# S04 — Migration Chain & Clean Replay Report

**Report date:** 2026-10-13  
**Status:** **BLOCKED / NOT VERIFIED**  
**Scope:** Migration source inventory, version ordering, source identity, and clean replay only.

## Baseline and coordination

- Repository: `islamnagy2022-eng/MantiqatiX`
- Reference PR: [#218](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/218), OPEN / DRAFT / UNMERGED at inspection.
- Source snapshot inspected: PR head `292bce3eaaeb68b83133eae83f8dde4129d57a3f`, branch `docs/rc521-admin-operations-discovery-20261013`, observed 2026-10-13 02:25:45 UTC.
- S04 changes are isolated on branch `s04/migration-chain-clean-replay-20261013`; candidate after runner hardening is `162e6cc578a6cf0469be07a1c6edd490ee51323c`. Run [38336971783](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38336971783) was QUEUED at the latest status read, so it is not counted as a pass; an earlier run on `31438201c10ce4fee9a8a72e2a400a81960b20e8` was still in progress. No edits were made to `.github/workflows/mantigo-platform-admin-scope.yml` or S02 administrative-function tests.
- No merge, release, deployment, or production database write was performed.

## Read-only production ledger

A fresh read-only call to Supabase project `moyhiluyhjsujhwlyeuu` returned 283 migration records. The final recorded version remains `20261008222845`, `rc424_atomic_digital_page_payment_webhook`.

The following candidates are **not established as applied** by their source-file presence. Existing release evidence says RC449, RC462, RC522, and RC523 were not present in the ledger; the remaining post-RC424 candidates also require exact ledger reconciliation. This report does not infer applied state from source files.

## Source inventory

| Source location | SQL files observed |
|---|---:|
| `supabase/migrations/` | 160 |
| `supabase/recovered-migrations/` | 33 |
| Total before same-name deduplication | 193 |

All filenames in these two observed directory listings matched the 14-digit timestamp naming pattern. The 20 explicit migration candidates in the preflight contract were present:

- RC425–RC432
- RC434–RC441
- RC449
- RC462
- RC522
- RC523

**RC433:** no file with an `rc433_` name was found in either directory listing. The available PR scope specifically lists RC425–RC432 and RC434–RC441, so this is recorded as an unresolved identifier question, not silently classified as an applied migration or invented source file. Reconcile against the authoritative migration ledger/source history.

## Ordering and uniqueness findings

Five duplicate-version groups exist in the combined source set:

| Version | Files |
|---|---|
| `20260928020000` | `rc101_g6_rls_permissive_policy_hardening.sql`; `rc102_g8_crm_notification_support_rls_hardening.sql` |
| `20260928060000` | `rc109_harden_order_support_tenant_boundaries.sql`; `restore_registration_request_dml_grants.sql` |
| `20260928190000` | `rc162_mantigo_trip_state_machine.sql`; `rc200_cross_tenant_customer_payment_authorization.sql` |
| `20260928200000` | `rc164_mantigo_direct_delete_lockdown.sql`; `rc164_retire_legacy_mantigo_mutator.sql`; `rc206_geographic_ad_targeting_and_nearest_fallback.sql` |
| `20260928210000` | `rc172_restore_medical_booking_contract.sql`; `rc207_official_global_mnty_cover_ads.sql` |

The existing uniqueness check allowlists these exact legacy collisions for repository validation, but a clean replay needs a deterministic, historically supported resolution. S04's new preflight therefore **fails closed** on every duplicate version instead of treating the existing allowlist as proof that the chain is replayable.

## Clean replay result

- **PostgreSQL full replay:** **NOT RUN** at report authoring time.
- **First blocker:** source preflight, duplicate version `20260928020000`.
- **First SQL migration failure:** none observed; SQL execution was not started because the chain is ambiguous before replay.
- **Migrations applied in this test:** 0.
- **Skipped migrations:** 0.
- **Production effects:** none.

The local execution environment did not expose `psql`, `postgres`, Docker/Podman, or the Supabase CLI. A new isolated CI workflow now provisions disposable PostgreSQL 16, runs source preflight, and—only after preflight passes—executes the combined migration sources in chronological filename order with `ON_ERROR_STOP=1`. It stops on the first SQL error and uploads logs/report artifacts. It does not create fake application tables or auth/storage schema stubs to force a pass.

Because the current preflight has known blockers, the first CI attempt is expected to stop before SQL replay. A full replay cannot be honestly marked PASS until the source conflicts are reconciled and a clean replay actually reaches completion.

## Files changed by S04

1. `scripts/verify-migration-source-chain.mjs` — inventories migration sources, checks expected files and filename shape, compares same-name source copies by SHA-256, and blocks on duplicate versions.
2. `scripts/replay-migration-chain-clean.sh` — runs preflight first; then runs migrations in filename order with stop-on-first-error behavior and records the first failed migration.
3. `.github/workflows/s04-migration-chain-clean-replay.yml` — isolated PostgreSQL 16 workflow and artifact collection; does not modify the shared MantiGO workflow.
4. `docs/release/S04_MIGRATION_CHAIN_CLEAN_REPLAY_20261013.md` — this report.

## Acceptance criteria still open

- Resolve duplicate migration-version groups from authoritative source/history without rewriting applied production history.
- Confirm whether RC433 was ever a defined migration identifier.
- Reconcile all 283 live ledger entries against exact source identities and aliases; the source-file count is not a substitute for a per-version mapping.
- Run the complete replay against a suitable Supabase-compatible disposable baseline without application-schema stubs; record the exact candidate SHA, ordered migration manifest, first failure (if any), and final result.
- Recheck the exact S04 branch workflow result and artifact logs.

**Release consequence:** migration chain replay remains **BLOCKED / NOT CERTIFIED**. No production migration is authorized by this report.
