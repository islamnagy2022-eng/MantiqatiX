# Cash-first Launch Scope — 2026-10-20

## Product decision

Launch one is **cash-first**. Only `CASH_ON_DELIVERY` is eligible for supported marketplace/restaurant order workflows. Paymob/card/electronic checkout is deferred until after launch. The independent SMM storefront, provider orders, and SMM wallet actions are also deferred until a separate post-launch approval.

The internal **Marketing & Advertising** workspace is distinct from the SMM storefront and may remain available within its existing permissions and currently implemented contracts.

## Source changes in this candidate branch

- `supabase/functions/api/index.ts`: preserve cash payment intent ID/status on retries; reject reuse of the same tenant-scoped idempotency key for a different order, amount, currency, provider, or method; handle concurrent inserts by re-reading the winning row.
- `payment-intent`, `digital-page-payment-intent`, `subscription-payment-intent`, and `mantigo-payment-intent` Edge Functions now have an explicit server-side default-deny launch flag returning `ELECTRONIC_PAYMENTS_DEFERRED`; provider webhooks remain present for safe event processing and are not a customer checkout entrypoint.
- `web/app.js`: after successful customer catalog order creation, request a cash payment intent using a stable key derived from the order ID. If tenant cash configuration is missing, state explicitly that the order exists but cash setup failed and collection is not confirmed.
- `web/restaurant-module.js`: request the same cash intent after restaurant order creation and do not describe the order as paid.
- `supabase/functions/api/index.ts`: expose a tenant/owner/authorized-role-scoped read of the cash intent for an order; the order details UI displays its status and offers collection confirmation only to operational roles, using the protected cash-confirm endpoint.
- `web/app.js`: disable the paid Digital Pages Portfolio/Menu checkout path for launch one because it currently depends on Paymob and no cash contract is verified for these products.
- SMM remains protected by the existing `SMM_INITIAL_LAUNCH_DEFERRED=true` server-side default-deny gate. No provider calls, wallet writes, or SMM launch action are introduced.

## Cash lifecycle requirements before launch

1. Each eligible tenant/business must have an enabled `tenant_payment_methods` row for `CASH_ON_DELIVERY`.
2. Server-derived order amount/currency remain authoritative.
3. Cash intent creation is idempotent; retries cannot replace intent IDs or move existing statuses backward.
4. Only an authorized staff/cashier/owner role may confirm collection through the approved server/RPC path.
5. Cash confirmation, commission/settlement/ledger behavior, and audit trail must be tested with disposable test data in an isolated environment.
6. Failure to configure cash must be explicit; the UI must never say “paid” or “collected” because an intent was created.
7. Review every checkout entrypoint before launch to ensure no Paymob/card checkout can be initiated in the launch-one user surface.

## POST-LAUNCH DEFERRED

- Paymob/card production activation, live provider transactions, electronic payment/refund E2E and webhook replay certification.
- Digital Pages paid Portfolio/Menu checkout until a reviewed cash fulfillment contract is implemented or electronic payments are approved post-launch.
- SMM storefront, provider synchronization, paid orders, wallet operations and SMM provider financial reconciliation. Re-enable only through a separate reviewed release and explicit approval.

## Verification status

- Source implementation: **IN PROGRESS — PR validation pending**.
- Cash API/UI E2E: **NOT VERIFIED**; staff confirmation UI exists in source but needs exact-head CI and isolated runtime verification.
- Tenant cash-method configuration in production: **NOT VERIFIED**.
- Production rollout: **NOT PERFORMED**.
- Global release: **BLOCKED / NOT CERTIFIED**.
