# R7 Paymob Payment Integrity Revalidation — 2026-11-19

**Source:** isolated working copy derived from `bizcatalog-manager (11).zip`  
**Original archive SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Current `server.ts` SHA-256:** `da0ba4af7a722624974ad4fcafa38552d742e8912b80f2164f80cc9ba0faa1d3`  
**Disposition:** PAYMENT PATH CONTAINED — **R7 BLOCKED / NOT DEPLOYABLE**.

## Findings corrected in the working copy

1. Removed the FNV-style pseudo-HMAC generator and the local helper that marked a local intention paid and credited wallets/business subscriptions.
2. Removed fake seeded payment intents previously marked `paid` without a provider transaction.
3. Added server-only `src/server/paymobTransactionHmac.mjs`: Paymob transaction callback's documented 20 fields, exact concatenation order, HMAC-SHA512, hex digest and `timingSafeEqual` comparison. The HMAC is read from the callback query parameter and transaction data from `body.obj`.
4. Disabled fake local intention creation and payment history; disabled direct subscription success, wallet auto-renew mutations and automated billing sweep.
5. Invalid webhook signatures return 403. A valid HMAC still returns 503 and makes no state change because real Intention API/order correlation and atomic Supabase fulfillment are not implemented.
6. Removed card PAN, expiry, CVV, wallet PIN and OTP collection from the checkout UI. The UI explicitly says not to enter payment credentials in the app.

## Verification

- `npm run test:security`: PASS — 5 scripts (browser key boundary, server secret/API gate, Android WebView, Paymob HMAC fixture, payment security contract).
- Paymob HMAC fixture: PASS; tamper, wrong secret, malformed digest and missing fields rejected.
- TypeScript/TSX syntax-only transpilation: 95 files, 0 syntax errors. This is not a type-check.
- Full npm install, TypeScript type-check, Vite build, dependency-backed unit/integration tests, browser E2E, live Paymob transaction and Android build: NOT RUN / UNVERIFIED.

## Still required before enabling payment

- Implement the official backend-only Paymob Intention API and Paymob-hosted checkout. Never collect card data or OTP in MantiqatiX.
- Store the real Paymob intention/order correlation in trusted backend storage.
- Verify callbacks and atomically deduplicate transaction IDs, compare-and-set payment state, and write a uniquely keyed fulfillment/outbox record in Supabase.
- Verify amount, currency, integration ID, live/test mode, order binding and successful captured/paid status before fulfillment.
- Add negative tests and complete real Paymob test-mode transaction plus reconciliation.

Official references: [Paymob HMAC](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac), [Paymob API flow](https://developers.paymob.com/paymob-docs/integration-paths/apis).

**No Production DB/Auth/RLS/GRANT/Edge/payment/wallet/settlement or deployed catalog change was made. R7 remains BLOCKED / NOT DEPLOYABLE.**