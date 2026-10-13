# Paymob Webhook RPC Dependency Gate — 2026-10-13

## Status

**P0 — BLOCKED / NOT CERTIFIED.** Do not deploy the newer tracked Paymob webhook until its required database RPCs are present in the target environment and the approved migration set has passed the full disposable replay.

## Read-only production evidence

Project: `moyhiluyhjsujhwlyeuu`.

### Migration ledger

A read-only query against `supabase_migrations.schema_migrations` returned:
- Latest recorded version: `20261008222845` (`rc424_atomic_digital_page_payment_webhook`).
- Applied migration rows: 283.
- Matching RC425/RC441/RC462 records: 0.

### Required payment RPCs

A read-only `pg_catalog.pg_proc` query returned:

| RPC | Production status | EXECUTE |
|---|---|---|
| `process_verified_subscription_payment_failure` | NOT FOUND | NOT VERIFIED |
| `process_verified_subscription_payment_backend` | NOT FOUND | NOT VERIFIED |
| `process_verified_subscription_payment` | FOUND | service_role=true; anon/authenticated=false |
| `process_verified_digital_page_payment_backend` | FOUND | service_role=true; anon/authenticated=false |
| `process_verified_provider_payment` | FOUND | service_role=true; anon/authenticated=false |

The newer tracked `supabase/functions/paymob-webhook/index.ts` contains calls to the two missing RPCs for atomic subscription failure/success handling. The deployed production `paymob-webhook` v8 still calls the older `process_verified_subscription_payment` path and lacks the tracked source's provider-order mismatch and pending-correlation guards.

This is a real deployment dependency mismatch, not just a static-code difference. Deploying the tracked handler before the required database RPCs exist would break those subscription callback paths.

## Required safe sequence

1. Keep production Paymob webhook v8 unchanged until a separately approved release.
2. Reconcile missing/duplicate historical migration sources and obtain a full chronological PASS in a disposable database.
3. Review the exact migrations that create the missing RPCs, their function signatures, search paths, idempotency behavior, and service-role-only grants.
4. Obtain explicit approval for production migration execution; do not apply migrations from this diagnostic session.
5. In an approved release window, apply the reviewed migration set before deploying the tracked webhook artifact.
6. Run provider-sandbox success, failure, duplicate-event, wrong-order, wrong-amount/currency, missing-correlation, and retry tests.
7. Re-fetch the deployed Edge Function source/version and verify the exact artifact SHA after deployment.

## Boundaries

No production writes, migrations, grants, Auth/RLS changes, Edge Function deployment, wallet/payment transactions, or ledger mutations were performed. Production release remains **BLOCKED / NOT CERTIFIED**.
