# RC449A — Financial Journal Schema Prerequisites

**Status:** source candidate; not applied to production.  
**Migration:** `supabase/migrations/20261010175000_rc449a_financial_journal_schema_prerequisites.sql`  
**Ordering:** RC449A sorts after RC449 and before RC450. It must be applied before RC450.

## Live read-only finding

The production `journal_entries` table lacks `entry_number`, `total_debit`, `total_credit`, `posted_at`, `updated_at`, and `reversed_by_entry_id`. The production `journal_entry_lines` table lacks `line_number`. Both journal tables and `general_ledger` currently report zero rows in the inspected environment, but counts can change before rollout. Existing posting, settlement, and reversal functions reference these missing columns, so the financial-journal runtime is not certified.

## Migration behavior

- Adds the missing columns as a forward-only schema repair.
- Backfills entry numbers from immutable journal IDs, header totals from actual line sums, posted timestamps from creation timestamps for already-posted/reversed entries, and line numbers in deterministic ID order when the column is newly added.
- Adds safe defaults for future header totals, timestamps, update timestamps, and line numbers.
- Adds a lookup index for cumulative ledger balance reads.
- Fails clearly if the expected legacy baseline schema is absent.

## Required release order

1. Reconfirm the migration ledger and journal schema read-only immediately before rollout.
2. Review and approve RC449A; run the disposable PostgreSQL 16 schema/backfill suite on the exact release commit.
3. Apply RC449A through the approved migration pipeline.
4. Verify the added columns, backfill values, and index read-only.
5. Apply RC450 only after RC449A succeeds; RC450 has a preflight that rejects missing journal schema fields.
6. Deploy the `financial-journal` Edge Function only after the database RPC/grants and journal integration tests pass.
7. Test with an authorized finance actor, cross-tenant actor, same-tenant different-business actor, branch-scoped actor, duplicate journal ID, inactive account, and unbalanced lines in an isolated/staging environment.

## Safety boundary

This runbook authorizes no production write, migration, grant change, Edge Function deployment, journal posting, settlement, or payment. Do not infer production readiness from a clean zero-row count.
