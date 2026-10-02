# RC216 — Order Lifecycle Execution Contract

## Scope

This checkpoint converts the order lifecycle review into a CI-enforced source contract without inserting fake production accounts or transactions.

Canonical lifecycle:

Discovery → Catalog/Pricing → Create Order → Provider Acceptance → Fulfillment → Payment → Commission Snapshot → Settlement → Ledger → Notification/Audit → Completion.

## Implemented guards

- Customer web order creation references the canonical `order-create` Edge Function.
- Provider/restaurant status changes reference `order-status-update`.
- `order-create` requires an authenticated non-anonymous user.
- Order creation validates idempotency.
- Catalog and active pricing are read server-side.
- Pricing snapshot/hash/version are part of the authoritative order contract.
- Status mutation delegates to `update_order_status_backend`.
- Payment intent requires authoritative pricing data and idempotency.
- Settlement uses the server-side `create_settlement_backend` path.
- Browser-side direct INSERT/UPDATE/DELETE against `public.orders` is rejected by the validator.
- GitHub Pages CI now executes `scripts/validate-order-lifecycle.mjs`.

## Test-data policy

No fake production users, orders, payments, settlements, or storage objects are created by this checkpoint.

For the remaining E2E gate, controlled test fixtures must be created in an isolated non-production/staging environment or an explicitly approved test environment. They must be identifiable and removable as a set.

Required fixture matrix:

- TEST_USER_A / TEST_TENANT_A / TEST_BUSINESS_A
- TEST_USER_B / TEST_TENANT_B / TEST_BUSINESS_B
- Published test catalog item + active price
- Test order
- Test payment intent/event
- Test commission/settlement/ledger chain
- Test notification
- Storage test object when media E2E is enabled

Required assertions:

1. A can create/read its authorized order.
2. B can create/read its authorized order.
3. A cannot read/update B's order.
4. B cannot read/update A's order.
5. Duplicate idempotency submission does not create a second order.
6. Invalid status transitions are rejected.
7. Payment amount/currency/pricing snapshot cannot be client-forged.
8. Settlement references the correct financial chain.
9. Notification failure does not change authoritative order state.
10. Cleanup removes all TEST_* fixtures before production certification.

## Release status

This checkpoint closes the **source-contract guard** only. It does not claim real customer/provider/payment/settlement E2E PASS. Those require approved authenticated test identities and, for external payment flows, approved provider credentials.
