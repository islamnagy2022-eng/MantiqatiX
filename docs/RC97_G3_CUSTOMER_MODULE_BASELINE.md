# RC97 — G3 Customer Module Baseline

## Scope
G3 verifies the existing customer journey without rebuilding the platform:

**Customer → Discover → Category/Service → Provider → Request → Order → Status → Support/Notification**

## Source review

### Customer UI
- `web/app.js` already contains a customer dashboard.
- Customer dashboard reads active services/providers and customer-visible orders.
- Provider catalog is loaded through the authenticated API.
- Order creation uses the `order-create` Edge Function.
- Order status changes use the `order-status-update` Edge Function.
- Customer cancellation is enforced server-side; operational transitions are role/scope controlled.

### Public discovery
- `web/home.js` reads only ACTIVE `marketing_services` and ACTIVE `marketing_provider_profiles`.
- Search is constrained to text fields and result limits.
- Location is presented as optional/operational rather than continuous tracking.
- No synthetic providers or locations are created.

## G3 implementation

### Completed
1. Fixed the public discovery handoff so an already authenticated user is sent to the platform instead of being unnecessarily returned to the login screen.
2. Preserved unauthenticated behavior: unauthenticated users still enter the existing authentication flow.
3. Kept discovery data source and RLS model unchanged.
4. Kept order creation server-authoritative; client totals remain advisory only.
5. Kept order status transitions server-authoritative.

Commit: `b0bb99c70d9c08c493c4e42107fc4a550dfb1443`

## Security verification

Database review confirms:
- Public provider/service discovery is restricted to ACTIVE rows by RLS.
- Customer order SELECT is restricted by active tenant membership plus customer ownership or explicitly authorized operational roles.
- Customer order INSERT requires the authenticated user to be the customer and to have an active membership for the tenant.
- `create_order_backend` verifies `auth.uid() = p_customer_id`, active tenant membership, business/tenant consistency, branch consistency, catalog item availability, active pricing, option validity, and calculates the authoritative total server-side.
- `update_order_status_backend` verifies authenticated-user identity, tenant membership, role/business scope, and allowed state transitions. A paid order cannot be cancelled without the refund path.

## Verification status

### DONE
- G3 source review.
- Customer journey implementation review.
- RLS/policy review for discovery, catalog, and orders.
- Server-authoritative pricing/order review.
- Server-authoritative status-transition review.
- Authenticated discovery handoff fix.

### NOT YET VERIFIED
- Real browser E2E with a real CUSTOMER account.
- Real browser E2E across customer → provider → catalog → order → status.
- Multi-tenant customer/provider scenario.
- Responsive/accessibility smoke on production deployment.
- Production payment-provider flow.
- Remaining project-wide security-advisor findings.

## Release gate
G3 is **implemented but not fully verified**. It must not be described as production-complete until the external E2E and release-gate checks pass.
