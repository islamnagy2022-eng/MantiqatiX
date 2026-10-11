# ERP Atomic Purchase Receiving — Review Notes

## Scope
This stacked change adds authenticated `erp-purchase-order-create` and `erp-purchase-receive` Edge Functions. Both validate the bearer token with Supabase Auth and delegate mutations to server-side SECURITY DEFINER RPCs using the service role only after passing the verified actor ID. The UI now creates purchase orders with bounded multi-line input and routes receiving through the atomic line-aware function. The base migration-recovery PR supplies RC434/RC437/RC438; this PR adds isolated PostgreSQL integration tests and CI contract checks.

## Invariants tested
- Receipt, stock balance, and inventory ledger changes are performed atomically by PostgreSQL.
- Repeated receipt IDs are idempotent only when the payload is consistent.
- Cross-tenant or invalid actor scope is rejected by the server-side function.
- Purchase-order creation accepts 1–200 validated lines; the current prompt-driven UI caps entry at 20 lines per order.
- Receipt quantity cannot exceed the approved purchase-order line's remaining quantity.
- Product identity and unit cost must match the approved purchase-order line.
- The Edge Function does not directly write stock, receipt, or inventory ledger tables.

## Release constraints
- These migration files were recovered from an unmerged/stale change set and must be reviewed against the complete current schema.
- RC433 is absent from the known chain; RC425–RC441 reconciliation remains a separate blocker.
- Do not apply these migrations or deploy the function to production independently. The complete migration chain must be reviewed and replayed in chronological order on disposable PostgreSQL first.
- The UI remains prompt-driven rather than a full line-item modal/editor. Browser-to-Edge-to-database E2E with an authenticated tenant and seeded approved purchase order remains NOT VERIFIED.
- Passing isolated fixture tests is not proof of full production compatibility.
