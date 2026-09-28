# RC69 — Payment Chain Authority Audit

Date: 2026-09-28

## Chain reviewed

`payment-intent` creates the server-side payment intent after authenticating the user, loading the authoritative order, requiring a pricing snapshot, and passing an idempotency key to `create_payment_intent_backend`. It then sends the authoritative amount/currency and pricing snapshot to Paymob and persists the provider intent reference.

Production `paymob-webhook` v4 verifies the Paymob HMAC-SHA512 signature before processing. It correlates the provider event to a subscription payment intent or normal payment intent, checks amount/currency consistency, checks `payment_provider_events` for the external event ID, and invokes the server-side financial processing RPC only after signature verification.

For normal payments, the webhook calls `process_verified_provider_payment` with `p_signature_verified=true`. For subscription payments it calls `process_verified_subscription_payment` after the same provider verification and amount/currency validation.

## Idempotency controls observed

- Client payment-intent creation requires an idempotency key.
- Provider events use `paymob:<provider transaction id>` as the external event identifier.
- Existing provider events are detected before processing and return an idempotent success response.
- Financial processing is delegated to server-side RPCs rather than direct browser writes.

## Failure controls observed

- Missing Paymob configuration fails closed with HTTP 503.
- Missing/invalid authentication fails closed.
- Cancelled orders are rejected.
- Missing pricing authority/snapshot is rejected.
- Amount/currency mismatches are rejected.
- Invalid provider signatures are rejected before financial processing.
- Failed provider responses mark the payment intent FAILED where persistence succeeds.

## Important release limitation

The production `paymob-webhook` implementation is available from the live Supabase function snapshot, but its source is still not represented in the current tracked GitHub function tree. Therefore the runtime security controls can be inspected, but source reproducibility/rollback is not yet closed.

A signed Paymob end-to-end transaction has not been executed in this environment. No real payment was initiated and no financial transaction data was fabricated.

## Status

Payment authority design: REVIEWED.
Provider signature/idempotency controls: REVIEWED from source.
Real provider E2E: BLOCKED/EXTERNAL TEST.
Production source convergence: OPEN.
