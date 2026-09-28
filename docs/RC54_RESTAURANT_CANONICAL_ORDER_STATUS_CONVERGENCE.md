# RC54 — Restaurant Canonical Order/Status Convergence

Date: 2026-09-28

## Completed

- Restaurant order reads now target the canonical public.orders table rather than legacy restaurant_orders.
- Restaurant order creation already uses the production order-create Edge Function.
- Canonical order creation recalculates pricing server-side from catalog_items/catalog_item_prices and calls create_order_backend.
- Restaurant order status updates now use the production order-status-update Edge Function instead of direct table UPDATE.
- order-status-update was deployed as version 2 ACTIVE with browser CORS restricted to the production GitHub Pages origin.
- Restaurant status choices were aligned with the verified backend state machine: CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED.
- No production database grants or migrations were changed.

## Verified backend boundary

- create_order_backend is not executable by authenticated clients directly.
- update_order_status_backend is not executable by authenticated clients directly.
- Both are reached through JWT-protected Edge Functions that authenticate the user server-side.
- update_order_status_backend enforces tenant/business scope, allowed transitions, customer cancellation rules, and prevents cancellation after a successful payment unless refund handling occurs first.

## Remaining

- Fresh authenticated customer/provider E2E remains required before final certification.
- Payment-provider E2E, backup/restore drill, physical-device regression, release signing/build evidence, and leaked-password protection remain external release gates.

No test accounts, fake orders, fake payments, or speculative migrations were created.
