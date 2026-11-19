# Pass 900–907 — Standard payment and subscription Production/source drift

**Date:** 2026-11-19  
**Environment:** Supabase Production read-only; GitHub source/test-only branch  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Production mutations:** NONE  
**Disposition:** **P0 PRE-LAUNCH PAYMENT RELEASE BLOCKER**

## 1. Executive result

A read-only comparison of the three live Paymob entrypoints against current `main` confirms that standard order payments and business subscriptions are still running older deployed Edge Function versions and older database contracts.

The central issues are:

1. Standard payment intention creation does not validate the Paymob intention response as a whole and persists only the provider intent ID, not the provider order ID.
2. The standard Paymob webhook can select a payment intent by `merchant_order_id` (which is not included in the verified HMAC field string) and does not compare the selected row's stored `provider_order_id` with the HMAC-authenticated `order.id` before processing.
3. Production lacks RC427's partial unique index that limits an order to one active/final payment intent, so separate idempotency keys can create multiple active intents for the same order if requests race or are retried independently.
4. The live standard failure callback writes the event row and changes intent state in separate requests rather than the current atomic failure RPC.
5. The subscription Edge flow lacks RC435's claim-based provider creation and RC439's encrypted checkout-secret recovery. Its webhook still uses the older subscription success processor and a direct status update for failures; the deployed database lacks the newer provider-order-bound success/failure RPC signatures and claim/encryption columns.

These are potential correctness, replay and cross-intent misbinding paths before enabling payments. They are not evidence of an exploit or an existing customer loss. Live payment-intent, event and subscription tables currently contain **zero rows**.

## 2. Standard payment intent — live v8 versus current main

### Live Production

- Edge Function: `payment-intent`, ACTIVE v8, `verify_jwt=true`.
- Deployed bundle SHA-256: `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54`.
- The function authenticates the bearer user and invokes `create_payment_intent_backend` in caller context. It reads the authoritative order/pricing snapshot and uses `special_reference=paymentIntentId`.
- It computes rounded cents but does not run the current exact-cent guard before provider I/O.
- It accepts a response with provider intent ID and client secret; it does not require or validate provider order ID, and does not call the shared exact Paymob response correlation helper.
- It updates `payment_intents.provider_intent_id` and status only. It does not persist `provider_order_id`, even though the live table has that column.
- It can consequently produce a pending intent without the provider-order binding needed by the current webhook contract.

### Current main source

`supabase/functions/payment-intent/index.ts` now:

- Rejects unsupported amount precision before contacting Paymob.
- Requires provider intent ID, client secret and provider order ID.
- Uses `matchesPaymobIntention` to compare amount, currency, merchant reference and provider response identifiers.
- Fails closed on an ambiguous or mismatched provider response.
- Persists both `provider_intent_id` and `provider_order_id` only while the intent still has the expected state and pricing snapshot.

The missing behavior is already implemented in source; Production has not received the matching Edge bundle.

## 3. Standard payment webhook — HMAC reference boundary

The live webhook HMAC verifier's canonical field builder includes `order.id` but does not include `order.merchant_order_id`. Therefore `merchant_order_id` is a lookup hint, not a provider-authenticated order binding.

### Live standard-payment branch

- Edge Function: `paymob-webhook`, ACTIVE v10, `verify_jwt=false`.
- Deployed bundle SHA-256: `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`.
- It looks up `payment_intents` by the merchant reference first, with a fallback lookup by provider order ID.
- When the merchant-reference lookup succeeds, the live branch checks amount and currency but does not require the selected intent's stored `provider_order_id` to equal the signed Paymob `order.id`.
- The live processor signature `process_verified_provider_payment(...)` has no provider-order-ID argument, so the database processor cannot independently check that binding either.
- The current live function body fingerprint is MD5 `c0bc9993c83e98830801b44834faf51b`, 7,962 characters, `SECURITY DEFINER`, `search_path=public`, and service-role-only EXECUTE.
- The failure path inserts a `payment_provider_events` row and then updates the intent status in separate operations; it does not call the current atomic `process_verified_provider_payment_failure` RPC.

This permits a potential cross-intent misbinding if a signature-valid callback's unsigned merchant reference is altered to identify another pending intent with matching amount/currency. The HMAC itself is not being forged; the missing check is the binding between the selected database row and signed provider `order.id`. No live intent or event exists at the time of this check.

