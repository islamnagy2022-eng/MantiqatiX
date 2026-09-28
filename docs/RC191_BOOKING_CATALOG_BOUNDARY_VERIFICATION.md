# RC191 — Booking Catalog Boundary Verification

## Reviewed
- Public homepage provider cards pass the provider `business_id` into the catalog flow.
- `loadBusinessCatalog` sends `businessId` and an optional tenant assertion.
- `/api/v1/catalog` resolves the authoritative tenant from the target business and rejects a mismatched tenant assertion.
- Active provider profile is required for the target business.
- Catalog items, prices, and options are filtered by the business-derived tenant and business scope.
- Order creation sends the catalog-derived tenant and business context to the existing authoritative order function.

## Decision
No additional catalog code change was introduced in this checkpoint because the existing boundary already matches the required customer → provider booking architecture.

## OPEN
- Deployed browser E2E.
- Real customer → provider order creation.
- Provider order receipt and status transition.
- Customer notification delivery.
- Payment/refund E2E.
- CI/deployment convergence.
