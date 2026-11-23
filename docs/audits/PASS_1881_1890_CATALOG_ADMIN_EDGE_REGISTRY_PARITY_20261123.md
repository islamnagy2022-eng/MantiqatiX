# Pass 1881–1890 — Live catalog-admin Edge parity and platform-root boundary — 2026-11-23

## Live/source comparison
- [x] 1881 — Retrieved deployed `catalog-admin` Edge Function v20: ACTIVE, `verify_jwt=false`, source SHA-256 `7732207160cf91176d4478d101f85be8789b9eb1ce1b9cd56499994b0cf9ea2c`.
- [x] 1882 — Deployed v20 manually validates Bearer token with `auth.getUser` and rejects anonymous users; it then derives platform scope from ACTIVE `user_memberships` rows using role `SUPER_ADMIN`, null business/branch, and `permissions.scope=PLATFORM` + `full_control=true`. It does not call `mnty_can_platform_admin()`.
- [x] 1883 — Current main `supabase/functions/catalog-admin/index.ts` has a different registry path: calls `userClient.rpc('mnty_can_platform_admin')`; it no longer treats membership metadata alone as platform-root authority.
- [x] 1884 — Aggregate-only live query found one active membership satisfying the deployed v20 platform predicate, and that user is present in `private.platform_admins`; zero currently accepted users were outside the registry. No user IDs were selected.
- [x] 1885 — The live `mnty_can_platform_admin()` helper still delegates to null-scope `mnty_can('admin',NULL,NULL,NULL)`, which is broader than registry-only authority. Therefore deploying current-main Edge source v21 alone would still rely on a weak live database helper and could widen access.
- [x] 1886 — The live `catalog-admin` function has manual Auth verification despite `verify_jwt=false`; this setting alone is not a vulnerability. Its current issue is source-to-deployed authorization drift, not missing bearer validation.
- [x] 1887 — Current-main source comment and existing reconciliation record explicitly require coordinated database RC464/RC471 + catalog-admin Edge rollout; do not deploy either component alone.
- [x] 1888 — Verified live catalog-admin v20 and current main source differ in the platform-root authorization block. This is a confirmed deployment parity gap.
- [x] 1889 — No catalog-admin action was invoked, no business/membership rows were selected, and no Edge function was deployed.
- [x] 1890 — No Production DDL/DML, Auth/RLS/GRANT, Edge, payment, wallet, settlement or customer data was changed.

## Required coordinated release
1. Reconcile the exact 76-version migration chain and all preflight dependencies.
2. Apply RC464/RC471/RC484/RC485 in the approved chronological order, after independent PG17 replay and backup/restore gates.
3. Deploy the matching catalog-admin Edge bundle from the same main commit only after the registry helper is verified live.
4. Test platform-registry administrator positive case; tenant OWNER, tenant ADMIN, branch manager, inactive membership and non-registry SUPER_ADMIN negative cases; test tenant/business/branch boundaries.
5. Verify live Edge bundle hash/version and post-deployment read-only catalog/admin smoke tests.

**Disposition:** current v20 has no observed non-registry user satisfying its narrower legacy predicate in the aggregate snapshot, but it is not registry-authoritative. Current main source is not yet deployed. Keep platform-admin release gate **P0 / BLOCKED**.
