# MantiqaTiX — Canonical Schema Baseline Recovery

**Status: IMPLEMENTED AS A CONTROLLED RECOVERY PATH; BASELINE CAPTURE AND REPLAY NOT YET COMPLETE.**

## Why this is the durable fix

The repository has historical migration-source gaps and an RC424 source filename whose timestamp differs from the version recorded in the live migration ledger. Reconstructing old migration files from memory, current catalog state, or approximate SQL would falsely claim historical provenance and can change security semantics.

Instead, the project now has a separate, test-only **production schema snapshot baseline** path:

1. Read the live migration ledger and PostgreSQL major version.
2. Use the official Supabase CLI schema-only dump to capture current schema definitions. The default dump excludes row data and custom roles.
3. Generate a provenance manifest that pins the snapshot SHA-256, full ordered migration-version-list hash/count, latest applied version, source project ref, capture time, and PostgreSQL major version.
4. Reject known secret/token patterns and COPY data payloads before opening a **Draft** review PR.
5. Require human review of object definitions, grants, RLS policies, triggers, and SECURITY DEFINER functions before changing the manifest to APPROVED_FOR_DISPOSABLE_REPLAY.
6. Restore the reviewed snapshot only into a fresh local Supabase stack and apply only migrations newer than the pinned checkpoint. The replay script refuses non-local database URLs and keeps the RC424 source/ledger alias skip conditional on the already-verified exact statement match.
7. Record exact-run replay evidence. The production gate may accept this strategy as an alternative to replaying the unrecoverable pre-checkpoint history, but it still requires all production rollout, tenant-isolation, payment/finance, backup/restore, Edge Function, SMM, and Auth gates to pass.

This avoids depending on the missing pre-checkpoint DDL in future clean forward-replay tests without pretending that the old historical creation statements have been recovered.

## Safety boundaries

- Snapshot files belong under supabase/tests/baselines/, never supabase/migrations/.
- The snapshot is **not** a deployable migration and must never be applied to production.
- The capture workflow performs only read-only ledger/version queries and a schema-only dump. It does not run db pull, db push, migration repair, apply_migration, or any production DDL/DML.
- The snapshot is generated with review_status: PENDING_REVIEW. It is not accepted as replay evidence until reviewed and explicitly approved.
- A snapshot from the current live schema does not prove historical provenance or prove that the live schema has no drift. It is a reproducible test bootstrap at the recorded checkpoint.
- The existing RC424 identity reconciliation remains immutable. The source filename version 20261009010000 must not be treated as a new pending migration when the exact source statement is already recorded under live ledger version 20261008222845.
- No production schema/data, grants/RLS/Auth, Edge Functions, secrets, payments, or settlement records were changed as part of implementing this path.

## How the first capture is performed

A one-time capture can be triggered by an explicitly marked commit on the recovery branch; the workflow still uses only a protected secret, performs read-only database operations, and fails closed if the secret or validation is missing. A manual workflow dispatch with the confirmation checkbox is also supported.

1. Configure a protected GitHub Actions repository secret named SUPABASE_DB_URL for the project database connection. Prefer a read-only database role where the Supabase permissions permit schema dumping. Never put the connection string in repository files or workflow inputs.
2. In GitHub Actions, run **Capture Read-Only Production Schema Baseline** on the recovery branch and explicitly check confirm_schema_only_capture=true.
3. The workflow checks the live migration ledger, captures the schema, scans the dump, writes the provenance manifest, and opens a Draft PR containing only the schema snapshot and manifest.
4. Review that PR for security-sensitive function bodies, RLS, grants, and secret leakage. Keep the baseline pending if any object cannot be safely reviewed.
5. Once reviewed, change review_status to APPROVED_FOR_DISPOSABLE_REPLAY and run **Reviewed Production Baseline Forward Replay**. The run must pass against an isolated local Supabase stack with the same PostgreSQL major version.
6. Only after the replay artifact and all other release evidence are reviewed may the reconciliation record be updated. Do not change required_release_migrations_applied to true until read-only live-ledger evidence proves it.

## Acceptance criteria

- Snapshot hash equals the manifest hash.
- Manifest ledger checkpoint, migration count, and ordered-version-list hash match the captured ledger export.
- Schema-only validation finds no data payload or known secret/token pattern.
- Snapshot has an explicit review status before it is used.
- Local replay applies every source migration newer than the checkpoint, except only a specifically reconciled already-applied source/ledger alias; duplicate forward versions or any SQL error fail the run.
- Replay report and Actions run URL are recorded against the exact source commit.
- The release remains **BLOCKED / NOT CERTIFIED** until independent live production and acceptance gates are proven.

## Current state

- The first automated capture attempt (Actions run [38629754240](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38629754240)) failed safely at the preflight because repository secret SUPABASE_DB_URL is not configured. No database connection was made, no schema was dumped, and no production change occurred.
- To complete the baseline capture, configure that protected Actions secret in GitHub repository Settings → Secrets and variables → Actions, then run **Capture Read-Only Production Schema Baseline** with confirm_schema_only_capture=true. Do not send the connection string in chat. The workflow will still create only a Draft PR after the dump passes the safety checks.

The capture/replay automation and fail-closed production-gate fallback have been added to PR #248. The live snapshot has **not** yet been captured or reviewed, and the baseline-forward replay has **not** passed. Therefore the historical replay blocker is not yet considered resolved and no release is certified.


## 2026-10-15 connection-result correction

The previous statement that SUPABASE_DB_URL was absent is superseded by the latest Actions evidence. Run [38629754240](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38629754240) confirms the secret was present and non-empty. The failure occurred when connecting to `aws-0-us-east-2.pooler.supabase.com:5432`, with `FATAL: (ENOTIDENTIFIER) no tenant identifier provided`; the dump and manifest steps were skipped. This points to a pooler URI/username tenant-format problem, but the masked secret has not been inspected, and the exact root cause is not yet proven.

Do not paste the connection URI or password into chat. The direct-connection template shared during troubleshooting still contains `[YOUR-PASSWORD]` and is not a valid credential. Do not rerun the capture until the correct connection mode and username are confirmed. The limited reader role also needs its migration-ledger access and effective read-only grants resolved before automation use. No production write or migration was performed; release remains **BLOCKED / NOT CERTIFIED**.
