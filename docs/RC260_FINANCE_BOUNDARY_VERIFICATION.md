# RC260 — Finance / Payment Boundary Verification — 2026-10-02

## Verified source/runtime evidence
- Production payment-intent is ACTIVE v5 with JWT verification enabled.
- Production settlement-create is ACTIVE v3 with JWT verification enabled.
- Production paymob-webhook is ACTIVE v5 and intentionally does not require JWT because it authenticates the external provider callback using HMAC.
- Payment intent creation authenticates the user, resolves the order server-side, requires an authoritative pricing snapshot, and calls create_payment_intent_backend using server-derived order amount/currency.
- Settlement creation authenticates the user and delegates to create_settlement_backend.
- Paymob webhook verifies HMAC-SHA512 using constant-time comparison, validates amount/currency, enforces provider-event idempotency, and routes verified events to authoritative processing functions.

## Release boundary
- Real Paymob transaction: NOT VERIFIED.
- Duplicate/replay webhook E2E: NOT VERIFIED.
- Real settlement/GL E2E: NOT VERIFIED.
- Refund E2E: NOT VERIFIED; no approved production refund API contract currently exists.
- No financial transaction or fake fixture was created during RC260.

## CI control
- scripts/validate-finance-boundaries.mjs was added.
- The validation is now part of .github/workflows/pages.yml and blocks release validation if critical payment/settlement/webhook authority markers disappear.

## Status
Source boundary: VERIFIED.
Runtime authorization: PARTIAL / requires independent authenticated E2E identities.
Real-money lifecycle: NOT VERIFIED.
Final Production Gate: OPEN.
