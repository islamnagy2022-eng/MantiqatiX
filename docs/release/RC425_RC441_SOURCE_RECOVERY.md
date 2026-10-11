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

 
## Follow-on ERP receiving work — 2026-10-11

- Draft PR [#202](https://github.com/islamnagy2022-eng/MantiqatiX/pull/202) stacks ERP atomic receiving work on this migration recovery branch.
- The candidate `erp-purchase-receive` function uses authenticated identity and a line-aware atomic RPC. RC434 and RC437/RC438 isolated PostgreSQL jobs passed on the initial implementation head; the first static validator failed because its regex did not allow the RPC argument list, and that validator was corrected.
- A later full module workflow run exposed missing historical test fixtures/validators in the stacked branch. The full module-professionalization workflow has been restored (rather than reduced), and missing RC425/RC431/RC432/RC435/RC436/RC439/RC440/RC441 test assets and validators have been recovered from the same reviewed source branch.
- Latest-head CI for `902806f98a23218fdc2490e927856b4992d56973` is queued. Do not claim it passed until the corresponding run and all jobs complete successfully.
- PR #202 remains draft and non-mergeable while its base PR #194 and the production migration reconciliation remain open. No live Supabase writes or deployments occurred.
