# Pass 1110–1119 — Live Edge payment/finance parity audit

**Date:** 2026-11-19  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Production changes:** none; all Supabase inspections were read-only.

## Live Edge bundle comparison

| Function | Live version | Live bundle SHA-256 | Current main source bytes | Exact match |
|---|---:|---|---:|---|
| `payment-intent` | 8 | `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54` | 10,146 | No |
| `paymob-webhook` | 10 | `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` | 12,376 | No |
| `subscription-payment-intent` | 4 | `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` | 11,100 | No |
| `digital-page-payment-intent` | 5 | `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b` | 6,532 | No |
| `financial-journal` | 3 | `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366` | 3,387 | No |
| `order-create` | 8 | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` | 13,988 | No |

The deployed `mantigo-payment-intent` v5 bundle was byte-identical to current main and is not part of this six-function drift set.

## Confirmed semantic differences

- **payment-intent v8:** no provider-order ID requirement/persistence and no `matchesPaymobIntention`; current main requires both.
- **paymob-webhook v10:** no atomic provider failure RPC; current main verifies the selected intent against signed provider `order.id` and uses atomic failure processing.
- **subscription-payment-intent v4:** lacks current claim-based provider creation, encrypted checkout recovery and shared Paymob response validation.
- **digital-page-payment-intent v5:** lacks provider-order binding and `matchesPaymobIntention`.
- **financial-journal v3:** uses wildcard CORS and legacy `post_financial_journal`; current main uses allowlisted CORS and `post_financial_journal_backend` with verified actor ID.
- **order-create v8:** byte-different from current main (10,083 vs 13,988 bytes). Both inspected bundles retain bearer verification, tenant/business/branch fields, idempotency and origin checks. This is not enough to classify a security defect; complete a semantic diff before deployment.

## Financial journal live contract

Read-only Production SQL confirmed:
- RC449A-required journal columns `entry_number`, `total_debit`, `total_credit`, `posted_at`, `line_number`, `updated_at`, and `reversed_by_entry_id` are absent from the inspected live schema.
- Both `post_financial_journal(jsonb,jsonb)` and `post_financial_journal_backend(uuid,jsonb,jsonb)` exist as SECURITY DEFINER functions with `search_path=public`.
- Effective EXECUTE is false for anon, authenticated and service_role on both live signatures.
- The legacy function calls `assert_financial_membership(v_tenant)`, which requires an authenticated `auth.uid()`; the deployed financial-journal v3 Edge calls that legacy RPC using a service-role client.
- The live backend function still requires `p_user_id=auth.uid()` and does not include RC450's service-role JWT-role exception and business/branch/organization scope.
- Current main's Edge source is designed for RC450's service-role-only RPC. The reviewed release order is RC449A schema prerequisites → RC450 backend boundary → matching Edge deployment. Do not deploy the Edge Function separately, and do not grant service_role EXECUTE on the legacy RPC.

## Payment data counts

Read-only row counts at inspection time:
- `payment_intents`: 0
- `payment_provider_events`: 0
- `business_subscriptions`: 0
- `digital_page_payment_events`: 0

These counts do not certify the Edge functions or broader order state.

## Release decision

Issue [#857](https://github.com/islamnagy2022-eng/MantiqatiX/issues/857) tracks coordinated payment/order/finance Edge parity. No live Edge deployment, migration, GRANT, payment, journal, wallet, settlement or customer-data write was performed. Full platform remains **BLOCKED / NOT CERTIFIED**.
