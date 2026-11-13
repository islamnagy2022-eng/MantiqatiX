# Settlement Financial Atomic — Authorization Scope Review

**Checkpoint:** 2026-11-13  
**Status:** Local candidate / PR review required / not deployed

## Verified production contract (read-only)

- `public.create_settlement_and_post_journal(...)` is `SECURITY DEFINER` and its live EXECUTE privilege is limited to `service_role` and `postgres`. `anon` and `authenticated` cannot call the database function directly.
- `supabase/functions/settlement-financial-atomic/index.ts` verifies the bearer token with `auth.getUser()` and rejects `user.is_anonymous`.
- The Edge Function then uses the service-role client to call `create_settlement_and_post_journal`, passing `user.id` as `p_actor_user_id`.
- The live database function checks for an ACTIVE membership for `p_actor_user_id` and `p_tenant_id`, then accepts roles `ADMIN`, `SUPER_ADMIN`, `OWNER`, `BUSINESS_OWNER`, `ACCOUNTANT`, `FINANCE_MANAGER`, or `FINANCE`. That predicate does not compare the membership `business_id` with `p_business_id`, does not compare `branch_id`, and selects the first matching membership by creation time.
- The connected production `MNTY-PLATFORM` tenant contains active `BUSINESS_OWNER` memberships scoped to individual businesses and an unscoped `ADMIN` membership. Therefore tenant-level role membership alone is not an adequate authorization check for a business-scoped settlement request.

This is a verified authorization-scope gap in the current source/database contract. It is not a claim that an unauthorized settlement was successfully executed. No live settlement was attempted and no financial rows were changed.

## Candidate fix

The candidate changes only the Edge Function and adds a pure authorization module:

1. Continue verifying the bearer token with Supabase Auth and reject anonymous users.
2. Read ACTIVE membership rows for the verified user and the exact requested tenant only.
3. For a business-scoped settlement, require an ACTIVE, unbranched finance-capable membership whose `business_id` exactly equals the requested business. Also require that business to be ACTIVE and belong to the requested tenant.
4. Reject branch-scoped memberships because the current settlement RPC has no `branch_id` argument and therefore cannot safely enforce branch accounting scope.
5. For a tenant-wide `MNTY-PLATFORM` settlement, require the exact ACTIVE `SUPER_ADMIN` membership with `business_id IS NULL`, `branch_id IS NULL`, `permissions.scope=PLATFORM`, and `permissions.full_control=true`. Generic `ADMIN` or `OWNER` memberships are not treated as platform administrators.
6. For other tenant-wide settlement requests, require an unscoped ACTIVE finance/tenant-owner membership. A business-level membership cannot authorize tenant-wide activity.
7. Require `businessId` for MERCHANT settlements, validate numeric input, and return sanitized error codes rather than raw database messages.
8. The actor ID passed to the service-role RPC remains derived solely from the verified Auth user.
9. Merchant settlements require an explicit business scope. The source contract still needs a separate review to verify that each beneficiary ID belongs to the requested business; the current `settlement_transactions` table has no foreign key tying `beneficiary_id` to `business_id`, so this is retained as a pre-release contract check rather than assumed safe.

## Local tests

`supabase/functions/settlement-financial-atomic/authorization.test.mjs` covers:

- business owner can settle only the exact assigned business;
- business membership cannot authorize tenant-wide settlement;
- branch-scoped membership fails closed until branch-aware settlement exists;
- inactive and cross-tenant memberships fail;
- tenant-level finance access requires an unscoped membership;
- MNTY-PLATFORM global settlement requires scoped full-control Super Admin;
- a platform Super Admin can perform a scoped settlement in the platform tenant;
- malformed or absent membership data fails closed;
- source contract uses verified user identity and performs scope authorization before the privileged RPC.

Local Node result: **9/9 PASS**.

## Remaining validation before merge/deployment

- Run Deno type/check for the Edge Function in CI.
- Run isolated integration tests with disposable users and two businesses: exact business allowed; other business denied; tenant-wide from business owner denied; inactive membership denied; branch-only accountant denied; platform unscoped ADMIN denied; platform full-control Super Admin allowed.
- Confirm the live caller payload contract for `businessId` and merchant/partner settlement paths.
- Confirm that existing legitimate tenant-wide settlement workflows are represented by unscoped finance memberships and are not branch-only workflows.
- Define and test the beneficiary-to-business ownership contract for both `PARTNER` and `MERCHANT` settlements before treating the entire settlement module as launch-ready.

`PRODUCTION_CHANGED=false` · `SUPABASE_WRITES=false` · `EDGE_DEPLOYED=false` · `MAIN_CHANGED=false`.
