# RC199 — Real Booking E2E Readiness

## Status
- Booking E2E: **BLOCKED**
- RLS customer cross-tenant visibility: **FIXED + VERIFIED**
- Production test data readiness: **BLOCKED**
- No production order was created.

## Readiness evidence
Live production project: `moyhiluyhjsujhwlyeuu`

Current aggregate state:
- Non-anonymous auth users: 6
- Active tenants: 1
- Active businesses: 0
- Active provider profiles: 0
- Active catalog items: 0
- Active catalog prices: 0
- Active CUSTOMER memberships: 1
- Active provider-side memberships: 5
- Existing orders: 0

The marketplace cannot execute a real customer-to-provider booking while there is no active business/provider/catalog/price chain.

## Security/authorization verification
`orders` has RLS enabled and forced.

Before RC199, the live `orders` SELECT policies required a same-tenant active membership for the general customer/member read path. That did not provide the documented customer-to-provider cross-tenant read path.

RC199 added the minimal SELECT policy:
- authenticated users only
- anonymous JWTs rejected
- `customer_id = auth.uid()`
- no INSERT, UPDATE or DELETE privilege is granted by this policy

Production verification confirms the policy exists and `orders` remains RLS-enabled and FORCE RLS.

## Provider status path
Production `order-status-update` is ACTIVE, version 2, with `verify_jwt=true`.
The function validates a Bearer token and delegates status mutation to `update_order_status_backend`.

## NOT VERIFIED
- Customer login through the real browser session.
- Real provider discovery against an active provider.
- Catalog selection against active production catalog data.
- Real order creation.
- Customer post-create order visibility with a real order.
- Provider-side order visibility with a real order.
- Provider status transition against a real order.
- Customer notification delivery.
- Cancellation and paid-order protection.
- Payment/refund path.

## BLOCKER
A real E2E booking requires authorized, real test data/accounts: an active provider business, active provider profile, active catalog item, active price, and a customer account permitted for testing. The database currently has none of the required active provider/catalog chain.

No synthetic production order or fabricated IDs were created to close this gate.

## Files / Commits
- `supabase/migrations/20260928184000_rc199_customer_cross_tenant_order_visibility.sql`
- Commit: `57c8be1fa086ec2cb6339d879ee2b4b82721d493`
- RC198 verification: `61f1a43977d0766c0bcff5350329af96f918d02e`

## Next
RC199 remains open until real E2E credentials/data are available. Do not advance the booking gate by inventing production data.
## Additional RC199 finding — browser read privilege
The current `web/app.js` reads `orders` and `order_status_history` directly through the Supabase client.

Live privilege inspection shows `authenticated` currently has no `SELECT` privilege on `public.orders`; the RLS policies therefore cannot make the direct browser read path functional by themselves.

The required least-privilege fix is:
- grant `SELECT` to `authenticated` on `orders` and `order_status_history` only;
- keep INSERT/UPDATE/DELETE client privileges absent;
- keep RLS/FORCE RLS enabled;
- add a customer-only `order_status_history` SELECT policy tied to the customer's own order.

This DDL was **NOT APPLIED** in this checkpoint because the DDL execution tool rejected the grant migration. No unsafe workaround was used.

Therefore browser order visibility remains **NOT VERIFIED/BLOCKED** until the read grant is applied and re-verified.