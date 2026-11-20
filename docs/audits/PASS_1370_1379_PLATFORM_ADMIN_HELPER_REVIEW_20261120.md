# Pass 1370–1379 — Platform-admin helper authorization review

**Date:** 2026-11-20  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only `pg_proc` definitions, function privilege checks, and SECURITY DEFINER caller enumeration. No application rows selected. No function invoked. No Production mutation.

## Finding

The live helper `public.mnty_can_platform_admin()` is not registry-backed. Its body is:

```sql
select public.mnty_can('admin',null,null,null)
```

The live `public.mnty_can(text, character varying, uuid, character varying)` function resolves active memberships through `public.mnty_active_membership(NULL,NULL,NULL)`. Its role mapping explicitly treats tenant `OWNER` and tenant `ADMIN` as satisfying permission key `admin`. Because the helper passes NULL for tenant, business, and branch scope, the decision is not anchored to a specific tenant or the protected `private.platform_admins` registry.

The helper is `SECURITY DEFINER`, uses `search_path=public, pg_temp`, and is executable by `authenticated` (not `anon`).

## Authenticated SECURITY DEFINER callers

Read-only catalog enumeration found four authenticated-callable SECURITY DEFINER functions whose definitions call this helper:

1. `admin_create_global_ad` — creates platform-wide advertisements.
2. `fulfill_digital_page_publish` — performs paid digital-page fulfillment and also checks order payment, page ownership, page type, and business scope.
3. `review_mantigo_captain_application` — approves, rejects, or suspends MantiGO captain applications.
4. `set_mantigo_financial_config_backend` — manages MantiGO financial configuration.

Each listed caller is executable by `authenticated`; none was invoked. The exact blast radius of each operation depends on its remaining in-function validations, but the shared global-admin predicate is broader than the protected platform-root registry and can admit tenant-local OWNER/ADMIN roles.

## Relation to existing RC484 work

Existing P0 Issue #867 covers the separate `public.is_platform_admin()` helper and its 57 RLS-policy dependencies. RC484 source replaces that helper with registry-backed authority and enables FORCE RLS on `private.platform_admins`, but the reviewed live `mnty_can_platform_admin()` definition remains the membership-derived expression above. The four direct callers therefore need explicit coverage in the same coordinated authorization remediation; passing RC484 tests alone must not be treated as proof that this second helper is fixed.

A comment with the additional finding and exact four callers was added to Issue #867 (comment ID 7045989396).

## Required correction and acceptance

- Make platform-root authorization depend on `private.platform_admins` or a reviewed registry-backed helper, not generic tenant membership.
- Preserve tenant-local OWNER/ADMIN permissions in tenant-scoped endpoints; do not globally replace every admin predicate with platform-root authority.
- Review all four callers and any transitive helper paths, including the additional payment/page/business checks in digital-page fulfillment.
- Add disposable PostgreSQL adversarial tests proving:
  - tenant OWNER and tenant ADMIN outside the registry are denied platform-wide ad creation;
  - tenant OWNER and tenant ADMIN outside the registry cannot review global captain applications or change platform financial configuration;
  - registry-only platform admins retain intended platform-wide operations;
  - tenant-local managers retain only their own tenant/business/branch permissions;
  - paid digital-page fulfillment still enforces payment, owner, page-type, and business-scope invariants.
- Pin SECURITY DEFINER search paths to `''` where feasible and schema-qualify object references.
- Include this helper and all callers in the full ordered migration/Edge release reconciliation. No hot edit or isolated production deployment.

## Disposition

**Confirmed source/live authorization defect; exploit not demonstrated.** The current live definition and effective EXECUTE grants were inspected read-only. No user, membership, payment, ride, advertisement, or financial rows were queried. No function was invoked. No Production schema, data, grants, RLS, Auth, Storage, Edge Function, or deployment change was made.

Production remains **BLOCKED / NOT CERTIFIED** pending the coordinated authorization, migration, Edge, backup/restore, and payment release gates.
