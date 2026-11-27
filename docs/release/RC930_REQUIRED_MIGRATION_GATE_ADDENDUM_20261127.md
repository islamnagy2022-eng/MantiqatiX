# RC930 — Required Migration Gate Addendum

**Date:** 2026-11-27  
**Baseline before this addendum:** `main @ d351bb12f4cad904113686b00a6222746c6ef83e`  
**Previous crosswalk:** `REQUIRED_87_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261126.md` (historical snapshot; intentionally unchanged)  
**Updated required migration count:** **88**  
**Disposition:** **RC930 source present; Production NOT APPLIED; coordinated release BLOCKED / NOT CERTIFIED**.

## 1. Source and behavior

The forward-only source migration is:

`supabase/migrations/20261127010000_rc930_serialize_job_deactivation_and_application.sql`

It replaces the existing `public.submit_job_application_backend(uuid,uuid,text,text,text,text)` function. The new implementation obtains a `FOR SHARE` row lock on the target job before reading its active state and deciding whether to insert a new job application. This serializes application creation against concurrent employer deactivation. It preserves authenticated-user binding, `JOB_NOT_FOUND`, `JOB_NOT_ACTIVE`, and the idempotent `ALREADY_APPLIED` response.

The migration and dedicated PostgreSQL 17 test sources are already in `main` through merged PR #1159. The test workflow is `.github/workflows/rc919-job-application-integration.yml`; it applies RC919 and RC930 to a disposable PostgreSQL 17 database, runs active/inactive/missing/duplicate behavior assertions, and runs a two-session concurrency regression.

## 2. Release-contract correction

The previous 87-migration contract ended at RC929 and did not include the already-merged RC930 source file. That made the release checklist incomplete: a migration could exist and have tests while not being required by the canonical source verifier and static release-chain validator.

This addendum updates the canonical required version list, the production source verifier, and the static migration-chain validator to include:

| Version | Source migration | Required effect |
|---|---|---|
| `20261127010000` | `20261127010000_rc930_serialize_job_deactivation_and_application.sql` | Row-lock serialization of job application submission against job deactivation |

The static gate now expects **88** distinct, timestamp-ordered required migrations and compares their timestamps with the canonical production contract. The dedicated RC919/RC930 workflow now also runs when the release-contract, production verifier, or migration-chain validator changes, ensuring the behavior/concurrency tests are tied to changes in the release gate itself.

The prior 87-migration crosswalk remains unchanged as a historical checkpoint. This document records the additional source requirement without rewriting that earlier evidence.

## 3. Read-only Production evidence

Connected Production project: `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`, status `ACTIVE_HEALTHY`, PostgreSQL 17.

A direct read-only check on 2026-11-27 returned:

- Live migration ledger: **310 rows**.
- Latest recorded migration: `20261110150618`.
- RC930 version `20261127010000`: **not recorded**.
- The live `submit_job_application_backend(uuid,uuid,text,text,text,text)` definition is the earlier implementation: it only checks that the job exists and does not lock/read the job's active state with `FOR SHARE`.
- The live function is SECURITY DEFINER, owned by `postgres`, configured with `search_path=public, pg_temp`; `anon` EXECUTE is false and `authenticated` EXECUTE is true.

No application/customer rows were queried. No production migration, SQL write, permission, Auth/RLS, Storage, Edge deployment, payment, wallet, settlement, or business/customer-data mutation was performed.

## 4. Release decision and next sequence

RC930 must be treated as a required source migration in the coordinated chronological release. Do not apply it by itself or insert a synthetic migration-ledger row. Before any production rollout, the project still needs the full source-to-live alias/effect reconciliation, authorization and RLS fixes, payment/RPC/Edge bundle parity and negative replay tests, and independently verified backup/restore/rollback evidence.

**Current decision:** RC930 = **NOT APPLIED**; overall Production release = **BLOCKED / NOT CERTIFIED**. The presence of the migration in source and passing disposable tests is not evidence that Production has received it.
