# Pass 1180–1189 — Registry-backed global RLS helper forward repair

**Date:** 2026-11-19  
**Base:** `1b118bf5db4dbc75d470018a1149dfe8b6e8d9a7`  
**Merged PR:** [#870](https://github.com/islamnagy2022-eng/MantiqaTix/pull/870)  
**Merge commit:** `902e4059c76da7b5da3c6ca354a11eefdd36ed4f`  
**Production:** BLOCKED / NOT CERTIFIED. No Production writes.

## Work completed

- Reconfirmed that live `public.is_platform_admin()` treated any active `ADMIN` or `SUPER_ADMIN` membership as global platform authority.
- Confirmed the live blast radius: **57 RLS policies across 24 tables**, all assigned to `authenticated`.
- Added RC484, a forward-only transactional migration changing only the global-root helper to query `private.platform_admins` using `auth.uid()`.
- Preserved tenant-local ownership and membership predicates. Tenant ADMIN/SUPER_ADMIN users do not gain cross-tenant access through the global helper.
- Added fail-closed preflight for registry existence, UUID `user_id`, enabled RLS, client-role ACLs, helper/registry owner parity, owner `BYPASSRLS`, and the audited policy/table blast radius. The migration enables FORCE RLS before replacing the helper.
- The replacement helper is SECURITY DEFINER with an empty `search_path`; EXECUTE is granted to `authenticated` and revoked from PUBLIC, anon and service_role.
- Preserved the existing trusted `service_role` registry table operations; RC484 does not revoke that server-side boundary.
- Added a disposable PostgreSQL 17 fixture reproducing 57 helper-dependent policies over 24 tables. Adversarial tests deny global access to tenant ADMIN and tenant SUPER_ADMIN, while preserving global access for the registry-only platform administrator.
- Added a dedicated CI workflow, test-only overlay for the one live Storage policy omitted from the captured schema checkpoint, and updated the source/release migration inventories from 63 to **64** required versions.

## Exact PR-head CI — all passed

- [Platform Admin RLS Helper Registry Hardening](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44598309128) — PASS. Disposable PostgreSQL 17 fixture, RC484 migration and adversarial RLS tests passed.
- [Forward Migration Chain Replay from Production Schema Checkpoint](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44598309101) — PASS. The isolated checkpoint replay applied **99** later migrations in timestamp order; the RC484 Storage policy overlay and tenant-isolation/regression tests passed.
- [Deploy MantiqatiX Web validation](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44598309226) — PASS. Catalog/V6 builds, public-bundle checks, OAuth/CORS and deployed-origin smoke tests, and desktop/mobile V6 Preview validation passed. This PR validation is not a claim of a Production deployment.
- [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/44598309231) — PASS. All nine jobs passed, including RC471, RC479–RC483 and the associated PostgreSQL integrations.
- Migration version uniqueness/history immutability, open-PR collision guard, directory consent/claim, MantiGO privacy, Paymob atomicity, backend-only module boundary, approval audit and SMM contract workflows all passed on the exact PR head.

The PR was squash-merged as `902e4059c76da7b5da3c6ca354a11eefdd36ed4f`. The connector did not return separate status rows for the post-merge main commit; therefore this record claims exact PR-head CI, not independently verified main-triggered CI.

## Fresh read-only Production recheck after merge

- Migration ledger: **310 rows**, latest version `20261110150618`.
- RC471 (`20261117190000`), RC482 (`20261119020000`), RC483 (`20261119030000`) and RC484 (`20261119040000`) are not recorded in the live ledger.
- `private.platform_admins` exists with one row; RLS is enabled, but FORCE RLS is still false.
- Live `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public`; the source migration has not been applied.
- The live helper still has 57 dependent policies across 24 tables. No live policy or function behavior is certified as repaired by a source merge.
- The latest aggregate role snapshot showed one active ADMIN user and one active SUPER_ADMIN user, neither outside the registry. This does not remove the latent bypass for future tenant-admin assignments.

## Production boundary

No Production migration, DDL/DML, RLS, GRANT, Auth, Storage, Edge Function, payment, wallet, settlement or user-data mutation occurred. RC484 is **source-merged but not Production-applied**. The full platform remains **BLOCKED / NOT CERTIFIED**.

Do not apply RC484 by itself or infer that the successful disposable replay is a safe Production rollout. The release remains gated on the exact ordered 64-version migration chain, encrypted off-site backup, isolated restore rehearsal, measured RPO/RTO, rollback evidence, Edge/source parity, and an approved Production release window.

## Next actions

1. Keep Production read-only while the full live schema/ledger/Edge parity reconciliation is completed.
2. Obtain and verify encrypted off-site backup and isolated restore/rollback evidence.
3. Run the approved ordered migration release only after the release owner authorizes it.
4. After deployment, read back the helper definition, SECURITY DEFINER flag, empty search_path, ACLs, FORCE-RLS state and all 57 dependent policy outcomes; test tenant ADMIN/SUPER_ADMIN cross-tenant denial and registry-only root access.
5. Keep P0 issue #867 open until those live post-deployment checks pass.
