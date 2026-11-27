# Paymob RC475 Production Preflight and Edge Compatibility Recheck

**Date:** 2026-11-27  
**Repository baseline:** `main @ 318267289b21177f3122d7780d1b32aa60c23365`  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Decision:** **BLOCKED / NOT CERTIFIED** — RC475's physical schema preflight currently matches, but the deployed payment Edge/RPC bundle is not compatible with current source contracts.

## Scope and safety

This checkpoint used read-only Supabase catalog/metadata queries, the migration inventory, and deployed Edge source retrieval. It did not read payment/customer transaction rows. No Production SQL mutation, migration, Edge deployment, Auth/RLS/GRANT change, webhook replay, payment, refund, wallet, or settlement action was performed.

## 1. RC475 physical preflight

The current source migration is `supabase/migrations/20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql` (blob SHA `13cf575da0d7c4aea8717b3941176d9e706a5da8`).

A direct read-only comparison against its exact preflight requirements found:

- **123/123 required column/type pairs present** across the payment, order, subscription, and financial tables referenced by RC475.
- **9/9 required indexes present**, all unique, valid, and ready. Their definitions match the expected provider-event uniqueness, subscription idempotency/provider-order uniqueness, and financial obligation/commission/reconciliation uniqueness contracts.
- `public.legal_assert_action(uuid,text,uuid)` is present.
- The existing standard-payment success RPC has the exact RC475 replacement signature. It is currently SECURITY DEFINER, owned by `postgres`, and executable by `service_role` only, but its live `search_path` is still `public`; RC475's reviewed definition uses an empty search path.
- The three new RC475 functions are absent in Production:
  - `process_verified_provider_payment_failure(...)`
  - `process_verified_subscription_payment_failure(...)`
  - `process_verified_subscription_payment_backend(...)`

The seven inspected payment/finance tables all have RLS and FORCE RLS enabled. Anonymous direct access and authenticated direct DML are denied on the inspected tables. Existing service-role table DML grants are limited to `payment_intents` and `commission_transactions` among that inspected set; the reviewed RPC design instead uses tightly scoped SECURITY DEFINER entrypoints.

**Interpretation:** RC475's schema/index prerequisites are physically present, so the migration's schema preflight should not fail for those checked objects. That is not permission to apply it alone: the live standard success function still has the old body/configuration, the three new RPCs remain absent, and the caller Edge functions are materially behind current source.

## 2. Migration-ledger identity gap

The live migration inventory contains **310 rows**, ending at `20261110150618`. The current source release contract contains **87 required source version IDs**; a direct exact-ID comparison returned **0/87** matches.

This is an identity/source-history mismatch, not proof that all 87 physical effects are missing. Do not fabricate migration-ledger rows, rename historical versions, or blindly replay old migrations. Continue the source-to-live alias and physical-effect reconciliation, and apply only reviewed forward repairs in a coordinated release.

RC475's own version `20261118040000` is not in the live ledger.

## 3. Focused test evidence

### RC475-focused PostgreSQL test

GitHub Actions run [44302641312](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/44302641312) completed successfully on 2026-11-18. It ran the disposable fixture, RC475 migration, integration test, and two-session concurrent replay script.

The logs explicitly record:
- `RC475 Paymob webhook forward-repair integration: PASS`
- `RC475 concurrent Paymob replay: PASS` with one first execution, one idempotent replay, one provider event, one financial reconciliation, and one commission transaction.

The migration, integration SQL, and concurrency-script blob SHAs used by that run are unchanged on the current `main` baseline:
- Migration: `13cf575da0d7c4aea8717b3941176d9e706a5da8`
- Integration test: `40e10ab9ef75976246f8bd9f56ccc8d51a3c25f5`
- Concurrency script: `a8037aabc9cad3941cc6602dea35fc9a5e076e2c`

The workflow file has since changed: current main adds source-file path coverage and the `validate-paymob-webhook-order-binding.mjs` step. That added validator was not part of the 2026-11-18 run and must have its own exact-head passing evidence before the updated focused workflow is treated as fully verified.

### Full chronological PostgreSQL 17 replay

GitHub Actions run [46057076160](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/46057076160) completed successfully on 2026-11-27 from candidate head `8053138572fadff00dd261db345db3ec54ec295e`. It used the Supabase PostgreSQL `17.11.0.006` image, restored the captured Production schema checkpoint into disposable infrastructure, validated the 87-version release contract, and replayed **127 forward migrations** in timestamp order. The log includes RC475 at `20261118040000`.

This proves that the reviewed source chain can replay from the captured test checkpoint. It does not prove Production has the same physical schema/data, and it did not mutate Production.

## 4. Live Edge/RPC compatibility blockers

Current deployed Edge inventory and the direct RPC read-back show:

| Production Edge | Deployed version / SHA | Live dependency result |
|---|---|---|
| `paymob-webhook` | v10 / `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` | Behind current source; see P0 correlation and atomicity finding below. |
| `payment-intent` | v8 / `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54` | Live create RPC exists, but retains `search_path=public, pg_temp` and does not meet the current RC474 branch-scope contract. |
| `digital-page-payment-intent` | v5 / `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b` | Claim/release RPCs exist with old search path; current five-argument provider-order-bound finalizer is absent. Only the legacy four-argument finalizer exists. |
| `subscription-payment-intent` | v4 / `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` | Both current RC435 claimable-create/claim RPCs are absent. RC435's `provider_creation_state` and `provider_creation_claimed_at` columns/constraint and RC439's three encrypted checkout-secret columns are also absent. |

