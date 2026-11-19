# Pass 892–899 — Digital-page Paymob order-correlation regression

**Date:** 2026-11-19  
**Scope:** Digital-page Paymob intention creation, callback verification, atomic database processor  
**Environment:** Supabase Production read-only; GitHub source/test-only branch  
**Production mutations:** NONE

## 1. Relationship to the existing Pass 884–891 record

PR #832 merged the broader Paymob webhook live/source drift report as main commit `dbfd3e4bb995166ccb7aeeca1e16d7c4ba5d2fd4`. This follow-up is narrower: it traces the *digital-page* payment branch from Paymob intention creation through webhook lookup and the database processor, then adds a regression assertion to the existing Pages validator. It does not duplicate the MantiGO direct-ledger/atomicity finding from PR #832.

## 2. Confirmed live trust-boundary gap

### HMAC field boundary

The deployed Paymob HMAC verifier constructs its canonical field string using `order.id`, alongside amount, currency, transaction ID and the other provider callback fields. It does not include `order.merchant_order_id`.

Therefore:

- `order.id` is the provider-order identifier authenticated by the HMAC.
- `order.merchant_order_id` is a lookup/reference value, not an authenticated binding in this code path.
- The database row selected using the merchant reference must be checked against the signed `order.id` before any payment mutation.

This is not a claim that Paymob's HMAC can be forged. The risk is that a signature-valid event can carry an altered merchant reference while retaining the signed provider order ID.

### Deployed digital-page webhook v10

Fresh live retrieval confirmed:

- ACTIVE version 10, `verify_jwt=false`.
- Bundle SHA-256: `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca`.
- The digital-page branch looks up by `merchant_order_id` first, then by `provider_order_id`.
- After selecting by merchant reference, it checks amount and currency.
- It passes the signed Paymob `order.id` into the processor as `p_provider_order_id`.
- It does **not** check that the selected order's stored `provider_order_id` is non-null and equal to that signed `order.id` before calling the processor.

### Deployed database processor

The live `process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)` definition is the exact legacy RC424 body:

- MD5: `a5e65a21d159846e2814c82bb89925ce`
- Body length: 2,997 characters
- SECURITY DEFINER, owner `postgres`
- `search_path=public, pg_temp`
- Service-role EXECUTE only; anon and authenticated cannot invoke it.

It checks signature flag, event presence, status, order existence, amount/currency and whether a previously recorded external event belongs to the same order. It does **not** require the order's pre-existing `provider_order_id` to equal `p_provider_order_id`. Instead, when transitioning a pending order, it writes the callback's provider-order ID with `coalesce(nullif(p_provider_order_id, ''), provider_order_id)`. It also lacks the hardened external-event-to-transaction binding and advisory event lock.

The combination creates a potential first-delivery cross-order misapplication path when an unsigned merchant reference is altered to select another pending order with matching amount/currency. The processor can then accept the signed provider order ID from the callback and attach it to the selected order. Existing event uniqueness and order-reuse checks help with some replays, but do not replace pre-mutation equality against the provider order ID already bound to the order.

### Deployed intention finalizer

Only the legacy four-argument `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` exists in Production:

- SECURITY DEFINER, `search_path=public, pg_temp`.
- authenticated EXECUTE=true; anon and service_role EXECUTE=false.
- Binds the caller to `auth.uid()`, order ownership and claim token.
- Stores only `provider_intent_id`; it cannot persist the Paymob provider order ID.

The required five-argument finalizer that also stores `provider_order_id` is absent.

## 3. Current main fixes

The current source already contains the required forward repair:

1. `digital-page-payment-intent/index.ts` uses `isValidPaymobAmountCents` and `matchesPaymobIntention` to validate amount, currency, internal reference, provider intent ID, provider order ID and client secret. It persists both provider IDs through the five-argument finalizer.
2. `paymob-webhook/index.ts` still verifies the HMAC using signed `order.id`, treats `merchant_order_id` as a lookup hint, then requires the selected row's stored `provider_order_id` to equal the signed Paymob order ID. It fails closed with `DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH` before the processor RPC.
3. RC470 replaces the exact legacy RC424 processor body with a fail-closed forward migration. Its preflight checks the function fingerprint and live object/ACL contracts (or the already-hardened RC431 source body); it does not blindly overwrite an unknown definition.
4. The RC470 processor requires:
   - non-null stored provider-order ID equal to the callback provider-order ID;
   - external event ID equal to `paymob:` plus provider transaction ID;
   - event-level advisory transaction lock;
   - same-order and same-status replay semantics;
   - empty `search_path`;
   - service-role-only EXECUTE.
