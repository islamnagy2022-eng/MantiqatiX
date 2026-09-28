# RC53 — Restaurant Canonical Order Path

Date: 2026-09-28

## Scope

Close the restaurant "new order" path against the existing canonical MNTY order architecture without introducing a second pricing/payment authority.

## Changes

- `web/restaurant-module.js` now obtains the active business catalog through the existing authenticated catalog API.
- Restaurant order creation now calls the existing `order-create` Edge Function instead of the missing `POST /api/v1/orders` route.
- `supabase/functions/order-create/index.ts` was hardened so client-supplied subtotal, discount, tax, delivery fee, and total are no longer trusted.
- The Edge Function validates the authenticated user, active tenant/business membership, active business, catalog item scope, active pricing, currency, quantities, and option ownership.
- Server-side pricing is calculated from `catalog_items`, `catalog_item_prices`, and active `catalog_item_options`.
- Discount and delivery fee remain server-controlled at zero in this path.
- The resulting order is persisted only through `create_order_backend`.
- Browser CORS is restricted to the production GitHub Pages origin.
- Production Edge Function `order-create` is ACTIVE at version 2.

## Security boundary

The browser never receives or uses the service-role key. The Edge Function authenticates the user and uses the service role only server-side to perform the authoritative catalog read and invoke the protected backend RPC.

## Verification status

Verified:
- Production function deployment returned ACTIVE version 2.
- `create_order_backend` EXECUTE is not granted to anon/authenticated; it is available to service_role.
- No production migration was added or changed.
- No test account, fake order, fake payment, or fake transaction was created.

Not verified:
- Real customer two-user/two-tenant E2E.
- Real payment-provider E2E.
- Physical-device regression.
- Full production release certification.

Therefore this checkpoint does not change the project's overall release status: MantiqatiX remains NOT CERTIFIED / not Production Ready until the outstanding release gates are actually executed.
