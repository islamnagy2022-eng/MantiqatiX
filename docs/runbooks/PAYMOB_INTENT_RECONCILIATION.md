# Paymob payment-intent reconciliation runbook

**Status:** operator procedure; source-only. This runbook does not authorize production data changes.

## When to use

Use this procedure when checkout returns one of these errors or an intention request has an ambiguous result:

- `PAYMENT_INTENT_REQUIRES_RESTART`
- `PAYMENT_INTENT_PERSISTENCE_FAILED`
- `PAYMENT_PROVIDER_REJECTED_INTENT` after an unclear provider response
- `DIGITAL_PAGE_PROVIDER_CORRELATION_PENDING`
- a verified callback repeatedly returns a retryable 5xx response

## Safety rules

1. Do not clear a pending claim or reset a ledger/order to `REQUIRED` merely because the browser received an error or timed out.
2. Do not create a second Paymob intention until the provider dashboard/API confirms whether the first request created one.
3. Never mark an order or ride paid manually based only on a browser redirect, screenshot, or client-supplied status. Require a verified provider transaction and reconcile transaction ID, merchant reference, provider order ID, amount, and currency.
4. Do not delete provider-event rows or alter financial-ledger rows to make a retry succeed.
5. Record the operator, UTC timestamp, request/correlation ID, order/ledger ID, provider transaction/intention/order IDs, evidence, and final decision in the approved audit channel. Redact secrets and customer contact data.

## Reconciliation steps

1. **Identify the affected record.** Locate the digital-page order ID or MantiGo ledger ID and capture its current payment status, provider fields, metadata claim marker, amount, and currency using read-only access.
2. **Inspect Paymob.** Search the provider dashboard/API using the merchant reference (`special_reference`), amount, currency, and approximate creation time. Do not search by customer name alone.
3. **If an intention exists:** compare the provider intention ID and provider order ID with the application record. If the callback arrived before persistence, confirm the provider's delivery/retry history and whether a verified callback has been accepted. Escalate any mismatch; do not overwrite the stored correlation.
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