5. RC426 adds the five-argument provider-bound finalizer; RC468 revokes the legacy finalizer path and hardens the claim/finalization boundary; RC431/RC470 harden the callback processor.

## 4. Existing regression coverage

- `supabase/tests/rc431_digital_page_payment_integration.sql` proves that a mismatched provider order is rejected, the order state is unchanged, and no payment event is persisted. It also covers invalid signature, event/transaction mismatch, amount/currency mismatch, same-status idempotent replay, conflicting replay status, event reuse across orders and atomic rollback.
- `supabase/tests/rc470_digital_page_webhook_forward_repair.sql` checks the hardened search path, grants and processor markers.
- `.github/workflows/rc470-digital-page-webhook-forward-repair.yml` applies an exact legacy RC424 fixture, RC470, its postcondition test and the RC431 integration suite in disposable PostgreSQL.

## 5. New regression protection added in this pass

Updated `scripts/validate-digital-pages-boundaries.mjs`, which is already invoked by the GitHub Pages validation workflow.

The validator now requires:

- the webhook HMAC canonical field builder to include `order.id` and not treat `merchant_order_id` as a signed field;
- the digital-page webhook's stored-provider-order comparison to occur after candidate lookup and before the processor RPC;
- the RC470 database processor to retain the provider-order equality guard;
- the RC431 behavioral test to retain mismatch rejection plus no-order-state-change and no-event-persistence assertions.

This is a source-level regression guard for the exact cross-order trust boundary found in Production. It does not alter the live callback, database or payment configuration. Exact-head CI for this new validator update is pending at this checkpoint.

## 6. Live data and release state

Fresh aggregate-only read-only query:

| Object / state | Rows |
|---|---:|
| Digital-page orders | 0 |
| Paymob digital-page orders | 0 |
| Pending Paymob digital-page orders | 0 |
| Digital-page provider payment events | 0 |

No customer row, payment payload or transaction was selected or changed. No exploitation or existing customer impact is observed. This is a P0 pre-launch blocker before enabling the first digital-page payment, not evidence of an existing loss.

The required exact migration IDs remain absent from the live ledger:

- RC426 `20261009130000`
- RC431 `20261009180000`
- RC468 `20261115030000`
- RC470 `20261117020000`

The ledger remains 310 rows through `20261110150618`; the full release manifest still records 0/62 exact required identifiers. This is a version-identity mismatch, not proof that every physical effect is absent.

Encrypted off-site backup, isolated restore rehearsal and measured RPO/RTO remain unverified. Production stays **BLOCKED / NOT CERTIFIED**.

## 7. Coordinated release requirements

1. Obtain the encrypted backup, isolated restore, rollback rehearsal and measured RPO/RTO.
2. Reconcile the exact RC426/RC431/RC468/RC470 dependencies, signatures, body fingerprints, owner, search_path and ACLs against physical Production.
3. Apply the reviewed database chain in dependency order.
4. Deploy matching `digital-page-payment-intent` and `paymob-webhook` source bundles together with the DB changes.
5. Run sandbox callbacks for correct order, changed merchant reference, wrong provider order, missing provider order, wrong amount/currency, duplicate event, conflicting replay status, failure event and concurrent first delivery.
6. Prove every rejected callback leaves both order state and event ledger unchanged; prove one valid callback creates one event and the expected payment/fulfillment state.
7. Keep live digital-page checkout disabled until the coordinated post-deploy tests pass.

## Change boundary

- Source-only change: `scripts/validate-digital-pages-boundaries.mjs`.
- Documentation and release evidence only.
- No Production SQL/DDL/DML, grants, RLS, Auth, Edge Function deployment, payment, wallet, settlement, customer data or site deployment occurred.
