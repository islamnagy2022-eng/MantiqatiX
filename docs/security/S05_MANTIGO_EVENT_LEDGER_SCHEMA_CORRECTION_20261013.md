# S05 — MantiGO event-ledger schema correction
Date: 2026-10-13
Branch: `security/s05-tenant-isolation-review-20261013`

## Why this correction exists
A second migration-list inspection located the authoritative MantiGO event-ledger DDL in:
`supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql`
https://github.com/islamnagy2022-eng/MantiqatiX/blob/security/s05-tenant-isolation-review-20261013/supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql

RC425 defines `public.mantigo_payment_provider_events` with `id text`, `ledger_id text` referencing `mantigo_financial_ledger(id)`, and a unique `(provider, external_event_id)` constraint. It enables RLS and FORCE RLS and revokes direct table access from `public`, `anon`, `authenticated`, and `service_role`.

## Corrective source change
The first S05 draft incorrectly wrote MantiGO events to the shared `public.payment_provider_events` table and assumed that table's `payment_intent_id` could store a text MantiGO ledger ID. That assumption was not supported by the located MantiGO schema and was unsafe to leave in the review branch.

The S05 migration was corrected to:
- Use `public.mantigo_payment_provider_events` and its `ledger_id` relationship.
- Keep event insertion and the locked ledger transition inside one database function/transaction.
- Preserve service-role-only RPC execution and the dedicated event table's denied direct API grants.
- Check the event ID is bound to the Paymob transaction ID and the stored provider order ID matches the locked ledger metadata.

The static contract was corrected to validate the dedicated MantiGO table's required columns, text-like identifiers, named unique constraint, RLS/FORCE RLS, revoked direct API-role grants, and function source boundary.

Latest source links:
- Migration: https://github.com/islamnagy2022-eng/MantiqatiX/blob/security/s05-tenant-isolation-review-20261013/supabase/migrations/20261013040000_s05_atomic_mantigo_paymob_webhook.sql
- Contract: https://github.com/islamnagy2022-eng/MantiqatiX/blob/security/s05-tenant-isolation-review-20261013/supabase/tests/S05_mantigo_atomic_payment_contract.sql

## Verification state
This is a source correction only. Neither the migration nor the static contract has been executed against a disposable database. The branch has not been merged, and no production schema or data was changed. Required next checks: apply the complete migration chain in a disposable Supabase/Postgres environment, execute the contract, test duplicate/concurrent/conflicting callbacks and rollback behavior, and verify the deployed schema/revision independently.

S05 remains **BLOCKED / NOT CERTIFIED** pending isolated runtime evidence, remaining non-atomic subscription/general FAILED callback remediation, tenant-isolation behavior tests, and CI/deployment-parity evidence.
