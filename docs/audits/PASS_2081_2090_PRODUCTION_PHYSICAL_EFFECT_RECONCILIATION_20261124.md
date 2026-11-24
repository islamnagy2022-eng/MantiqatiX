# PASS 2081–2090 — Production physical-effect recheck
**Date:** 2026-11-24  
**Project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** read-only PostgreSQL catalog queries against `pg_catalog`, `supabase_migrations.schema_migrations`, and function metadata. No application rows, customer data, secrets or credentials were read. No Production mutation was performed.

## 1. Migration ledger
- Live migration ledger: **310 rows**.
- Latest recorded version: `20261110150618`.
- RC923 `20261124121348`: **not applied**.
- The canonical manifest requires 80 exact release identifiers; 0/80 are recorded under their exact source versions. This does not prove all intended physical effects are absent; classify physical objects independently.

## 2. Platform-admin registry and helpers
| Object | Live state | Required hardened state |
|---|---|---|
| `private.platform_admins` | Exists; RLS enabled; FORCE RLS disabled; owner `postgres`; owner has BYPASSRLS | RLS + FORCE RLS; verified owner/BYPASSRLS and helper-owner parity |
| `public.is_platform_admin()` | SECURITY INVOKER; `search_path=public`; reads `user_memberships`; no `private.platform_admins` reference | Registry-backed root authority |
| `public.mnty_can_platform_admin()` | SECURITY DEFINER; `search_path=public, pg_temp`; delegates through `mnty_can`; no `private.platform_admins` reference | Registry-backed platform-root authority with hardened search path |

**Classification:** the registry table physically exists, but the current helper and FORCE RLS state do not match the RC464/RC471/RC484 release contract. Do not treat table existence as proof that platform-root authorization is fixed.

## 3. Seven catalog SECURITY DEFINER RPCs
All seven functions exist, are owned by `postgres`, are SECURITY DEFINER, use `search_path=public`, deny direct `anon EXECUTE`, allow `authenticated EXECUTE`, and reference `user_memberships` rather than the registry-backed `public.is_platform_admin()` helper.

| RPC | Anonymous-session guard | Other finding |
|---|---:|---|
| `adjust_catalog_stock_backend` | Present | Legacy membership authorization; `search_path=public` |
| `create_catalog_warehouse_backend` | Present | Legacy membership authorization; `search_path=public` |
| `upsert_catalog_item_backend` | **Missing** | Legacy membership authorization; `search_path=public` |
| `upsert_catalog_price_backend` | **Missing** | Legacy membership authorization; `search_path=public`; RC486 advisory lock absent |
| `upsert_catalog_settings_backend` | Present | Legacy membership authorization; `search_path=public` |
| `update_catalog_item_status_backend` | **Missing** | Legacy membership authorization; `search_path=public` |
| `upsert_catalog_business_profile_backend` | Present | Legacy membership authorization; `search_path=public` |

**Classification:** 4/7 already contain an anonymous-session guard; 3/7 require RC923. All 7 still require the RC485 registry-root and empty-search-path hardening. The price RPC also requires RC486's transaction advisory lock and unique-version invariant.

## 4. Directory consent and related surface
- `public.directory_listing_contact_consents`: **absent**.
- `public.marketing_provider_profiles`: RLS enabled and FORCE RLS enabled. This is only a table-level fact; policy expressions, column grants and anonymous-session behavior still require separate review.
- The directory endpoint remains fail-closed. No source/republication-rights evidence was found in the previous live audit.

## 5. What this proves — and what it does not
This targeted snapshot physically confirms the P0 blockers for platform-admin helpers, catalog RPCs, price serialization and directory consent. It does **not** classify every object created or changed by all 80 required migration identifiers. It does not justify replaying migrations against Production. A missing ledger ID may coexist with an equivalent physical effect under an alias; inspect every migration's intended objects before planning application.

## 6. Next actions
1. Complete the full 80-ID physical-effect matrix: tables/columns, functions/signatures, owners, `proconfig`, policies, grants, indexes, constraints and triggers.
2. Reconcile each item as exact-present, alias/effect-present, safe-to-replay, superseded/forward-fixed or blocked.
3. Keep all Production writes stopped until the final encrypted backup/Storage export, retrieval proof, independent restore and measured RPO/RTO gate passes.
4. Then request a controlled release window for the coordinated DB + Edge bundle; do not hot-patch one function or apply only the anchor migrations.

**Safety:** read-only inspection only. No Production DDL/DML, Auth, RLS, GRANT, Storage, Edge, payment, wallet, settlement or customer-data mutation.