The current-main webhook source calls six payment processor RPCs. Production currently has:
- Standard success processor: present, but old `search_path=public` definition.
- Standard failure processor: absent.
- Subscription success and failure processors: absent.
- MantiGO atomic payment processor: absent.
- Digital-page processor: present, but old `search_path=public, pg_temp` body writes the incoming provider order ID using `coalesce(...)` without first requiring it to equal the order's previously stored provider order ID.

### P0 Paymob order-correlation and atomicity finding

The deployed `paymob-webhook` v10 HMAC calculation includes the signed `order.id`, but its record-selection flow first looks up a payment by `order.merchant_order_id`. When that unsigned reference finds a row, the handler does not compare the selected row's stored `provider_order_id` with the signed `order.id` before processing it. This leaves a potential cross-order settlement path when two orders share the same amount/currency and the merchant reference points at the wrong pending record. No exploitation or resulting incorrect settlement was observed; this is a code-path risk, not a breach finding.

The same deployed v10 handler also:
- Persists a standard-payment failure event and updates the intent in separate Edge/database calls rather than through the current atomic failure RPC.
- Directly changes subscription failure status rather than using the current atomic processor.
- Inserts a MantiGO provider event and updates its financial ledger in separate calls, while the current source expects the missing atomic MantiGO RPC.

The current-main webhook source contains the corrected signed-order binding and RPC calls, but the production v10 bundle is not that source. Do not certify or independently deploy this Edge function until all matching database contracts and the negative replay tests are ready.


### Follow-up: MantiGO validator coverage

The live-read comparison also confirmed that the current-main `paymob-webhook` source has a MantiGO signed-order guard: it compares signed `order.id` with `mantigo.metadata.paymob_intention_order_id` before calling `process_verified_mantigo_payment_backend`.

The initial `validate-paymob-webhook-order-binding.mjs` validator covered standard orders, digital pages, and subscriptions, but omitted the MantiGO branch. This audit branch now extends the validator to assert the MantiGO lookup, signed order extraction, stored-order equality guard, HTTP 409 mismatch response, and ordering before the atomic RPC. The updated validator passed on the exact PR #1189 head in the RC475 workflow run [46060385246](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/46060385246). The log records: `Paymob signed provider-order binding (standard, digital-page, subscription, MantiGO): PASS`. The same run completed the RC475 disposable migration/integration and two-session concurrency tests successfully.


### Exact-head follow-up validation on PR #1189

The RC475 workflow run [46060385246](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/46060385246) completed successfully on PR #1189 head `04df0ff141fa75048b2b32e82e72eb2d082613e5`. It passed:
- `validate-finance-boundaries.mjs`
- `validate-payment-migration-wiring.mjs`
- Updated `validate-paymob-webhook-order-binding.mjs`, including the MantiGO guard
- Disposable RC475 migration and integration
- Two-session concurrent replay

The workflow log records `RC475 Paymob webhook forward-repair integration: PASS` and `RC475 concurrent Paymob replay: PASS` with one idempotent replay, one provider event, one reconciliation, and one commission transaction.

The separate RC425 MantiGO atomicity job on the same PR head also completed successfully, including its payment-order-binding validator step and disposable atomic-payment integration. These are source/isolated-database results only, not Production rollout evidence.

## 5. Required coordinated release sequence

1. Finish the 87-source migration alias/effect crosswalk. Preserve the existing migration ledger; do not synthesize version rows or replay historical migrations out of order.
2. Complete the payment DB prerequisites as one reviewed chronological chain: RC425 MantiGO atomicity; RC435 subscription claim workflow; RC439 encrypted checkout recovery; RC426/RC468/RC470 digital-page provider-order binding; RC474 branch-bound payment-intent creation; and RC475 standard/subscription atomic webhook processors. Reconcile any existing live objects before proposing each forward operation.
3. Run the exact-head validators and PostgreSQL 17 integration/concurrency tests, including a negative Paymob A/B case: equal amount and currency, distinct signed Paymob order IDs, and a deliberately altered unsigned `merchant_order_id`. The callback must reject and leave both orders, intents, provider events, and financial records unchanged.
4. Deploy the matching Edge bundle only after exact RPC signatures, owners, SECURITY DEFINER/search_path, grants, secrets, and webhook HMAC/order binding are re-read from Production. Verify deployed-origin positive, negative, replay, failure, and duplicate/concurrent callback cases.
5. Re-read the live migration ledger, Edge versions/hashes, and financial reconciliation state before changing the release gate.

**Final disposition:** RC475's checked physical preflight = **PASS**; RC475 focused integration/concurrency evidence = **PASS**; full PostgreSQL 17 forward replay including RC475 = **PASS**; Production migration/Edge compatibility = **BLOCKED**; payment release = **NOT CERTIFIED**.

No Production mutation or deployment was performed in this checkpoint.
