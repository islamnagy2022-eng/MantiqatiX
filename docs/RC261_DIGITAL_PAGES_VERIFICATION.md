# RC261 — Digital Pages / Payment / Notification Boundary Verification — 2026-10-02

- Production `digital-page-order-create` is ACTIVE v1 with JWT verification.
- Production `digital-page-payment-intent` is ACTIVE v2 with JWT verification.
- Digital page orders derive price from the active server-side product record and use per-user idempotency.
- MENU orders require an active authorized business membership.
- Payment intent requires ownership of the digital-page order and rejects already-paid/duplicate provider intents.
- Paymob webhook validates digital-page amount/currency and records provider events in the dedicated payment-event ledger.
- Successful digital-page payment creates a user notification through the backend path.
- Public digital-page reads remain restricted to PUBLISHED pages and active sections; authenticated management is owner/business scoped by RLS.

## Release boundary
- Browser create → publish → public render E2E: NOT VERIFIED.
- Real Paymob digital-page checkout: NOT VERIFIED.
- Notification delivery/click-through E2E: NOT VERIFIED.
- Media/storage portfolio workflow: NOT VERIFIED.
- No fake page, order, payment, or notification fixture was created.

## CI control
`scripts/validate-digital-pages-boundaries.mjs` is now required by the Pages validation job.

## Status
Source/security boundaries: VERIFIED.
Runtime browser/payment/notification E2E: NOT VERIFIED.
Final Production Gate: OPEN.
