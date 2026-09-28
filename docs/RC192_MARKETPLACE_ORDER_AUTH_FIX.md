# RC192 — Marketplace Order Authorization Fix

## Finding
The `order-create` Edge Function still required the customer to have an ACTIVE membership in the target provider tenant and business. That contradicted the marketplace authorization contract used by the homepage/catalog flow.

## Implemented
- A target-business membership is accepted when present.
- Otherwise, an ACTIVE CUSTOMER membership anywhere on the platform is accepted.
- The target business must still be ACTIVE and the catalog/pricing remain scoped to the supplied tenant/business.
- The authoritative `create_order_backend` remains the final order/pricing boundary.

## Security
This does not grant provider access to customers. It only permits an authenticated customer with an active CUSTOMER membership to place an order against an active provider business. Tenant/business consistency and authoritative pricing remain enforced.

## Verification status
- Source committed.
- Production deployment/convergence of `order-create` is NOT VERIFIED in this checkpoint.
- Real customer → provider order E2E remains OPEN.
