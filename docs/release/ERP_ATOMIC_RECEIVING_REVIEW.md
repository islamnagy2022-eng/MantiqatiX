# ERP Atomic Purchase Receiving — Review Notes

## Scope
This change adds an authenticated `erp-purchase-receive` Edge Function that validates the bearer token with Supabase Auth and delegates the receipt operation to the server-side line-aware atomic RPC. It also adds RC434/RC437/RC438 migration sources, isolated PostgreSQL integration tests, and CI contract checks.

## Invariants tested
- Receipt, stock balance, and inventory ledger changes are performed atomically by PostgreSQL.
- Repeated receipt IDs are idempotent only when the payload is consistent.
- Cross-tenant or invalid actor scope is rejected by the server-side function.
- Receipt quantity cannot exceed the approved purchase-order line's remaining quantity.
- Product identity and unit cost must match the approved purchase-order line.
- The Edge Function does not directly write stock, receipt, or inventory ledger tables.

## Release constraints
- These migration files were recovered from an unmerged/stale change set and must be reviewed against the complete current schema.
- RC433 is absent from the known chain; RC425–RC441 reconciliation remains a separate blocker.
- Do not apply these migrations or deploy the function to production independently. The complete migration chain must be reviewed and replayed in chronological order on disposable PostgreSQL first.
- The purchase-order line editor and companion create/update Edge Functions are not included in this focused change. ERP UI integration remains unverified.
- Passing isolated fixture tests is not proof of full production compatibility.
