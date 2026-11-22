# Pass 2011–2020 — API order-read authorization parity with RC465

**Date:** 2026-11-22  
**Area:** Legacy API order GET scope and policy drift prevention  
**Branch:** `feat/li2lak-verified-business-reviews-rebased-20261122`

## Change
Extended `scripts/validate-rc497-business-reviews.mjs` so the candidate `GET /api/v1/orders/:id` authorization route is checked against the established RC465 database policy:
- the operational role list must align with RC465 (`OWNER`, `ADMIN`, `BUSINESS_OWNER`, `MANAGER`, `STAFF`, `EMPLOYEE`, `FINANCE`, `ACCOUNTANT`, `FINANCE_MANAGER`);
- `CASHIER` and `DELIVERY_PARTNER` do not regain unscoped order-member access;
- tenant-wide access requires unscoped OWNER/ADMIN;
- scoped membership requires exact business and branch;
- assignment remains tied to the exact order's `assigned_partner_id`;
- SERVICE_PROVIDER remains limited to its own business and the permitted branch rule.

## Verification
- Re-fetched candidate API source, RC465 migration policy and updated validator.
- Manually evaluated 18 source invariants covering policy presence, all nine roles, excluded roles, tenant-wide guard, exact branch, exact assignment, provider scope and validator presence. **18/18 passed.**
- The full Node validator, TypeScript/Deno build and API runtime authorization tests have not yet executed; no runtime test pass is claimed.

## Release
- Validator-only change on PR #971; no Production or Android changes.
- PR remains open/unmerged. **PRODUCTION BLOCKED / NOT CERTIFIED.**
