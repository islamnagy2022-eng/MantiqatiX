# RC56 — Paymob Webhook Verification Gate

Date: 2026-09-28

## Verified in production

- paymob-webhook is ACTIVE, version 4, with JWT verification disabled because it is a provider callback endpoint.
- Provider callback signature is verified with PAYMOB_HMAC_SECRET using HMAC-SHA512 and constant-time comparison.
- The callback rejects missing/invalid signatures before financial processing.
- Provider events use an external event id and are checked for prior processing, providing replay/idempotency protection.
- Amount and currency are compared with the persisted payment intent or subscription payment intent before processing.
- Verified provider payment processing is delegated to SECURITY DEFINER RPCs that are executable by service_role only; anon/authenticated cannot execute them directly.
- Failed provider events are persisted and the corresponding payment intent is moved to FAILED.
- Successful provider events use the authoritative process_verified_provider_payment path.

## Important release limitation

This review verifies the deployed code path and database authorization boundary. It does NOT constitute a real Paymob provider E2E certification because no approved live/test provider transaction was executed during this checkpoint.

No credentials were fabricated, no fake payment event was inserted, and no production migration or privilege was widened.
