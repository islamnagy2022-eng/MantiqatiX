# Baseline Security Triage — Digital Page Payment Intent Finalization

**Date:** 2026-10-16  
**Branch:** `integration/baseline-replay-candidates-20261016`  
**Scope:** Static source review only; no production query or runtime test was performed.  
**Disposition:** **REVIEW REQUIRED — DO NOT APPROVE BASELINE ON THIS FINDING ALONE**

## Evidence inspected

- `supabase/migrations/20261007003432_digital_page_payment_intent_claim_boundary_v1.sql`
- `supabase/functions/digital-page-payment-intent/index.ts`
- Function: `public.finalize_digital_page_payment_intent_backend(uuid, uuid, text, text)`

The Edge Function authenticates the bearer token with `admin.auth.getUser(token)`, creates a random claim token, calls the claim RPC using the user's authenticated client, calls Paymob's intention API, and then calls the finalization RPC using that same user-scoped client.

The SQL finalization function is `SECURITY DEFINER`, checks `auth.uid() = p_user_id`, checks the order belongs to that user and the supplied claim token matches the order metadata, then writes `provider='PAYMOB'` and the caller-supplied `p_provider_intent_id`. The migration revokes EXECUTE from `PUBLIC` and `anon`, but explicitly grants EXECUTE to `authenticated`.

## Finding DPAY-01 — Authenticated caller can invoke payment-intent finalization directly

**Severity:** Medium pending impact validation  
**Confidence:** High for the exposed code path; runtime exploitability and downstream impact are not yet tested.

Because both the claim and finalization RPCs are callable by `authenticated`, a signed-in order owner can potentially bypass the Edge Function's Paymob API call: call the claim RPC with a chosen token, then call the finalization RPC directly with that token and a caller-chosen provider-intent ID. The finalization function verifies ownership and token possession, but it does not independently prove that the supplied provider-intent ID was returned by Paymob. The token is caller-chosen when calling the claim RPC directly, so it is not by itself proof that the Edge Function performed the provider request.

The current source does **not** establish that this enables a fraudulent PAID state; the function only writes PENDING, and the webhook may independently validate provider state. Plausible impact is order-level payment-intent poisoning / denial of checkout for the order owner, and a trust-boundary inconsistency that must be closed or explicitly accepted. Do not describe this as confirmed payment fraud.

## Recommended remediation for review (not applied)

1. Make finalization callable only by `service_role` / a trusted server-side path, and have the Edge Function call it through the service-role client after a successful Paymob response; alternatively use a server-verifiable, unforgeable proof binding the provider response to the order.
2. Keep user ownership checks and idempotency checks even after moving the privileged call server-side.
3. Verify that the webhook fetches/verifies the payment with Paymob, binds amount/currency/order and provider-intent IDs, and never trusts a client-provided provider ID as proof of payment.
4. Add regression tests proving an authenticated direct RPC call cannot finalize an intent with an arbitrary provider ID, while the trusted Edge Function path succeeds only after a successful provider response.
5. Test duplicate requests, concurrent claims, stale claims, provider timeout, and webhook replay in disposable PostgreSQL/local Supabase.

## Required evidence before closure

- Confirm effective production EXECUTE grants for this exact function and the deployed Edge Function version.
- Review the deployed webhook and provider verification contract.
- Reproduce the direct-call case only in an isolated disposable environment.
- Record the chosen fix, migration/source test results, and post-deploy read-only verification after separately approved rollout.

## Safety / release state

No code, migration, grant, RLS, Auth setting, secret, production schema, payment, or deployment was changed as part of this triage. This artifact is a review finding, not approval to alter the production security boundary. Baseline manifest remains `PENDING_REVIEW`; release remains **BLOCKED / NOT CERTIFIED**.


## Finding MGO-PAY-01 — MantiGO webhook event insert and ledger update are not atomic

**Severity:** High for payment-state integrity pending runtime validation  
**Confidence:** High for the source-level ordering; production deployment parity and exact failure impact are not verified.

In `supabase/functions/paymob-webhook/index.ts`, the MantiGO path checks whether `payment_provider_events` already contains the event ID, inserts a new event row, and only then updates `mantigo_financial_ledger`. These operations are separate Supabase API calls, not one database transaction/RPC. If event insertion succeeds but the ledger update fails, the handler returns `MANTIGO_PAYMENT_UPDATE_FAILED`; a retry then encounters the already-inserted event and returns `idempotent:true` before retrying the ledger update. The ledger may therefore remain `PENDING` despite a recorded provider event. The update also filters on `payment_status='PENDING'` but the source does not inspect affected-row count, so a zero-row transition is not distinguished from a successful state change.

This is a source-level consistency risk, not proof that production has suffered a bad payment state.

### Recommended remediation (not applied)

1. Move event deduplication, provider-event persistence, amount/currency/order binding, and ledger transition into a single SECURITY DEFINER RPC or other database transaction with a unique event key and explicit result states.
2. Make duplicate-event handling reconcile the authoritative ledger state rather than blindly returning idempotent success when the event row exists.
3. Treat a zero-row ledger transition as a distinct outcome; verify whether the state is already final and consistent with the same provider event.
4. Add disposable database tests for event insert success + ledger update failure, duplicate retries, concurrent same-event delivery, duplicate different events for the same ride, and pre-finalized ledger state.
5. Keep notification delivery outside the financial transaction, but persist a retryable notification/outbox status if delivery reliability is required.

### Closure evidence required

- Confirm the source deployed to the target project matches the reviewed handler.
- Reproduce the failure/retry case in disposable Supabase/PostgreSQL.
- Verify the atomic remediation and concurrency/idempotency tests.
- After a separately approved rollout, perform read-only verification and a controlled provider sandbox E2E; no real-money test is implied by this finding.

