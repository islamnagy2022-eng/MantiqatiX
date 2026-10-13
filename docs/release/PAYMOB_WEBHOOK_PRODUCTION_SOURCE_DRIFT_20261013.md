# Paymob Webhook Production/Source Drift — 2026-10-13

## Decision

**P0 production release blocker — no production mutation performed.** The active production `paymob-webhook` source is not equivalent to the tracked repository source. The repository contains stricter correlation and failure-path logic than the live v8 function. This report is read-only evidence; it is not deployment authorization.

## Exact evidence

- Supabase project: `moyhiluyhjsujhwlyeuu`
- Production function: `paymob-webhook`, ACTIVE, version 8, `verify_jwt=false` (expected for provider callback only if provider HMAC verification remains mandatory).
- Deployed entrypoint SHA-256: `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`.
- Tracked source path: `supabase/functions/paymob-webhook/index.ts`, content SHA `a8309bfafa2c6a48fd22a36c5c6ae09681e751b1`, 15,041 characters versus 11,538 in the deployed entrypoint. These hashes use different source systems (deployed SHA-256 versus GitHub content SHA) and are not directly comparable; a normalized source comparison is also **not equal**.
- Production source was retrieved read-only through the Supabase function inspection API. No secret values were read or displayed.

## Behavior deltas confirmed by source inspection

| Contract | Tracked source | Deployed v8 source |
|---|---|---|
| Reject non-finite amount values | Present | Missing |
| Require exact subscription provider-order correlation | Present | Missing |
| Require exact digital-page provider-order correlation | Present | Missing |
| Fail closed while provider-order correlation is pending | Present | Missing |
| Route subscription failures through `process_verified_subscription_payment_failure` | Present | Missing |
| Route subscription success through `process_verified_subscription_payment_backend` | Present | Uses older `process_verified_subscription_payment` |
| Direct `payment_provider_events` lookup | Not found as a direct marker in the current tracked handler; deduplication may be delegated to the authoritative RPC | Present in the deployed handler |

The deployed function still performs Paymob HMAC-SHA512 verification and delegates normal/digital-page processing to backend RPCs. This report does not claim the entire webhook is exploitable; it records concrete production/source drift in order binding and failure-state handling.

## Root cause and safe response

This is a release/source-convergence problem: a newer tracked handler is not the handler currently running in production. Applying a migration does not update an Edge Function, and passing repository CI does not prove that the deployed source has the same behavior.

1. Keep the production callback unchanged until the release owner explicitly approves a reviewed Edge Function deployment.
2. Add/retain isolated tests for mismatched subscription and digital-page provider-order IDs, missing/pending provider-order correlation, malformed/non-finite amount, duplicate external event, amount/currency mismatch, and provider failure idempotency.
3. Verify the RPC signatures and grants expected by the tracked handler in disposable integration tests.
4. Before any approved deployment, compare the exact deployment artifact SHA to the reviewed Git commit, confirm required environment variable names are configured without exposing values, and run provider sandbox E2E with replayed/forged/mismatched callbacks.
5. After an approved deployment, re-fetch the live function source and verify the deployed version/SHA and behavior. Do not infer deployment success from CI alone.

## Boundaries

No Edge Function was deployed or modified. No production data, migration ledger, grants, RLS, Auth, wallet, payment, or accounting rows were changed. Production release remains **BLOCKED / NOT CERTIFIED**.
