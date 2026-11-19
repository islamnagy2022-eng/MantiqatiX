# Pass 884–891 — Paymob webhook live/source reconciliation

**Date:** 2026-11-19  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Environment:** Supabase Production Edge Function read + GitHub main source; no runtime mutation  
**Production mutations:** NONE

## Exact deployed/source comparison

Fresh retrieval of Production `paymob-webhook` reports:
- Status: ACTIVE
- Deployed version: 10
- `verify_jwt=false` (expected for provider callbacks because the function performs Paymob HMAC authentication itself)
- Deployed `index.ts`: 11,538 characters
- Current main `supabase/functions/paymob-webhook/index.ts`: 12,376 characters
- Exact source match: **false**
- Deployed bundle SHA256: `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`

## Confirmed payment-processing drift

Both deployed and source versions contain the Paymob HMAC-SHA512 verification path and reject invalid/missing provider signatures. However, the deployed v10 implementation differs materially in the MantiGO payment branch:

| Control | Deployed v10 | Current main |
|---|---|---|
| Paymob HMAC verification | Present | Present |
| Verify provider order ID against stored MantiGO intent metadata | Not present | Present |
| Call atomic `process_verified_mantigo_payment_backend` RPC | Not present | Present |
| Directly insert payment-provider event and update MantiGO ledger | Present | Replaced by atomic RPC |

The deployed MantiGO path therefore lacks the source's explicit provider-order binding and bypasses the canonical atomic payment RPC. The source also routes digital-page and subscription processing through the current atomic RPC contracts, while the live v10 file has older branches. This is a confirmed live/source mismatch on a financial webhook, not proof that an invalid provider signature can be forged: the HMAC check remains present. The missing order binding and atomicity are nevertheless material payment-integrity risks.

## Release decision

- Do not deploy this Edge Function by itself: the current source calls database RPCs and schema contracts whose migration chain is not reconciled/applied in Production.
- Do not treat the live version's HMAC check as sufficient proof of payment integrity.
- Keep the production release blocked until the ordered payment/database migrations, exact RPC ACL/body checks, webhook replay tests, rollback plan, and sandbox payment E2E all pass together.
- No Production Edge Function, database, payment, wallet, settlement, or customer data was changed during this review.

## Next

Reconcile the exact migration prerequisites and live definitions for `process_verified_mantigo_payment_backend`, `process_verified_digital_page_payment_backend`, and the Paymob provider-event constraints; then run the full webhook signature, provider-order mismatch, duplicate-event, amount/currency mismatch, and idempotent replay suite in a disposable environment before any coordinated deployment.
