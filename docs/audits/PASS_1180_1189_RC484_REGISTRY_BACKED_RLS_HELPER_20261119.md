# Pass 1180–1189 — Registry-backed global RLS helper forward repair

**Date:** 2026-11-19  
**Base:** `1b118bf5db4dbc75d470018a1149dfe8b6e8d9a7`  
**Candidate:** PR #870 / `fix/rc484-registry-backed-is-platform-admin-20261119`  
**Production:** BLOCKED / NOT CERTIFIED. No Production writes.

## Work completed

- Reconfirmed the production helper's global predicate was based on any ACTIVE ADMIN/SUPER_ADMIN membership.
- Confirmed 57 dependent RLS policies across 24 tables, as recorded in P0 issue #867.
- Added RC484, a forward-only transactional migration changing only the global-root helper to query `private.platform_admins` using `auth.uid()`.
- Preserved tenant-local ownership and membership clauses in existing policies/callers; tenant admins continue to use their explicit tenant/business/branch predicates rather than gaining global access.
- Added fail-closed migration preflight for registry existence, UUID user_id, RLS + FORCE RLS, client table ACLs, owner/BYPASSRLS parity, and the audited policy/table blast radius.
- Added disposable PostgreSQL 17 fixture reproducing 57 helper-dependent policies over 24 tables and behavioral checks for tenant ADMIN denial, tenant SUPER_ADMIN denial, and registry-only platform-root access.
- Added dedicated CI workflow and updated both source and release-gate migration inventories from 63 to 64 required versions.

## CI state at checkpoint

- PR #870 is open and mergeable.
- Dedicated workflow `Platform Admin RLS Helper Registry Hardening` run #2 is in progress.
- The production-checkpoint forward migration replay and related migration collision/history workflows were queued.
- No test is marked PASS until the corresponding GitHub Actions run completes successfully.

## Production evidence and boundary

Read-only Production snapshot:
- Migration ledger: 310 rows through `20261110150618`.
- `private.platform_admins`: exists, one row.
- Active ADMIN and SUPER_ADMIN users: one each; none absent from the private registry in the latest aggregate.
- `public.is_platform_admin()` still uses generic membership logic.
- `public.mnty_can_platform_admin()` also remains on its older null-scope `mnty_can('admin',NULL,NULL,NULL)` definition.
- No live function was invoked. No DDL/DML, migration, RLS, GRANT, Auth, Storage, Edge, payment, wallet, settlement or user-data mutation occurred.

RC484 is source-only until CI, full ordered replay, backup/restore/rollback and the authorized Production release are complete. The live helper remains a release blocker until post-deployment read-back proves exact definition, ACL, search_path and policy behavior.
