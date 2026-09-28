# RC183 — Marketplace Catalog Tenant Boundary

## Problem closed
The homepage could identify a provider business while the authenticated customer's active membership belonged to another tenant. Passing the customer's tenant into the provider catalog would cause a real marketplace booking to fail or resolve against the wrong tenant.

## Implementation
- `/api/v1/catalog` now resolves the authoritative tenant from the requested active `business_id`.
- An optional requested tenant is treated as an assertion; mismatch is rejected.
- Active provider profile and active business are required.
- Customer authorization can come from an active membership in the provider tenant or an active CUSTOMER membership elsewhere.
- Web catalog loading no longer depends on the customer's `live.tenantId`.
- Order creation from the catalog uses `catalog.tenantId` and no unrelated customer branch is sent.

## Security boundary
Customer marketplace access does not grant provider-tenant management permissions. Provider operational writes remain membership/business scoped.

## Verification
- Live DB `create_order_backend` contains customer membership and active-provider guards.
- Latest API deployment could not be independently confirmed from the deployment tool response; therefore production Edge Function convergence remains NOT VERIFIED.
- Real customer/provider E2E remains OPEN.
