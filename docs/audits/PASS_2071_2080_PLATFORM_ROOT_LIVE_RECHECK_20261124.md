# PASS 2071–2080 — Platform Root Live Recheck
**Date:** 2026-11-24  
**Environment:** MANTIQATIX FINAL — read-only PostgreSQL catalog query  
**Release candidate:** main `751367f7ea6a7290e5c62bbff5f1979ee456dc20`  
**Decision:** source/CI authorization repair passes in disposable PostgreSQL 17; Production authorization remains **BLOCKED / NOT CERTIFIED**.

## 1. Current Production facts

A fresh read-only query of PostgreSQL catalogs and the migration ledger returned:

| Object/check | Live Production result |
|---|---|
| Migration ledger | 310 rows |
| Latest recorded migration | `20261110150618` |
| `private.platform_admins` RLS | enabled |
| `private.platform_admins` FORCE RLS | **disabled** |
| `public.is_platform_admin()` | SECURITY INVOKER; `search_path=public`; not registry-backed |
| `public.mnty_can_platform_admin()` | SECURITY DEFINER; `search_path=public, pg_temp`; not registry-backed; still delegates to the legacy null-scope membership helper |
| RLS policies referencing `is_platform_admin()` | 57 |
| RLS policies referencing `mnty_can_platform_admin()` | 5 |

No user IDs, membership rows, customer records, secrets, payment events or business data were selected.

## 2. Source repair and isolated evidence

The repository already contains the forward-only source repair; no duplicate migration is required:

- RC464: `20261113214500_rc464_platform_admin_live_registry_hardening.sql` replaces `mnty_can_platform_admin()` with a registry-only lookup, pins empty `search_path`, applies FORCE RLS to the registry, checks owner/BYPASSRLS parity, and hardens the existing global MantiGO callers.
- RC471: `20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` reinforces the registry-only helper and hardens the four shared SECURITY DEFINER callers.
- RC484: `20261119040000_rc484_registry_backed_is_platform_admin.sql` replaces the second platform-root helper used by 57 policies across 24 tables.
- RC485: updates seven catalog RPCs to use registry-backed platform-root authorization while preserving tenant-local owner/admin/business/branch scope.
- RC923: adds direct Anonymous Auth-session denial to the three RC485 catalog RPCs that lacked it.

Exact-head CI on 2026-11-24 passed:
- RC464 platform-admin PostgreSQL 17 job.
- RC471 platform-admin PostgreSQL 17 job.
- RC484 registry/RLS PostgreSQL 17 job, including post-migration FORCE RLS and registry/helper owner/BYPASSRLS parity assertions.
- RC485/RC923 integration: all seven catalog RPCs reject Anonymous Auth sessions.
- Tenant A/B isolation tests.
- Full chronological disposable PostgreSQL 17 replay: **116 forward migrations passed** in timestamp order from the captured schema-only checkpoint; run [45393984396](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45393984396).

## 3. Why Production is still blocked

The successful replay proves that the checked-in forward chain can be applied in the disposable PostgreSQL 17 environment and that its included integration tests pass. It does **not** apply any migration to Production and is not a real backup restore.

The live read-only query still shows both helpers in their old state, FORCE RLS disabled, and all 62 policy references intact. Therefore:
- Do not deploy catalog-admin or other dependent Edge Functions individually.
- Do not hot-patch the two helpers or mass-rewrite the 57 policies.
- Do not fabricate migration ledger entries or blindly replay the chain on Production.
- Do not mark the P0 authorization gate closed based on CI alone.

## 4. Required next gates

1. Complete encrypted owner-controlled off-site database backup and separate Storage object export.
2. Verify backup hashes, retrieval, Auth identities, Storage bytes/metadata, Edge/config/extensions and Vault/key recovery.
3. Restore into an independent disposable PostgreSQL 17 environment and measure RPO/RTO; rehearse rollback.
4. Approve a single coordinated forward-only release bundle covering RC464/RC471/RC484/RC485/RC923 and dependent contracts.
5. Apply only in the approved controlled window, then re-read helper definitions, owner/ACL/search_path, FORCE RLS, all 57/5 policies, and the dependent Edge versions.
6. Run deployed-origin authorization and tenant-isolation smoke tests before marking the platform-root gate PASS.

**Production effect:** NONE. This pass used read-only catalog/ledger queries and existing GitHub Actions disposable CI only. No Production DDL/DML, migration, GRANT, RLS, Auth, Storage, Edge deployment, payment, settlement or business-data mutation occurred.
