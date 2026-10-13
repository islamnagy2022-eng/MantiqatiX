# Digital Page Paymob Provider-Order Binding — 2026-10-13

## Finding

The deployed `digital-page-payment-intent` v3 entrypoint matched the PR #218 candidate source, but it called `finalize_digital_page_payment_intent_backend` with four arguments. Candidate migration RC426 revokes the four-argument overload and defines/grants a five-argument overload that requires the provider's signed order ID and persists it to `digital_page_orders.provider_order_id`. The old handler therefore does not satisfy the candidate migration contract and cannot persist the correlation required by the atomic RC431 callback processor.

## Source-only correction

- Extract the provider order ID from the Paymob intention response (`intention_order_id`, `order_id`, or nested `order.id`).
- Fail closed if a provider intent exists but its order correlation is missing. Keep the claim closed to prevent duplicate checkout creation and return an explicit reconciliation-required error.
- Call the five-argument RC426 finalizer with both provider intent and provider order IDs.
- Log only safe correlation IDs and error codes; never log the client secret.
- Extend the digital-page boundary validator and add a focused workflow with Deno type-checking plus disposable PostgreSQL tests for ownership, claim-token binding, required provider-order correlation, and old-overload revocation.

## Verification and limits

The new workflow is pending at PR creation. Do not call the correction verified until its exact-head static/type-check and PostgreSQL jobs pass. No live provider call, production deployment, migration, or production data mutation was performed.

## Release status

This addresses the checkout-to-callback correlation gap only. Full release remains **BLOCKED / NOT CERTIFIED** pending chronological migration replay, live RPC authorization remediation, real provider E2E, encrypted subscription checkout recovery, and all other release gates.
