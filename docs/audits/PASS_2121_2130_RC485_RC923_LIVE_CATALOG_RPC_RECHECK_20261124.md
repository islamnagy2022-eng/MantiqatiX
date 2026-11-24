# PASS 2121–2130 — RC485 / RC923 live Production catalog RPC recheck

**Date:** 2026-11-24, approximately 19:15 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Repository main:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Method:** read-only PostgreSQL catalog and function-body inspection using `pg_proc`, `pg_namespace`, `pg_get_functiondef`, `pg_get_function_identity_arguments`, `has_function_privilege`, and registry table metadata. No application rows, customer records or secrets were read. No Production mutation was performed.

## 1. Migration and registry state

| Item | Live result |
|---|---|
| Migration ledger | 310 rows through `20261110150618` |
| RC464 / RC471 / RC484 / RC485 / RC486 / RC923 exact IDs | Absent from current required ledger snapshot |
| `private.platform_admins` | Exists; RLS enabled; FORCE RLS **disabled** |
| `public.is_platform_admin()` | SECURITY INVOKER; `search_path=public`; reads `user_memberships`, not the private registry |
| `public.mnty_can_platform_admin()` | SECURITY DEFINER; `search_path=public, pg_temp`; delegates to the legacy unscoped `mnty_can('admin', NULL, NULL, NULL)` path |

The registry table's existence is not evidence that the helpers or their callers use it. The live ownership and FORCE-RLS requirements from the source migrations are not satisfied.

## 2. Seven direct catalog RPCs

All seven functions are present, owned by `postgres`, SECURITY DEFINER, and configured with `search_path=public`. All deny direct `anon EXECUTE` and allow `authenticated EXECUTE`. The live function bodies still use tenant membership authorization and do not call the registry-backed `public.is_platform_admin()` helper.

| Function | Direct Anonymous Auth guard | Missing `is_anonymous` claim |
|---|---|---|
| `adjust_catalog_stock_backend` | Present | Allowed through by `COALESCE(..., 'false') = 'true'` pattern |
| `create_catalog_warehouse_backend` | Present | Allowed through by the same COALESCE pattern |
| `upsert_catalog_item_backend` | **Absent** | No direct claim check |
| `upsert_catalog_price_backend` | **Absent** | No direct claim check |
| `upsert_catalog_settings_backend` | Present | Allowed through by the same COALESCE pattern |
| `update_catalog_item_status_backend` | **Absent** | No direct claim check |
| `upsert_catalog_business_profile_backend` | Present | Allowed through by the same COALESCE pattern |

This classification distinguishes direct function-level identity checks from the later tenant-membership predicates in each function. The inspection does not claim that a caller without a matching membership can write data; it proves the intended direct security contract is not present in the live function definitions.

## 3. Required source contracts

- **RC464 / RC471:** registry-only platform-root guard, FORCE RLS on `private.platform_admins`, trusted owner/helper parity, and hardened shared MantiGO SECURITY DEFINER callers.
- **RC484:** registry-only `public.is_platform_admin()` helper for the 57-policy / 24-table blast radius.
- **RC485:** seven catalog RPCs must be SECURITY DEFINER with empty `search_path`, call the registry-backed root helper for global authority, retain tenant-local role/scope checks, deny anon EXECUTE and allow the intended authenticated path.
- **RC486:** price-write transaction advisory serialization and unique-version invariants must be present in `upsert_catalog_price_backend`.
- **RC923:** all seven RPCs must directly reject Anonymous Auth sessions; its preflight also requires RC485/RC486's helper, search-path and price-lock contracts.

The source migrations are ordered dependencies. Do not apply RC485 or RC923 independently of RC464 → RC471 → RC484 → RC485 → RC486 → RC923 and their compatible dependencies.

## 4. Isolated verification versus Production

- RC485 / RC923 static source and seven-function integration contract: passed in the 81-version forward replay, run `45466369023`.
- Exact 81-version gate and 117-migration chronological replay on disposable PostgreSQL 17: passed, run `45466369023`.
- This proves the source sequence applies and the isolated adversarial tests pass. It does not prove that the corresponding function bodies, policies, registry owner state, search paths or grants are present in Production.

## 5. Disposition and next actions

**Classification:** RC485/RC923 source sequence is merged and isolated-test-passing; Production remains on legacy function bodies.

1. Keep all direct Production writes stopped.
2. Complete the full 81-ID migration-to-physical-effect/alias crosswalk. At minimum, capture exact presence and definitions for the seven RPCs, both platform helpers, four shared MantiGO callers, relevant RLS policies, owner parity, FORCE RLS, and RC486 indexes/constraints.
3. Build one coordinated DB release dependency bundle; do not hot-patch individual SECURITY DEFINER functions.
4. Before any Production application, prove owner-controlled encrypted DB + Storage backup retrieval, Auth/Vault coverage, independent PostgreSQL 17 restore/rollback and measured RPO/RTO; obtain a controlled release approval.
5. After release, repeat the exact read-only catalog queries and deployed-origin adversarial checks for raw anon, Anonymous Auth, missing claim, confirmed tenant member, tenant SUPER_ADMIN without registry, registered platform root, cross-tenant/business/branch denial, plus RC486 concurrent price writes.

**Production impact:** read-only inspection only. No SQL mutation, migration, RLS, GRANT, Auth, Storage, Edge Function, payment, wallet, settlement or business-data change occurred. Full platform remains **BLOCKED / NOT CERTIFIED**.
