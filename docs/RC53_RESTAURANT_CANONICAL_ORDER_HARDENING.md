# RC53 — Restaurant Canonical Order Hardening

Date: 2026-09-28

## Verified

- The production order-create Edge Function is JWT-protected.
- The order-create path now ignores client-supplied financial totals and derives item prices from the active canonical catalog and active catalog prices.
- Canonical order creation calls create_order_backend with the server-calculated subtotal, tax, delivery fee, total, currency, and authoritative item lines.
- Restaurant order creation in the web module now calls the canonical order-create function instead of the generic API path.
- The production order-create function was deployed as version 3 and is ACTIVE.
- The legacy restaurant_orders status dropdown was changed to read-only; the browser no longer performs direct status mutations on that legacy table.
- No database privilege was widened and no production migration was created.

## Security rationale

The legacy restaurant order table and its backend mutation functions are not the canonical financial/order authority. Direct browser status mutation could bypass the central order state machine. Until a verified authoritative bridge exists, legacy status is read-only in the restaurant UI.

## Remaining

- Fresh authenticated end-to-end order creation with a real approved user remains external runtime verification.
- Payment provider E2E remains blocked on approved provider credentials/traffic.
- Canonical order status transition should use the existing order-status-update Edge Function and update_order_status_backend path when the restaurant UI is wired to canonical orders.
- Final production certification remains blocked by the existing RC90-RC99 external gates.

No test accounts, fake transactions, or speculative migrations were created.
