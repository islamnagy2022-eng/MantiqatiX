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

## Static security review of recovered SQL (2026-10-11)

This is a source-level review only; it is not a substitute for full ordered replay against the current production schema.

- **Search path:** every SECURITY DEFINER function found in RC425–RC441 explicitly sets an empty `search_path`.
- **Payment intent ownership:** RC426's authenticated finalization RPC requires `auth.uid() = p_user_id` and binds the order to that user and the claim token. Its old four-argument overload is revoked; the new five-argument overload requires provider intent and order correlation values.
- **ERP receiving:** RC434's atomic receiving RPC is service-role-only. RC437 adds order-line quantity/cost/product constraints and revokes the direct service-role bypass of the line-aware wrapper. RC438's authenticated status-transition RPC checks active membership against the order's tenant and business and restricts approval transitions by role.
- **Platform admin:** RC441's authenticated RPCs require the platform-admin predicate; the read/report RPCs also compare the supplied admin ID to `auth.uid()`, and mutation RPCs bind the actor to the authenticated user.
- **SMM wallet idempotency:** RC432 checks for duplicate reference/type rows and raises an exception before replacing the partial unique index. The index is recreated with the same intended `(reference_id,type)` key and a DEBIT/REFUND/CREDIT predicate. Any pre-existing duplicates deliberately block migration and require manual reconciliation; do not bypass that check.
- **Explicit grant review:** authenticated EXECUTE grants in RC426, RC438, and RC441 were reviewed at source level and have the corresponding identity/membership/platform-admin checks above. They still require the isolated role/authorization integration tests to remain green.
- **Destructive-operation scan:** no top-level `TRUNCATE` or unconditional `DELETE` was found. RC437's deletion of existing purchase-order lines occurs inside the draft-only line replacement routine; the routine must continue to enforce DRAFT state and transaction atomicity. RC432 drops/recreates its unique index only after its duplicate guard.
- **CI evidence:** the ERP receiving/line integration jobs passed on the stacked candidate head `5944cefc6ebd67b14aaabdc847455c31d92845dd` in run [38099532060](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38099532060). That run validates its disposable fixtures and targeted migrations, not the full historical migration chain or production.
- **Still BLOCKED:** RC424's live-ledger version `20261008222845` does not equal the source filename version `20261009010000`; RC433 has no recovered source in this set; full chronological replay, production application state for RC425–RC456, payment provider E2E, tenant-negative tests across the full app, backup/restore rehearsal, and live Auth/SMM configuration remain unverified.
