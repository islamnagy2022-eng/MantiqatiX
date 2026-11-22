# Pass 1991–2000 — Legacy API order-read scope isolation

**Date:** 2026-11-22  
**Area:** `GET /api/v1/orders/:id` authorization  
**Branch:** `feat/li2lak-verified-business-reviews-rebased-20261122`

## Finding
Production `api` Edge Function v17 authenticated the bearer user, loaded the order by ID, and then allowed same-tenant operational role names (`SUPER_ADMIN`, `ADMIN`, `OWNER`, `MANAGER`, `STAFF`, `CASHIER`, `DELIVERY_PARTNER`) or `ORDER_READ_ALL` without binding those roles to the order's business and branch. Provider reads were separately restricted to the provider's business. This left same-tenant cross-business/branch reads possible for scoped operational memberships.

## Candidate correction
The PR's `GET /api/v1/orders/:id` path now:
- loads only the requesting user's ACTIVE memberships in the order tenant;
- retains customer access only when `order.customer_id === user.id`;
- allows tenant-wide access only to a fully unscoped OWNER/ADMIN (both `business_id` and `branch_id` NULL);
- requires scoped operational roles to match both `business_id` and the exact `branch_id`;
- retains assigned-partner access only when the user is actually assigned to that order and membership scope does not conflict;
- retains provider reads only for the provider's own business and permitted branch scope;
- denies all other callers with 403.

**Branch-scope reconciliation:** the existing RC465 contract explicitly tests a business-scoped membership with `branch_id IS NULL` as seeing branchless orders only for the orders-member policy; exact business+branch equality remains the requirement for scoped operational reads. This pass deliberately did not widen NULL branch membership to every branch. The separate provider policy has its own explicit business-wide branch-null exception.

## Verification
- Fetched Production `api` Edge Function v17 and candidate branch source.
- Re-read the exact RC465 orders-read migration and PostgreSQL integration fixture; confirmed tenant-wide OWNER/ADMIN and exact branch scope semantics, plus the business-scoped-branchless test case.
- Added five source assertions to `scripts/validate-rc497-business-reviews.mjs` for membership identity/tenant/status, tenant-wide role guard, exact business/branch match, default 403, and removal of the old broad role list.
- Manually evaluated six source assertions against the candidate route; all six passed.
- **Not yet verified:** execution of the combined Node validator, API Edge typecheck/build, HTTP/E2E authorization tests, and the overall CI workflows. No runtime test pass is claimed.

## Production and release
- Production API remains version 17; no Edge deployment or database mutation was performed.
- PR #971 remains open and unmerged.
- **PRODUCTION BLOCKED / NOT CERTIFIED.**
