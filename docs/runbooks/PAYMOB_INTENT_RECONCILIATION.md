# Paymob payment-intent reconciliation runbook

**Status:** operator procedure; source-only. This runbook does not authorize production data changes.

## When to use

Use this procedure when checkout returns one of these errors or an intention request has an ambiguous result:

- `PAYMENT_INTENT_REQUIRES_RESTART`
- `PAYMENT_INTENT_PERSISTENCE_FAILED`
- `PAYMENT_PROVIDER_OUTCOME_UNKNOWN`
- `PAYMENT_INTENT_PERSISTENCE_UNKNOWN`
- `PAYMENT_PROVIDER_CORRELATION_PENDING`
- `SUBSCRIPTION_PROVIDER_CORRELATION_PENDING`
- `SUBSCRIPTION_FAILURE_BINDING_MISMATCH`
- `SUBSCRIPTION_PAYMENT_BINDING_MISMATCH`
- `SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH`
- `DIGITAL_PAGE_PROVIDER_CORRELATION_PENDING`
- a verified callback repeatedly returns a retryable 5xx response

## Safety rules

1. Do not clear a pending claim or reset a ledger/order to `REQUIRED` merely because the browser received an error or timed out.
2. Do not create a second Paymob intention until the provider dashboard/API confirms whether the first request created one.
3. Never mark an order or ride paid manually based only on a browser redirect, screenshot, or client-supplied status. Require a verified provider transaction and reconcile transaction ID, merchant reference, provider order ID, amount, and currency.
4. Do not delete provider-event rows or alter financial-ledger rows to make a retry succeed.
5. Record the operator, UTC timestamp, request/correlation ID, order/ledger ID, provider transaction/intention/order IDs, evidence, and final decision in the approved audit channel. Redact secrets and customer contact data.

## Reconciliation steps

1. **Identify the affected record.** Locate the normal `payment_intents` row, subscription payment intent, digital-page order, or MantiGo ledger row. Capture its current payment status, provider fields, metadata claim marker where applicable, amount, and currency using read-only access.
2. **Inspect Paymob.** Search the provider dashboard/API using the merchant reference (`special_reference`), amount, currency, and approximate creation time. Do not search by customer name alone.
3. **If an intention exists:** compare the provider intention ID and provider order ID with the application record. If the callback arrived before persistence, the webhook returns retryable HTTP 503 for recognized normal, subscription, and digital-page correlation gaps; confirm Paymob's delivery/retry history and whether a verified callback has been accepted. Escalate any mismatch; do not overwrite the stored correlation.
4. **If a transaction exists:** validate its final provider status and match transaction ID, merchant reference, provider order ID, amount, and currency. Use the normal signed webhook/replay path where possible. If manual repair is required, obtain separate financial-owner approval and use an audited, reviewed procedure.
5. **If no intention exists:** retain evidence that the provider confirms no intention was created. Only then may an authorized operator approve a claim recovery or new attempt through a reviewed, conditional procedure. Do not improvise an UPDATE in the production console.
6. **Verify completion read-only.** Confirm the provider event is recorded once, the payment status matches the provider's final status, any required notification exists, and no second active intention was created.
7. **Close the incident.** Record the evidence and whether the issue was provider rejection, timeout/ambiguous response, callback-before-persistence, or persistence failure. Feed recurring cases into automated reconciliation and sandbox tests.

## Release gate

Before production rollout, run signed Paymob sandbox tests for:

- callback arriving before provider-order persistence;
- provider timeout after intention creation;
- success, failure, replay, and conflicting replay;
- amount/currency mismatch and cross-order tampering;
- concurrent intention creation and concurrent callbacks;
- recovery after an ambiguous provider response.

Confirm the actual Paymob retry policy in sandbox/provider documentation. Returning HTTP 503 is only a retry signal; it is not proof that Paymob will redeliver the callback.


## Subscription payment event binding (RC429–RC430)

- Both successful and failed subscription callbacks now use backend RPCs that bind the signed provider order ID and transaction ID to the same subscription payment intent.
- If a pre-existing event was created by the legacy success RPC without the subscription-intent binding fields, do not edit the event or retry by bypassing validation. Capture the event ID, transaction ID, subscription intent ID, provider order ID, amount, and currency; compare them against Paymob's authenticated transaction record and escalate for a reviewed compatibility resolution.
- `PAID_PENDING_LEGAL` means provider payment was verified but the legal/owner activation gate did not complete. Do not create another subscription or mark the payment as failed; resolve the owner/legal gate and then use the approved activation workflow.
