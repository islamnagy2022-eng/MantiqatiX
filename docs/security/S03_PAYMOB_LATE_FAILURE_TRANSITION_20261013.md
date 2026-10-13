# Deployed Paymob Callback Status-Transition Finding — 2026-10-13

## Evidence

Live Supabase function `paymob-webhook` was retrieved read-only as ACTIVE v8, `verify_jwt=false`, SHA-256:

`f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`

In its generic `payment_intents` failure branch, the live source records a failed provider event and then updates the intent status to `FAILED` filtered by intent ID, without an additional `status = 'PENDING'` condition. A late distinct failure event can therefore attempt to downgrade an already-final payment intent. This is a source-level defect candidate with financial-integrity impact; no callback was invoked to reproduce it.

## Staged mitigation found

The open draft PR #220 branch `test/s06-payment-integrity-20261013` adds a `status = 'PENDING'` predicate to the generic intent failure update. This source change is not live production evidence and must not be described as deployed.

The staged branch still inserts the failure event before the conditional update and does not verify the affected-row count. Thus a late failure after a successful payment may leave a FAILED provider-event record while the payment intent remains PAID, with the handler returning a FAILED-shaped response. The existing S06 SQL regression tests cover a late failure on the digital-page RPC path, not this generic webhook branch.

## Required follow-up

1. Add an isolated generic-payment-intent late-failure regression after PAID.
2. Assert the final intent remains PAID and event/response semantics are consistent.
3. Prefer one atomic RPC for event idempotency, event ownership/status consistency, and guarded payment-state transition.
4. Deploy only through the approved, reconciled release path; re-fetch the live function and verify the deployed artifact after rollout.

## Safety

No production mutation, payment callback, provider call, or deployment was performed. This finding is not marked resolved. Release remains **BLOCKED — NOT CERTIFIED** until the source change is tested, reviewed, and released with runtime evidence.
