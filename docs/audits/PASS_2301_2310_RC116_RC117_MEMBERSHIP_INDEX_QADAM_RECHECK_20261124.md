# Pass 2301–2310 — RC116/RC117 subscriber administration, default images and seed reconciliation

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Read-only PostgreSQL schema, index, function, trigger and aggregate seed checks.

## RC116 — Business subscriber administration

Expected source RPCs:
- `mnty_platform_admin_list_businesses(text)`
- `mnty_platform_admin_manage_business(uuid,text,jsonb,text)`
- `mnty_platform_admin_manage_membership(uuid,text,text)`

**Live result:** all three routines exist as SECURITY DEFINER, with empty search_path, anon EXECUTE=false, authenticated EXECUTE=true, and each function body directly references `private.platform_admins`.

**Disposition:** **PASS — source function contract present.** End-to-end platform authorization remains dependent on the registry/RLS root issue separately tracked in RC484: the general `public.is_platform_admin()` and MantiGO `mnty_can_platform_admin()` helpers are still legacy membership-derived functions.

## RC117 — Default images for activities, products and services

Expected source effects:
- Add `marketing_services.image_url` and `marketing_services.image_source`.
- Add `mnty_default_image_url(...)`.
- Add business, catalog-item and marketing-service image trigger functions.
- Attach three default-image triggers while preserving explicit user-selected media.

**Live result:**
- Neither `marketing_services.image_url` nor `image_source` is present.
- `mnty_default_image_url` is absent.
- All three trigger-function signatures are absent.
- All three expected triggers are absent.

**Disposition:** **BLOCKED — default-image behavior has not been deployed.** The live source does not show the name-aware fallback image pipeline from RC117.

## RC113 membership business-scope idempotency index

Expected null-safe uniqueness:
`ux_user_memberships_user_business_branch_nullsafe` on `(user_id, business_id, COALESCE(branch_id,''))` where business_id is not null.

**Live result:** index absent. The same missing prerequisite is also checked by the RC472 directory-claim atomic review source.

**Disposition:** **BLOCKED — null-branch business membership duplicates are not prevented by this source invariant.**

## Qadam Al-Saad homewares seed

Expected source seed is idempotent by tenant/business code and business/catalog legacy reference, without fabricated stock or orders.

**Live aggregate result:** business `MNTY-HOMEWARES-QADAM-ALSAAD` exists as ACTIVE under `MNTY-PLATFORM`, with 15 catalog items. No stock, orders or individual customer rows were selected.

**Disposition:** **PRESENT — seed entity and 15 catalog items exist.** The current ACTIVE state is recorded as live state; this audit does not infer whether a later operator activation changed the source's initial status.

## Summary

| Area | Live state |
|---|---|
| RC116 subscriber admin RPCs | Present, registry-backed, empty path |
| RC117 default image columns/helpers/triggers | All absent |
| RC113 null-safe membership uniqueness index | Absent |
| Qadam Al-Saad showcase business | Active, 15 catalog items |

No Production DDL, DML, RLS, ACL, Auth, Storage, order, stock, catalog pricing or business update was performed.

**Production mutation:** NONE.
