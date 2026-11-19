# Pass 884–891 — Digital-page Paymob provider-order correlation release gate

**Date:** 2026-11-19  
**Environment:** Supabase Production read-only; GitHub source/test-only branch  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Production mutations:** NONE  
**Disposition:** **P0 PRE-LAUNCH BLOCKER — DO NOT ENABLE DIGITAL-PAGE PAYMENTS**

## 1. Executive result

The live digital-page Paymob flow does not yet bind the Paymob order ID authenticated by the callback HMAC to the internal digital-page order before changing payment state.

The Paymob webhook's HMAC field builder includes `order.id` but does not include `order.merchant_order_id`. The latter is used by the webhook as the first database lookup key. In the live bundle, the webhook checks amount and currency after that lookup, but does not compare the selected row's stored `provider_order_id` with the signed Paymob `order.id`. The live SECURITY DEFINER processor also does not perform that comparison; it writes the supplied provider order ID onto the order as part of the state transition.

This is a confirmed missing correlation boundary in the deployed source and database definition. It creates a potential cross-order, equal-amount/equal-currency callback misapplication path if an authenticated Paymob event is first processed with an altered, unsigned merchant reference. It is not evidence that this path has been used or that any customer was affected.

The live digital-page order table and digital-page payment-event table are both empty: **0 orders, 0 Paymob orders, 0 pending Paymob orders, 0 provider events**. No payment event or customer row was selected.

## 2. Live Production evidence

### Edge Function: `digital-page-payment-intent`

- Status: ACTIVE, version **5**.
- `verify_jwt=true`.
- Deployed bundle SHA-256: `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b`.
- The live function verifies the bearer user and invokes the atomic payment claim.
- After creating a Paymob intention, it calls the **legacy four-argument** `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` with order ID, user ID, claim token, and provider intent ID only.
- It does not persist the provider order ID returned by Paymob, does not run the current exact-cent/intention correlation helper, and does not fail closed on a missing provider order ID.

### Edge Function: `paymob-webhook`

- Status: ACTIVE, version **10**.
- `verify_jwt=false`, as expected for a provider callback.
- Deployed bundle SHA-256: `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`.
- The HMAC builder includes `order.id`; it does not include `order.merchant_order_id`.
- The digital-page route uses `merchant_order_id` to look up an order (with a provider-order fallback), then checks amount/currency and calls the payment processor with the signed `order.id`.
- The live route does not verify that the selected order's stored `provider_order_id` is non-null and equal to the callback's `order.id` before calling the processor.

### Live database processor

Live signature:

`public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)`

Direct `pg_proc` inspection confirmed:

- `SECURITY DEFINER`, owner `postgres`.
- `search_path=public, pg_temp`.
- Effective EXECUTE: `service_role=true`, `anon=false`, `authenticated=false`.
- Exact live `prosrc` fingerprint: MD5 `a5e65a21d159846e2814c82bb89925ce`, **2,997 characters**. This is the legacy RC424 body fingerprint expected by RC470's fail-closed preflight.
- Checks the callback signature flag, event ID presence, state, amount/currency, order existence, and prior event/order reuse.
- Does **not** check `v_order.provider_order_id = p_provider_order_id`.
- Does **not** bind `p_external_event_id` to `paymob:` plus the supplied provider transaction ID.
- Does **not** take the hardened per-event advisory lock or reject conflicting replay status.
- It assigns `provider_order_id = coalesce(nullif(p_provider_order_id, ''), provider_order_id)` as part of the payment-state update, which is too late to authenticate the selected order.

### Live finalizer and ACL

Only the legacy finalizer exists:

`finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`

- `SECURITY DEFINER`, `search_path=public, pg_temp`.
- `authenticated` EXECUTE=true; `anon` and `service_role` EXECUTE=false.
- Binds `auth.uid()` to the supplied user, order owner and claim token, but stores only `provider_intent_id`; it cannot store/bind the Paymob provider order ID.
- The required five-argument signature `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)` is absent.

### Current data population

Fresh aggregate-only query:

| Object / state | Rows |
|---|---:|
| `digital_page_orders` | 0 |
| Paymob digital-page orders | 0 |
| Pending Paymob digital-page orders | 0 |
| `digital_page_payment_events` | 0 |

No transaction, callback, test payment, or customer data was created or changed.

## 3. Source repair already present on main

The current source already contains the necessary fixes; the problem is Production parity, not a missing implementation.

### Payment-intent Edge Function

`supabase/functions/digital-page-payment-intent/index.ts` now:

- Uses `isValidPaymobAmountCents` before provider network I/O.
- Uses `matchesPaymobIntention` to verify provider amount, currency, reference, provider intent ID, provider order ID and client secret.
- Rejects mismatches with `PAYMENT_PROVIDER_INTENT_MISMATCH`.
- Persists both provider identifiers through the five-argument finalizer by passing `p_provider_order_id`.

### Webhook Edge Function

