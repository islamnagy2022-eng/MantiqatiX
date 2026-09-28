# RC185 — Order API Tenant Boundary

## Implemented
- POST /api/v1/orders now resolves the target business before authorization.
- The business must be ACTIVE.
- The tenant is derived from the business record rather than trusted from the request body.
- A supplied tenantId that does not match the business tenant is rejected with 403.
- Membership and provider checks then operate against the derived tenant/business boundary.
- The existing create_order_backend remains the authoritative order/pricing layer.

## Verification status
- Source change committed.
- Production deployment of this API source is NOT VERIFIED in this checkpoint.
- Real customer-to-provider order E2E remains OPEN.
