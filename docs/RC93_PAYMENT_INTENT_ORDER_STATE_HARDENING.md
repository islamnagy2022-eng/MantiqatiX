# RC93 — Payment Intent Order-State Hardening

Date: 2026-09-28

## Scope
Harden the server-authoritative payment-intent creation path against charging an order after it has left the payable lifecycle.

## Production change
Migration:
- `20260928064230_rc91_harden_payment_intent_order_state`

The SECURITY DEFINER function `public.create_payment_intent_backend(...)` now locks the order and requires its status to be `PENDING` or `CREATED` before creating a payment intent. Other states return `ORDER_NOT_PAYABLE`.

This is enforced at the database authority boundary, not only in the Edge Function.

## Verification
- Production migration applied successfully.
- Function definition was re-read and confirmed to contain the `ORDER_NOT_PAYABLE` guard.
- Function execution remains available only to `authenticated` and `service_role`; `anon` has no EXECUTE.
- No production order, payment intent, balance, settlement, or transaction rows were inserted/updated/deleted by the verification work.

## Source/runtime convergence
The repository payment-intent source was intentionally left aligned with the currently deployed Edge Function. A stricter Edge Function mirror was prepared but not deployed, so it was not retained in GitHub to avoid claiming runtime convergence without a verified deployment.

## pg_net audit
Production currently contains `pg_net` in the `net` schema. Supabase documents that the `net` schema is not exposed through the Data API and that client roles cannot establish direct database connections; the project push hook is a SECURITY DEFINER function owned by `postgres`.

The project already contains several historical pg_net privilege-hardening migrations. A fresh ACL check showed the extension-owned `net.http_post` function still reports PUBLIC EXECUTE, so this specific extension ACL remains **not closed/verified** and should not be marked as remediated. No extension relocation or destructive pg_net change was performed.

## Release status
This closes one payment lifecycle authorization gap at the database boundary. Complete production certification remains blocked by the previously documented external gates: fresh two-user/two-tenant authorization E2E, storage E2E, signed Paymob E2E, Android signing/device validation, backup/restore rehearsal, observability drill, full Edge Function source convergence, migration/source convergence, rollback rehearsal, and real browser/device push delivery.
