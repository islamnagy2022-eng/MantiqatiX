# RC501 — Platform Admin SECURITY DEFINER Caller Search Path

**Date:** 2026-11-24  
**State:** SOURCE-ONLY / CI PENDING / PRODUCTION NOT CHANGED  
**Target project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`

## Live read-only finding

The registry-backed `public.is_platform_admin()` source replacement is RC484 and must be applied first. A fresh live catalog inspection found seven additional `SECURITY DEFINER` functions still configured with `search_path=public` and calling the helper through the schema-qualified name:

1. `public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)`
2. `public.deactivate_business(uuid,text)`
3. `public.fashion_erp_mutate(text,jsonb,text)`
4. `public.resolve_legacy_scope(text)`
5. `public.restaurant_erp_mutate(text,jsonb,text)`
6. `public.restaurant_table_mutate(text,jsonb,text)`
7. `public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)`

At the read-only checkpoint all seven were owned by `postgres`; their direct EXECUTE privileges were false for `anon`, `authenticated` and `service_role`. The helper and registry owner matched. The function bodies use schema-qualified public/auth references; the only planned function property change is `proconfig.search_path`.

## RC501 source change

Migration: `20261124150000_rc501_is_platform_admin_caller_search_path.sql`.

The migration:
- refuses to run unless RC484's registry-backed SECURITY DEFINER helper, empty helper search_path, FORCE RLS registry and owner/BYPASSRLS boundary are present;
- requires all seven exact function signatures to still be SECURITY DEFINER, registry-helper callers and `search_path=public`;
- snapshots function source, owner, ACL, SECURITY DEFINER flag, argument identity, return type, language and execution metadata;
- sets only `search_path TO ''` on the seven functions;
- verifies all snapshotted metadata is unchanged except the intended search_path setting.

RC497–RC499 remain reserved for the separate Li2Lak/order feature branch; RC501 uses a distinct timestamp and is not a replacement for those migrations.

## Validation and Production boundary

A disposable PostgreSQL 17 fixture/integration and static validator cover:
- registered platform-root allow and tenant ADMIN without registry deny;
- all seven callers work with the empty search_path in the disposable fixture;
- function owner, body, SECURITY DEFINER and ACL preservation;
- no direct anon/authenticated/service_role EXECUTE grants added.

The exact-head CI and full 81-version chronological replay must pass before source acceptance. The live ledger remains 310 rows through `20261110150618`; RC501 is absent and remains unapplied. No Production DDL/DML, ACL, RLS, Auth, Storage, Edge, payment or business-data write occurred.
