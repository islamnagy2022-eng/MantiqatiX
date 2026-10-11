# RC425–RC441 Migration Source Recovery — Clean Source-Only Branch

## Scope
This branch restores 16 SQL migration source files absent from `main`: RC425–RC432 and RC434–RC441. RC433 is not included and is not assumed to exist.

## Provenance
Each file was copied byte-for-byte from draft PR #84 head `934f2fc28ec61bdfc5023479b0e796e743244eb1` onto a branch created directly from `main`. PR #84 is stale/diverged; its migrations are candidates for review, not trusted or applied production changes.

## Live-state evidence
The live Supabase ledger ends at `20261008222845` / `rc424_atomic_digital_page_payment_webhook`. The RC424 source filename in `main` is timestamped `20261009010000`, so the source/ledger identity discrepancy remains unresolved. Presence of these files does not prove any are applied.

## Required before merge or production application
- Review every SQL file against the current schema and existing data.
- Verify dependency and timestamp order without rewriting applied migration history.
- Replay the complete intended chain on disposable PostgreSQL and review failure/rollback behavior.
- Run tenant-isolation, payment/finance atomicity, SECURITY DEFINER, SMM least-privilege, and Edge Function contract tests.
- Confirm deployed function parity and prepare rollback/recovery evidence.

## Safety
This branch is intentionally source-only: no Edge Function code, web UI, workflow, validator, grants, RLS policy, or live database state is changed. No production migration or deployment was performed.