`supabase/functions/paymob-webhook/index.ts` now:

- Keeps the HMAC-authenticated Paymob `order.id` as the trusted provider order identifier.
- Uses `merchant_order_id` only to locate a candidate internal order.
- Requires `digital.provider_order_id` to be non-null and exactly equal to the signed `paymobOrderId`.
- Returns `DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH` before calling the database processor when that comparison fails.

The HMAC canonical field list itself still does not include `merchant_order_id`; this is safe only because the database-row binding to signed `order.id` is mandatory. Do not remove or weaken that comparison.

### Database migrations and tests

- **RC426** — `supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql`: adds the five-argument finalizer and persists both provider intent and provider order IDs; retires the legacy four-argument finalizer.
- **RC431** — `supabase/migrations/20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql`: hardens the processor with provider-order equality, event/transaction binding, replay-state checks and empty search_path.
- **RC468** — `supabase/migrations/20261115030000_rc468_digital_page_payment_claim_hardening.sql`: hardens claim/finalizer boundaries and revokes legacy finalizer access.
- **RC470** — `supabase/migrations/20261117020000_rc470_digital_page_webhook_forward_repair.sql`: forward-only restoration for the exact legacy RC424 live body. It checks the body fingerprint and signature, applies the provider-order comparison, event/transaction binding, advisory lock, replay-state guards, empty search_path and service-role-only execution. It fails closed if the function body or dependencies differ unexpectedly.

Existing disposable PostgreSQL coverage:

- `supabase/tests/rc431_digital_page_payment_integration.sql` rejects a mismatched provider order and asserts the order state and event table remain unchanged.
- The same integration covers invalid signature, event/transaction mismatch, invalid status, amount/currency mismatch, successful payment, same-status replay idempotency, conflicting replay rejection, event reuse across orders and atomic rollback.
- `supabase/tests/rc470_digital_page_webhook_forward_repair.sql` checks the empty search_path, service-role-only ACL and required hardened function-body markers.
- `.github/workflows/rc470-digital-page-webhook-forward-repair.yml` builds a disposable PostgreSQL instance, applies the exact legacy RC424 fixture, applies RC470, then runs the RC470 postcondition and RC431 behavioral integration.

## 4. Regression validator improvement in this pass

Updated `scripts/validate-digital-pages-boundaries.mjs` on the current work branch. The Pages validation workflow already invokes this validator.

New static assertions require:

1. The HMAC verifier continues to include `order.id` and does not treat `merchant_order_id` as a signed field.
2. The digital-page webhook compares the stored provider order ID to the signed Paymob order ID **after candidate lookup and before** the payment processor RPC.
3. RC470 retains the database-level provider-order mismatch guard.
4. RC431 integration continues to prove that a mismatch is rejected without changing order state or persisting a payment event.

This prevents a future webhook refactor from accidentally removing the correlation boundary while leaving the SQL processor as the only fallback.

## 5. Migration and release reconciliation

A fresh read-only version query found none of these exact required migration identifiers in `supabase_migrations.schema_migrations`:

- `20261009130000` — RC426
- `20261009180000` — RC431
- `20261115030000` — RC468
- `20261117020000` — RC470

The full manifest remains at **310 live migration rows through `20261110150618`; 0/62 exact required release identifiers are recorded**. This is a migration-identity mismatch and does not prove that all physical effects of every release file are absent. Continue exact object/body/ACL reconciliation; never fabricate migration ledger rows or replay historical SQL blindly.

The current source/test changes do not authorize an independent Edge or SQL deployment. Encrypted off-site backup, isolated restore proof and measured RPO/RTO are still missing. Production remains **BLOCKED / NOT CERTIFIED**.

## 6. Required coordinated release order

1. Obtain and verify the encrypted off-site backup, isolated restore, rollback and RPO/RTO evidence.
2. Reconcile the exact RC426/RC431/RC468/RC470 dependencies and all 62 release identifiers against physical Production objects and ACLs.
3. Apply the reviewed forward-only database chain in dependency order, including the five-argument finalizer and hardened payment processor.
4. Deploy matching `digital-page-payment-intent` and `paymob-webhook` Edge bundles in the same controlled release window.
5. Run sandbox positive and negative callbacks: correct order, altered merchant reference, wrong provider order ID, wrong amount/currency, missing order ID, duplicate event, conflicting replay state, failure callback, and concurrent first delivery.
6. Verify that every rejected event leaves the digital-page order and payment-event ledger unchanged; verify one valid callback produces exactly one payment event and the expected payment/fulfillment state.
7. Keep production digital-page checkout disabled until those post-deploy tests pass. No live payment should be used as a test.

## Change boundary

- This pass changes only a static GitHub source validator and documentation on branch `audit/digital-page-paymob-correlation-release-gate-20261119`.
- No Production SQL, DDL, DML, GRANT, RLS, Auth, Edge Function, payment, wallet, settlement, customer data or deployment change occurred.
