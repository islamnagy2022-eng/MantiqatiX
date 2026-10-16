# SMM Gateway Financial Integrity Review — 2026-10-16

**Branch:** `integration/baseline-replay-candidates-20261016`  
**Reviewed source:** `supabase/functions/smm-gateway/index.ts` (blob `26101b48d9ab4135b1174e39907f87bfc593076b`) and baseline definitions of `smm_debit_wallet` / `smm_refund_wallet`.  
**Review type:** Static source review only. No runtime tests, provider calls, wallet changes, or production queries were performed.  
**Disposition:** **BLOCK SMM MONEY-MOVING ACTIONS FROM RELEASE CERTIFICATION UNTIL REMEDIATED AND TESTED.**

## SMM-FIN-01 — Order creation, debit, and provider submission are not one atomic workflow

In `place_order`, the gateway inserts an order in `SUBMITTING`, then calls `smm_debit_wallet`, then calls the external provider. These are separate database/API/provider operations. The source attempts to mark the order failed on insufficient balance, and refunds after a caught provider error, but the full flow has no durable idempotency key binding the client request to a single order and debit.

**Risk:** repeated client submissions can create multiple orders and multiple debits for one intended purchase. A provider timeout is ambiguous: the provider may have accepted the order even though the response was lost, while the gateway refunds the customer. This is a consistency risk, not proof of a currently exploited defect.

## SMM-FIN-02 — Refund operation is not idempotent by reference

The captured `smm_refund_wallet(p_user, p_amount, p_reference, p_description)` implementation credits the wallet and inserts a REFUND transaction, but does not enforce uniqueness of the refund reference or reject an already-refunded order. Repeating the same refund call can credit the same reference more than once unless another, independently verified guard prevents it. No such guard is present in the function body inspected.

**Risk:** duplicate refunds and wallet/ledger divergence. This is a high-priority financial integrity concern requiring runtime reproduction and schema/privilege review.

## SMM-FIN-03 — Provider synchronization overwrites selling price with provider rate

The `sync_services` action sets both `provider_cost` and `selling_price` from the provider's `rate` field during upsert. If the rate is a cost rate, this can overwrite an administrator-configured retail price and remove intended margin. The provider's rate unit and the product's per-1000 pricing contract must be confirmed before changing this behavior.

**Risk:** incorrect pricing or lost margin. Do not assume the provider's rate is the retail price.

## SMM-FIN-04 — Post-provider persistence failures are not handled consistently

After a provider returns an order ID, the gateway updates the order to `PROCESSING` and inserts an event, but does not check both mutation results before returning success. If the order update or event insert fails, the UI may report success without durable local state. Similarly, status synchronization ignores update/event errors.

**Risk:** local/provider state divergence and weak auditability.

## Recommended implementation plan (not applied)

1. Add a client idempotency key with a unique database constraint and a single authoritative order-creation/debit transaction or RPC.
2. Use a durable state machine: `PENDING_DEBIT → SUBMITTING → PROCESSING`, with explicit `PROVIDER_UNKNOWN` / reconciliation state for timeouts; do not automatically refund an ambiguous provider result without reconciliation.
3. Make debit/refund operations idempotent by immutable order/reference ID using unique constraints and atomic wallet + transaction ledger updates.
4. Reconcile provider submissions after network errors before refunding. Persist request/response correlation without logging provider secrets or sensitive payloads.
5. Check every DB mutation result. A failed event write or state transition must return a non-success result and create a retry/reconciliation obligation.
6. Separate provider-cost sync from selling-price management. Sync cost fields only; calculate/maintain retail pricing through an explicit margin/rule policy and preserve manual overrides.
7. Add disposable PostgreSQL integration tests for duplicate submit, duplicate debit, duplicate refund, concurrent same-key requests, provider accepted-but-timeout, provider rejection, DB failure after provider acceptance, and pricing sync preserving retail price.
8. Review RC456 table ACLs and current deployed Edge Function parity independently; do not treat source tests as proof of live deployment.

## Required release evidence

- Isolated tests prove exactly one order/debit per idempotency key and at most one refund per reference.
- Failure injection covers each boundary between order insert, debit, provider submission, order update, and event insert.
- Provider sandbox E2E verifies ambiguous-timeout reconciliation without real money.
- Read-only deployment/version and ACL verification after an explicitly approved rollout.

## Safety

No source implementation, migration, database grant, RLS/Auth setting, provider secret, production wallet, real provider order, payment, deployment, or merge was changed by this review. These are static findings to reproduce and remediate in an isolated environment. MantiqaTiX release remains **BLOCKED / NOT CERTIFIED**.
