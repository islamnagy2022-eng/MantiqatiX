# PASS 2071–2080 — P0 Authorization and Catalog-RPC Live Recheck
**Date:** 2026-11-24  
**Repository head inspected:** `9e6b8e3e21cd338ce130bc2d6ee9de5051888ece`  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** read-only PostgreSQL catalog/function/policy/ACL queries; source inspection of RC464, RC471, RC484, RC485 and RC923; no business rows or secrets read.  
**Result:** **BLOCKED / NOT CERTIFIED.** Live authorization helpers and catalog RPC bodies remain behind current source.

## 1. Current Production authorization helpers

| Helper | Live definition | Dependents | Result |
|---|---|---:|---|
| `public.is_platform_admin()` | SECURITY INVOKER; `search_path=public`; checks active `user_memberships` roles ADMIN/SUPER_ADMIN; does not consult `private.platform_admins`. | 57 RLS policies across 24 tables. | **P0 BLOCKED.** Tenant admin roles still imply platform-wide RLS bypass in the live definition. |
| `public.mnty_can_platform_admin()` | SECURITY DEFINER; `search_path=public, pg_temp`; body calls `public.mnty_can('admin',NULL,NULL,NULL)`. | 5 RLS policies across 3 tables and 4 SECURITY DEFINER callers. | **P0 BLOCKED.** Null-scope generic admin permission is not a registry-only platform boundary. |

The four helper-dependent global SECURITY DEFINER callers are:
- `admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)`
- `fulfill_digital_page_publish(uuid,uuid,uuid)`
- `review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)`
- `set_mantigo_financial_config_backend(uuid,numeric,text)`

The protected registry exists and currently has RLS enabled, but FORCE RLS is **false**. Its owner is `postgres`. Prior read-only ACL checks confirm anon/authenticated have no direct registry table access.

## 2. Seven direct catalog RPCs: live anonymous-session guard and ACL

All seven signatures exist in Production, are SECURITY DEFINER, have `search_path=public`, deny direct `anon` EXECUTE, and allow `authenticated` EXECUTE. Four live function bodies already include an `auth.jwt()->>'is_anonymous'` guard; three do not.

| Catalog RPC | Live anonymous Auth guard | anon EXECUTE | authenticated EXECUTE | Live search_path |
|---|---|---:|---:|---|
| `adjust_catalog_stock_backend` | Present | false | true | public |
| `create_catalog_warehouse_backend` | Present | false | true | public |
| `upsert_catalog_item_backend` | **Missing** | false | true | public |
| `upsert_catalog_price_backend` | **Missing** | false | true | public |
| `upsert_catalog_settings_backend` | Present | false | true | public |
| `update_catalog_item_status_backend` | **Missing** | false | true | public |
| `upsert_catalog_business_profile_backend` | Present | false | true | public |

This is the precise live reason RC923 exists: direct EXECUTE is granted to the `authenticated` role, which also represents Anonymous Auth sessions, so a non-null `auth.uid()` alone is not an adequate boundary.

## 3. Source/test coverage already present

- RC464 provides the registry-backed `mnty_can_platform_admin()` helper and applies FORCE RLS to `private.platform_admins`; RC471 reasserts the helper and hardens its four SECURITY DEFINER callers and search paths.
- RC484 makes `is_platform_admin()` registry-backed for the 57-policy/24-table boundary.
- RC485 updates seven catalog RPCs to use the registry-backed `is_platform_admin()` helper and preserves tenant-local role checks.
- RC923 forward-replaces exactly three RC485 catalog RPC definitions lacking an anonymous-session guard: item upsert, price upsert and item-status update. It asserts RC485/RC486 prerequisites and leaves existing owner/EXECUTE ACLs unchanged.
- `supabase/tests/rc485_catalog_rpc_registry_root_integration.sql` runs as `authenticated` with `is_anonymous=true` and directly calls all seven catalog RPCs. It expects all seven calls to fail with their specific unauthenticated errors.
- `scripts/validate-rc485-catalog-rpc-registry-root.mjs` verifies all seven signatures, registry helper, empty search_path, tenant-local role path, exactly three RC923 overrides and seven anonymous-session denials.
- RC484 test-hardening PR #1040 merged. Its exact-head PostgreSQL 17 helper job passed (run `45390294342`), with explicit post-migration assertions for registry FORCE RLS and registry/helper owner parity with BYPASSRLS. This is disposable-test evidence only; Production remains unchanged.
- PR #1049 adds a missing negative case to the four RC471 helper callers: a tenant-scoped SUPER_ADMIN without a registry entry, plus a user with MNTY-PLATFORM membership but no registry row. The latest PR head at this checkpoint is `09ded548f2d7511b2dbad67b45a7da754413fef7`; its Actions checks were queued, so this regression is **NOT YET PASS** and must not be merged until exact-head CI passes.

## 4. Live migration identity status

| Check | Read-only result |
|---|---:|
| Live migration ledger rows | 310 |
| Latest live version | `20261110150618` |
| Current required source versions | 80 |
| Exact version identifiers found | 0 |

A zero exact-version intersection is an **identity mismatch**, not proof that all corresponding physical effects are absent. Preserve migration history. Before replay or release, classify each required migration as exact-present, exact-statement alias, effect-present under a different version, safe-to-replay, superseded/forward-fixed or blocked. No blind replay is permitted.

## 5. Safe execution order

1. Complete RC471 actor-matrix CI on exact PR #1049 head; merge only if every required job passes.
2. Complete full chronological 80-migration PostgreSQL 17 replay and all dependent integrations on exact head.
3. Finish the physical-object and alias crosswalk for Production before proposing any migration application.
4. Prepare one coordinated authorization migration release: RC464/RC471, RC484/RC485 and RC923, with post-deploy read-back for policy dependencies, helper owners, FORCE RLS, SECURITY DEFINER/search_path and ACLs.
5. Keep Production read-only until encrypted backup/restore and rollback are proven. Backup/restore remains the final stage as requested; it is still a hard launch gate.

**No Production DDL/DML, migration, GRANT, RLS, Auth, Storage, Edge deployment, payment, wallet, settlement, directory publication or business-data mutation occurred.**
