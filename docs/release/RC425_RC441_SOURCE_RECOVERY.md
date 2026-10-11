# RC425–RC441 Migration Source Recovery

## Purpose
Recover the 16 migration source files that are referenced by the production release plan but absent from `main`. Files were copied byte-for-byte from the existing draft branch `fix/mantigo-atomic-paymob-webhook` (PR #84 head `934f2fc28ec61bdfc5023479b0e796e743244eb1`) into a branch based on `main` at `36986b45f12591f975637264fce64513a50abdad`.

## Safety and evidence
- This PR only restores source files. It does not apply migrations to Supabase or deploy Edge Functions.
- PR #84 is stale/diverged and is not being merged. Its source files are isolated for review, not implicitly trusted.
- Existing CI on the old branch passed isolated integration jobs, but that does not prove these migrations replay cleanly against the current `main` schema or that they are applied in production.
- Production Supabase ledger currently ends at `20261008222845` / `rc424_atomic_digital_page_payment_webhook`; the RC424 source filename uses `20261009010000`. This discrepancy remains unresolved.
- Required next gates: review each migration against current `main`, validate dependencies and chronological ordering, replay the complete chain on disposable PostgreSQL, inspect rollback behavior, and verify tenant isolation, payment/finance atomicity, and Edge Function compatibility.
- No production writes, grants, RLS changes, payment activity, or deployments were performed.

## Files recovered
- RC425–RC432
- RC434–RC441

RC433 is not part of this recovered set and must not be inferred to exist or be applied.

## Related RC436 runtime-source correction
Read-only live comparison found both deployed financial-journal Edge Functions were calling legacy RPC names that have no EXECUTE grant for `service_role`, while the RC436 candidate migration creates and grants `post_financial_journal_atomic_backend(uuid,jsonb,jsonb)`. This branch now updates both source entrypoints to call that atomic RPC. The change is source-only; the live Edge Functions remain unchanged until RC436 and the full release chain are approved and applied. Exact-head CI is pending.