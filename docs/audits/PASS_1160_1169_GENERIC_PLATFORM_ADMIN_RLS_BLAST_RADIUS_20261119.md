# Pass 1160–1169 — Generic is_platform_admin RLS blast-radius audit

**Date:** 2026-11-19  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only live `pg_proc`, `pg_policies`, effective function/role inventory and aggregate membership/registry counts.  
**Production changes:** none.

## 1. Live helper

`public.is_platform_admin()` currently returns true when the current `auth.uid()` has any active `public.user_memberships` row with role ADMIN or SUPER_ADMIN. It does not consult the canonical `private.platform_admins` registry and does not require MNTY-PLATFORM tenant, business or branch scope.

This is different from the registry-backed platform-root helper intended by RC464/RC471.

## 2. RLS blast radius

The live catalog contains **57 policies across 24 tables** that call `is_platform_admin()` in `USING` or `WITH CHECK`.

Affected tables:

- Education/jobs: `education_requests`, `jobs`, `job_applications`
- Fashion: `fashion_orders`, `fashion_products`, `fashion_tailor_services`
- inDrive: `indrive_bids`, `indrive_requests`
- MantiGO: `mantigo_bids`, `mantigo_ride_ratings`, `mantigo_rides`
- Matrimony: `matrimony_contact_unlocks`, `matrimony_profiles`, `matrimony_requests`
- Platform config: `platform_feature_flags`
- Restaurant: `restaurant_inventory`, `restaurant_menu_items`, `restaurant_orders`, `restaurant_tables`
- Education profiles: `school_profiles`, `teacher_profiles`
- Used items: `used_item_ads`, `used_item_category_fees`
- Storage: `storage.objects`

## 3. Additional function callers

Read-only function-definition search found these additional callers:
- `create_notification_backend(...)`
- `deactivate_business(...)`
- `fashion_erp_mutate(...)`
- `restaurant_erp_mutate(...)`
- `restaurant_table_mutate(...)`
- `set_platform_feature_flag_backend(...)`
- `resolve_legacy_scope(...)`

Some are internal SECURITY DEFINER functions without direct client EXECUTE; their authorization still inherits the helper's semantics. Do not classify them as directly callable without checking each function's ACL.

## 4. Current active membership/registry counts

| Role | Active rows | Distinct active users | Active users absent from platform registry |
|---|---:|---:|---:|
| ADMIN | 1 | 1 | 0 |
| SUPER_ADMIN | 1 | 1 | 0 |
| BUSINESS_OWNER | 9 | 5 | 4 |
| OWNER | 3 | 1 | 0 |

No active non-registry ADMIN or SUPER_ADMIN was present in this aggregate snapshot. Therefore this is a **latent global bypass**, not evidence of current abuse or of a currently active non-registry administrator. If a tenant ADMIN/SUPER_ADMIN is added in future, this helper will return true for that user and bypass the row-scoped predicates in affected policies/callers.

## 5. Required remediation

1. Separate platform-root authority from tenant-local ADMIN/SUPER_ADMIN authority.
2. Use `private.platform_admins` only for actual platform-root access.
3. Replace each policy/caller according to its intended scope:
   - platform control: registry-backed helper;
   - tenant operations: explicit tenant/business/branch membership predicates;
   - public read: narrowly scoped public policy;
   - Storage: bucket/path/actor-specific policy.
4. Do not globally substitute the registry helper for every `is_platform_admin()` use; some paths need tenant-local manager/admin behavior.
5. Add disposable PostgreSQL adversarial tests for tenant ADMIN/SUPER_ADMIN, tenant OWNER/BUSINESS_OWNER, cross-tenant/business/branch attempts, registry-only platform admin, and normal tenant-local access preservation.
6. Pin all SECURITY DEFINER callers to empty search_path and preserve least-privilege ACLs.
7. Apply only after the exact 63-version migration chain and verified encrypted backup/restore/rollback gates.

P0 issue [#867](https://github.com/islamnagy2022-eng/MantiqatiX/issues/867) tracks the remediation. No live function was invoked, no user identifiers were selected, and no Production mutation was performed.

**Status:** P0 latent authorization bypass; full platform remains **BLOCKED / NOT CERTIFIED**.
