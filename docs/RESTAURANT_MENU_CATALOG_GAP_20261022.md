# Restaurant Menu → Canonical Catalog Integration Gap
Date: 2026-10-22
Status: OPEN / NOT IMPLEMENTED / NOT VERIFIED

## Confirmed source evidence

- The restaurant workspace loads and edits `public.restaurant_menu_items` in `web/restaurant-module.js`.
- Restaurant order creation independently loads `/api/v1/catalog` and submits the selected `catalogItemId` to the canonical `order-create` Edge Function.
- `order-create` validates active rows in `catalog_items` and an effective active row in `catalog_item_prices`; it does not accept a `restaurant_menu_items.id` as a substitute.
- `catalog-admin` exposes `ITEM_UPSERT` and `PRICE_UPSERT`. The current `upsert_catalog_item_backend` implementation inserts a new item when `p_id` is null; `p_legacy_ref` is stored but is not itself an upsert selector in that function. Repeated client-side calls with no stable item ID can therefore create duplicates.
- The restaurant menu editor currently saves its row and returns success without synchronizing the canonical catalog. A saved menu row must not be represented as guaranteed orderable.

## Safe implementation boundary

Do not add a browser-side two-write sequence (menu save followed by catalog item and price calls) as the final fix. It can leave partial state if one call succeeds and the next fails, and naive retries can create duplicate catalog items.

The preferred next candidate is a server-authoritative, idempotent bridge with a stable mapping between a restaurant menu item and its canonical catalog item. It must:

1. Authenticate the caller and validate active membership for the exact tenant, business, and branch; enforce the shared CATALOG permission server-side.
2. Lock/serialize by source menu item and use a durable unique mapping so concurrent retries cannot create duplicate catalog items.
3. Save the restaurant menu row, canonical catalog item, and branch-scoped EGP price atomically where possible; if separate transactions are unavoidable, expose explicit reconciliation state and a retry-safe repair path.
4. Map `is_available` to canonical orderability in a fail-closed way; unavailable items must not remain orderable through the customer catalog.
5. Validate non-negative bounded price, name/category lengths, branch ownership, and supported item state; never trust client-provided tenant/business/branch identifiers without server membership checks.
6. Keep order pricing authoritative in `catalog_item_prices`; do not let `items_json` or browser-submitted totals set the final price.
7. Preserve the current canonical `order-create` and `order-status-update` flows. Do not create a parallel order/payment path.

## Required tests before declaring complete

- New item creates exactly one menu row, mapping, catalog item, and price row.
- Editing the same menu item updates the mapped catalog item and creates the correct effective price version without creating a duplicate catalog item.
- Repeating the same request and racing two requests remains idempotent.
- Unavailable menu items are rejected by the canonical catalog/order endpoint.
- Wrong tenant/business/branch, inactive membership, insufficient role, inactive business/branch, negative price, and invalid fields fail closed.
- Simulate failures between persistence steps and prove rollback or safe reconciliation.
- Customer catalog shows the item only in the correct business/branch and the order uses the server-side catalog price.
- Authenticated browser E2E covers restaurant staff editing the menu, customer selecting the item, order creation, and status update.
- Run exact-head CI and cross-PR migration collision checks; record the exact commit and run URLs.

## Current UI mitigation

The restaurant menu screen now displays a warning that menu records are not guaranteed to appear in the canonical catalog. A source-contract assertion protects this warning until the bridge is implemented and verified.

No production migration, Edge Function deployment, production data mutation, merge to main, or deployment is authorized by this document.
