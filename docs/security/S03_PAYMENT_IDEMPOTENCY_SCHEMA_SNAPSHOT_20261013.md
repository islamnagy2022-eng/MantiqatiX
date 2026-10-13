# S03 Payment Idempotency Schema Snapshot — 2026-10-13

Scope: read-only PostgreSQL catalog inspection of unique indexes on payment-related tables in Supabase project `moyhiluyhjsujhwlyeuu`. No rows were selected, and no writes or deployed function invocations occurred.

## Verified unique constraints

- `public.payment_provider_events`: unique `(provider, external_event_id)`.
- `public.payment_intents`: unique `(tenant_id, idempotency_key)`; unique partial `(provider, provider_order_id)` when provider_order_id is not null.
- `public.subscription_payment_intents`: unique `(idempotency_key)`; unique partial `(provider, provider_intent_id)` and `(provider, provider_order_id)` when non-null.
- `public.digital_page_orders`: unique `(user_id, idempotency_key)`; unique partial provider/intent and provider/order identifiers.
- `public.mantigo_financial_ledger`: unique `idempotency_key`, `ride_id`, and partial provider/intent identifier.
- `public.push_subscriptions`: unique `endpoint`.

## Interpretation

These constraints provide useful duplicate-key defenses, particularly for payment-provider event identity and provider intent/order identity. They do not alone prove end-to-end idempotency: handler branches may perform check-then-write sequences, and a unique conflict may need explicit handling. Verify that all callback branches use atomic database operations or handle unique-violation retries deterministically, and test concurrent duplicate callbacks in an isolated environment.

The MantiGO payment-intent handler's external-provider call occurs before its conditional ledger update. A unique provider/intent constraint reduces duplicate persistence, but does not prevent an extra provider intention from being created under concurrent requests. Confirm the affected-row count and reconciliation behavior before returning a new client secret.

## Gate

This is catalog evidence only. No concurrency tests were executed, no provider calls were made, and no production data or configuration was changed. Release remains **NOT CERTIFIED** pending isolated callback replay/concurrency tests and deployed-source parity.
