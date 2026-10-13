# S05 Payment Callback Follow-up — MantiGO Binding and Atomicity

Date: 2026-10-13  
Branch: `security/s05-tenant-isolation-review-20261013`  
Related change: [`814b293`](https://github.com/islamnagy2022-eng/MantiqatiX/commit/814b29329d19c3e0d87e4e3a8f9ad13714388e06)

## Status

**BLOCKED — source-level follow-up only; not runtime-tested and not deployed.**

The Paymob webhook source now checks provider-order binding for subscription intents, digital-page orders, and general payment intents. The MantiGO branch remains unresolved and must not be treated as covered by that change.

## Findings in the current branch source

1. `supabase/functions/mantigo-payment-intent/index.ts` persists `provider.id` as `mantigo_financial_ledger.provider_intent_id` and persists `provider.intention_order_id` under `metadata.paymob_intention_order_id`.
2. `supabase/functions/paymob-webhook/index.ts` selects a MantiGO ledger row by `id = order.merchant_order_id`, but does not compare the callback's signed `order.id` to a stored provider order identifier before accepting the event. It also does not select or validate `provider` for this lookup.
3. The MantiGO callback path inserts into `payment_provider_events` and then separately updates `mantigo_financial_ledger`. This is not atomic in the Edge Function: if the event insert succeeds but the ledger update fails, a retry can hit the existing-event early return and skip repairing the ledger. Concurrent deliveries may also race unless a database uniqueness/atomic-processing guarantee prevents it.
4. The update filters by `payment_status = 'PENDING'`, but the code does not verify that a row was actually updated. It can return success after a zero-row update.
5. The stored `paymob_intention_order_id` must not be compared blindly to callback `order.id` until the Paymob API contract confirms those identifiers are semantically identical for this integration. If they are different identifier classes, persist and compare the exact callback order identifier returned by the provider.

## Required remediation before release

- Confirm Paymob's documented callback/order identifier mapping for the exact Intention API integration and deployed version.
- Fail closed unless the MantiGO ledger row is a Paymob payment and the callback's signed provider-order identifier matches the provider order ID stored for that same ledger intent.
- Process provider event idempotency, ledger status transition, and event persistence atomically in a database function/transaction with a uniqueness constraint on provider + external event ID; a duplicate event must return the already-committed result only after confirming the ledger transition is complete.
- Check and handle the affected-row/result state; do not return payment success if no eligible PENDING row transitioned.
- Add isolated tests for missing IDs, mismatched order ID, mismatched amount/currency, wrong provider, duplicate delivery, concurrent duplicate delivery, event insert followed by simulated transition failure, and already-final ledger states.

## Evidence limits

- Source was read from the S05 branch; this is not proof of production Edge Function parity.
- No live payment was initiated and no production data or settings were changed.
- No isolated behavioral test was run for this finding.
- GitHub combined commit status for `814b293` returned an empty status list; that is **not** a passing CI result.
- S05 remains **BLOCKED / NOT CERTIFIED** until the identifier contract, atomic transition, isolated tests, and deployment parity are evidenced.
