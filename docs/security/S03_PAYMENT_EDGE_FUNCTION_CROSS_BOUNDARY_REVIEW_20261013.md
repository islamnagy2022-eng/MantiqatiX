# Live Payment Edge-Function Cross-Boundary Review — 2026-10-13

This note records static, read-only observations from deployed Edge Function source. No functions were invoked and no payments or database rows were changed. These observations are not runtime reproductions.

## 1. `mantigo-payment-intent` — ACTIVE v3

Deployed SHA-256: `e011da9e9ec073084fc1dc68da0502936405869a50268dfe9f4fef3606d7ac23`; platform `verify_jwt=false`, with manual bearer-token validation and rejection of anonymous users.

### Positive controls observed
- Requires a bearer token, resolves it with Supabase Auth, rejects anonymous identities.
- Reads the financial ledger by `ride_id` and `customer_id = user.id`.
- Requires a payable ledger state and a positive finite amount.
- Restricts browser origin to the configured GitHub Pages origin.

### Follow-up gaps
- Parses the request using `req.json()` without an explicit body-size bound.
- Calls Paymob's intention endpoint without an explicit abort timeout.
- Makes the external Paymob intention request before persisting the provider intent to the ledger. The subsequent update filters by ledger ID and `payment_status = 'REQUIRED'`, but does not request/verify the affected row count. Under concurrent requests, one call may create a provider intent while another wins the conditional database transition; a zero-row update may not surface as an error, allowing the losing call to return a client secret that was not persisted to the ledger.
- Persistence failure after successful provider-intent creation can leave an orphan provider intent requiring reconciliation.

Required isolated tests: concurrent duplicate initiation, zero-row conditional update, provider timeout, provider success followed by DB failure, and repeat initiation when status is already PENDING. Preferred remediation is an atomic claim/idempotency RPC before provider creation, a bounded provider timeout, and explicit handling of zero-row/ambiguous persistence outcomes. Avoid automatic retries that create duplicate provider intents.

## 2. `mnty-push-dispatch` — ACTIVE v2

Deployed SHA-256: `3a3cb93a869e11bce2ab12eca2171434e6809cc63babcdf4ff8a5864d2c4aaa9`; platform `verify_jwt=false`.

The function requires an exact `x-mnty-push-secret` match against a secret retrieved server-side before dispatching notifications. This is an authentication control, not proof of unrestricted public access.

Follow-up gaps:
- Parses the request with `req.json()` without a body-size limit.
- Iterates all enabled subscriptions for the supplied user with no explicit per-request recipient/subscription cap or execution deadline.
- Returns the supplied `user_id` and per-subscription identifiers/counts in the response; review whether those identifiers are required by the caller contract.
- Ensure the secret RPC and secret rotation/abuse controls are documented and rate-limited at an appropriate boundary.

Test malformed/oversized JSON, missing/wrong secret, large subscription sets, provider failures, and secret rotation in an isolated environment. Do not invoke the live endpoint to test these cases.

## 3. `payment-webhook` — ACTIVE v1

Deployed SHA-256: `1a415557f2fccaec6704fcc01a4b71dbaedc95b5f9c611fef23781c4b18d8642`; platform `verify_jwt=false`.

The function validates an HMAC-SHA256 over `timestamp + "." + body`, enforces a five-minute timestamp window, and requires `signatureVerified === true` before calling the financial RPC. This is a signed internal-sender contract; the trust boundary depends on custody of `MANTIQATIX_WEBHOOK_SECRET` and on the sender verifying the original provider signature before signing the internal envelope.

Follow-up gaps:
- Reads the full body with `req.text()` without an explicit size bound before JSON parsing.
- A five-minute timestamp window is not by itself replay prevention. The financial RPC must be verified to enforce event idempotency, entity binding, compatible replay status, and atomic event/state/ledger behavior.
- Require a sender-side test proving that the `signatureVerified` flag cannot be set merely by trusting unverified provider input.

Test oversized signed body, timestamp boundaries, duplicate event delivery, cross-intent event replay, conflicting status replay, and sender-side signature verification in a disposable environment.

## 4. `paymob-webhook` — ACTIVE v8

The separate detailed finding in `S03_PAYMOB_LATE_FAILURE_TRANSITION_20261013.md` remains open. In addition, the Mantigo branch inserts a provider event before conditionally updating a ledger row whose payment status is `PENDING`, but does not verify affected-row count; the subscription failure branch conditionally updates the subscription status but does not persist a corresponding provider event in that branch. These paths require event/state atomicity and idempotency review. Do not assume the generic payment-intent issue is the only affected path.

## Release decision

All items above are source-review findings to validate, not confirmed runtime exploits. Keep release **BLOCKED — NOT CERTIFIED** until isolated concurrency, timeout, replay, payload-boundary, and persistence-fault tests pass; the live source is reconciled with the reviewed branch; and an approved deployment is verified by re-fetching the deployed artifact.


## 5. Paymob event identity and failure-path consistency

The deployed Paymob webhook constructs `eventId` as `paymob:${value(obj.id)}` and then checks `if (!eventId)`. Because the prefix is always non-empty, this check does not reject a missing/empty provider transaction ID; multiple malformed signed events can collapse to the same `paymob:` key. Require a validated non-empty provider transaction ID and provider order/reference before constructing any idempotency key.

Additional path-specific observations:
- **Subscription failure:** status is conditionally changed from `PENDING` to `FAILED`, but this branch returns without inserting the provider event that the earlier replay check reads. A repeated callback can therefore re-enter the branch; its update may affect zero rows without error and still return a failure response.
- **MantiGO failure/success:** the provider event is inserted before the ledger update. The update filters on `payment_status = 'PENDING'`, but the handler does not verify the affected row count. A duplicate/out-of-order event may be recorded while the ledger remains in a different terminal state, yet the handler can return `ok:true`.
- **Generic payment-intent failure:** the live branch inserts a failed event and updates the intent by ID without a pending-state predicate. The open S06 branch adds the predicate but still needs an atomic event/state transition and affected-row outcome handling.

Add disposable regression cases for missing transaction IDs, subscription failure replay, Mantigo already-final state, and event/status consistency. No production callbacks were sent.