### Current main source

`supabase/functions/paymob-webhook/index.ts` now:

- Looks up a candidate intent by merchant reference or provider order.
- Requires the candidate's stored `provider_order_id` to equal the HMAC-authenticated Paymob `order.id` before either success or failure RPC.
- Uses `process_verified_provider_payment_failure` for failure callbacks and the atomic success processor for successful callbacks.
- Does not directly insert standard payment events or directly update the standard payment intent status in the webhook branch.

## 4. Duplicate-active payment-intent boundary — RC427 absent

The live `payment_intents` table currently has these relevant unique indexes:

- `uk_tenant_idempotency` — uniqueness by tenant and idempotency key.
- `uq_payment_intents_provider_order` — uniqueness by provider and non-null provider order ID.

It does **not** have:

`uq_payment_intents_one_active_per_order`

The latter is required to prevent more than one `CREATED`, `PENDING`, or `SUCCEEDED` payment intent for one order. Different idempotency keys do not collide on `uk_tenant_idempotency`, and unique provider order IDs do not prevent two intents from being created before the provider order IDs exist.

RC427 source migration `20261009140000_rc427_one_active_payment_intent_per_order.sql`:

- Fails closed when pre-existing duplicate active intents are detected.
- Creates the partial unique index on `payment_intents(order_id)` for `CREATED/PENDING/SUCCEEDED`.
- Is covered by `supabase/tests/rc426_427_payment_intent_integration.sql`, which asserts duplicate-created, duplicate-pending and duplicate-succeeded attempts are rejected while allowing a new active intent after a terminal FAILED intent.

Current Production has zero payment intents, so no duplicate state exists to repair. The uniqueness control is still required before live payment traffic.

## 5. Subscription intent creation and checkout recovery

### Live Production

- Edge Function: `subscription-payment-intent`, ACTIVE v4, `verify_jwt=true`.
- Deployed bundle SHA-256: `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5`.
- It calls the legacy `create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` RPC and then contacts Paymob.
- It does not use `create_subscription_payment_intent_claimable_backend` or `claim_subscription_provider_intent_creation_backend`.
- It checks the provider response shape, but does not use the shared strict amount/currency/reference/provider-ID correlation helper.
- It writes provider intent/order IDs directly and returns the checkout client secret, but does not persist an encrypted recoverable secret in the database.

The legacy creation RPC exists in Production, is SECURITY DEFINER with empty `search_path`, and is executable by `service_role` only. It checks an active OWNER/BUSINESS_OWNER membership for the supplied actor and an idempotency key. However, it does not provide the atomic provider-creation claim state used by current main, so concurrent requests that return the same created intent are not protected from making duplicate provider requests by the current claim workflow.

### Current main source

`supabase/functions/subscription-payment-intent/index.ts` now:

- Uses a service-role-only claimable intent RPC followed by an atomic provider-creation claim.
- Validates the exact amount/currency/reference/provider identifiers returned by Paymob.
- Persists provider intent and provider order IDs only after strict correlation.
- Encrypts the checkout client secret with versioned server-side keys using authenticated encryption.
- Stores ciphertext, IV and key version for server-side recovery without persisting plaintext checkout secrets.
- Moves ambiguous provider/encryption outcomes into a reconciliation-required state rather than blindly retrying provider creation.

### Missing Production schema and RPC contracts

The live `subscription_payment_intents` table is missing these current-main columns:

- `provider_creation_state`
- `provider_creation_claimed_at`
- `client_secret_ciphertext`
- `client_secret_iv`
- `client_secret_key_version`

The following source-required RPC signatures are absent:

- `create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)`
- `claim_subscription_provider_intent_creation_backend(uuid,uuid)`
- `process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)`
- `process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)`

The old `process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean)` exists, but it has no provider-order parameter. Its current body also inserts `payment_provider_events.payment_intent_id = NULL` for a subscription success and returns idempotent success when an event ID already exists without proving that the existing event is bound to the same subscription intent. That is weaker than the current RC430 contract, which binds provider order, transaction, event and subscription outcome.

The live subscription webhook's failure branch updates `subscription_payment_intents` directly and does not call the atomic failure RPC. Its success branch calls the old processor signature. The current-main webhook includes an explicit provider-order match before either subscription success or failure processing.

