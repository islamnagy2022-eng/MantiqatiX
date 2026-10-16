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