The live subscription table does have useful unique indexes for idempotency key, provider intent ID and provider order ID. Those are retained; they do not replace the provider-creation claim or encrypted checkout-recovery fields.

## 6. Existing event safeguards and live data

A live schema query confirmed:

- `payment_provider_events` has a unique constraint on `(provider, external_event_id)`, which helps prevent duplicate storage of one provider event.
- `subscription_payment_intents` has unique indexes for idempotency key, provider intent ID and provider order ID.
- `payment_intents` lacks the RC427 single-active-intent-per-order partial unique index.

Fresh aggregate-only live counts:

| Table | Rows |
|---|---:|
| `payment_intents` | 0 |
| `payment_provider_events` | 0 |
| `subscription_payment_intents` | 0 |

No row-level payment records, customer identities, provider secrets or checkout tokens were selected. No payment, refund, settlement, event replay or write test was run against Production.

## 7. Source migrations and isolated tests

Relevant current-main source migrations:

- RC427 `20261009140000` — one active payment intent per order.
- RC428 `20261009150000` — atomic standard provider-failure callback.
- RC429 `20261009160000` — atomic subscription-failure callback.
- RC430 `20261009170000` — atomic subscription-success callback.
- RC435 `20261009210000` — claimable subscription intent creation and provider-creation claim state.
- RC439 `20261010010000` — encrypted checkout-secret recovery columns and constraints.
- RC475 `20261118040000` — forward repair of the payment success/failure processor contracts after the historical RC428–RC430 source timestamps.

The disposable integration source `supabase/tests/rc428_430_paymob_webhook_integration.sql` covers signature rejection, provider-order mismatch, amount/tenant mismatch, exactly one event, idempotent replay, cross-intent replay rejection, late failure not downgrading success, and injected failures proving event/status atomic rollback for standard and subscription failure processors. It also checks subscription activation idempotency and prevents activation when legal clearance/owner conditions are not met.

The existing workflow `.github/workflows/rc428-430-paymob-webhook-atomicity.yml` runs the payment migration wiring validator and disposable PostgreSQL fixture/integration, then exercises a true two-session RC475 concurrent replay test.

## 8. Regression protection added in this pass

Updated `scripts/validate-payment-migration-wiring.mjs`, which is already called by the RC428–RC430/RC475 and RC425 workflows.

New assertions require:

1. Standard order webhook candidate lookup to be followed by an exact stored-provider-order versus HMAC-covered `order.id` comparison **before** both success and failure RPCs.
2. Subscription webhook candidate lookup to be followed by the same provider-order comparison **before** both success and failure RPCs.
3. Standard payment event inserts and payment-intent status updates to remain inside atomic database processors.
4. Subscription-intent status changes to remain inside atomic database processors.
5. RC427's fail-closed duplicate preflight and partial unique index for `CREATED/PENDING/SUCCEEDED`.
6. RC426/RC427 integration to keep duplicate active and duplicate succeeded intent cases rejected.
7. RC428/RC429/RC430 source processors to keep provider-order, provider-event/transaction binding and empty search_path contracts.

The updated validator is source-only at this checkpoint. Exact-head GitHub Actions are pending.

## 9. Release gate

A fresh read-only Production version query found 310 migration rows through `20261110150618`. The exact required IDs for RC427, RC428, RC429, RC430, RC435 and RC439 are all absent. The wider release manifest still records **0/62** exact required identifiers.

This is migration-identity mismatch evidence; it does not prove every effect of every file is absent. Continue physical object/body/ACL reconciliation. Do not fabricate migration ledger rows or replay SQL blindly.

Encrypted off-site backup, isolated restore rehearsal and measured RPO/RTO remain unverified. Do not deploy the payment Edge bundles or enable paid checkout independently of the coordinated reviewed database/Edge rollout. Full Production remains **BLOCKED / NOT CERTIFIED**.

## Change boundary

- Updated only `scripts/validate-payment-migration-wiring.mjs` and audit/release documentation on branch `audit/payment-intent-and-subscription-production-drift-20261119`.
- No Production SQL, DDL, DML, grant, RLS, Auth, Edge Function, payment, refund, wallet, settlement, customer-data or website deployment change occurred.
