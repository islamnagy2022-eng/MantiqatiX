# Pass 2291–2300 — RC456/525, RC102–RC115 SMM, provider services, orders and Control Center

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Source comparison and read-only PostgreSQL grants, routines, RLS and policy checks. No Production writes.

## Migration-by-migration result

| Migration | Source contract | Live Production result | Status |
|---|---|---|---|
| RC456 SMM service-role access | Least-privilege service_role grants for SMM admins/providers/wallets, services/orders and order events; credentials and wallet transactions remain RPC-only | All expected service_role SELECT/INSERT/UPDATE grants are false on the SMM tables queried. Credentials and wallet transactions correctly have no direct service_role grants, but the intended Gateway table access is also absent. | **BLOCKED — SMM Edge gateway table access missing** |
| RC525 digital-page product platform scope | Replace broad product admin policy with MNTY-PLATFORM SUPER_ADMIN and explicit PLATFORM/full_control scope; retain public active-product SELECT | Old `digital_page_products_admin_write` remains. It authorizes active tenant membership with SUPER_ADMIN **or ADMIN**, without MNTY-PLATFORM tenant, explicit scope, or full_control. Public active-product read policy remains. | **P0 AUTHORIZATION DRIFT** |
| RC102 provider-service owner writes | Grant authenticated INSERT/UPDATE/DELETE only; RLS owner policy remains the authorization gate | All three authenticated write privileges are false. | **BLOCKED — provider-service UI writes cannot execute** |
| RC103 order status branch scope | Tenant-wide OWNER/ADMIN only when fully unscoped; all business-scoped roles match exact business and branch; customer own cancellation preserved | Live status RPC has no membership branch predicate/variable. OWNER/ADMIN are treated as tenant-wide without requiring both business_id and branch_id NULL. Other staff scope uses business_id only. | **P0 SCOPE DRIFT** |
| RC104 order idempotency scope | Existing idempotency replay must belong to the same customer and seller/business/branch scope | Live lookup is keyed by tenant_id + client idempotency key and returns the existing order without comparing customer_id, business_id or branch_id. Row lock exists, but replay-scope mismatch guard is absent. | **P0 CROSS-CUSTOMER REPLAY RISK** |
| RC105 order-create service-role identity | Verified Edge bearer token + service-role client may invoke the backend; all non-service-role callers must bind auth.uid() to customer | Live body unconditionally requires `auth.uid() = p_customer_id`; no `auth.role()='service_role'` branch exists. EXECUTE is service_role-only. | **BLOCKED — service-role Edge path contract absent** |
| RC106 order-status service-role identity | Verified Edge path may act as the verified p_user_id through service_role; all other callers remain auth.uid-bound | Live body always requires `p_user_id = auth.uid()`; no service_role exception branch. EXECUTE is service_role-only. | **BLOCKED — service-role Edge path contract absent** |
| RC113 Control Center foundation | Custom role definitions, scoped role assignments, unique active assignment and RPC-only access | Both tables and all six expected indexes exist. RLS and FORCE RLS are enabled; direct anon/authenticated table grants are absent. Three custom-role RPCs exist, SECURITY DEFINER, empty search_path, anon denied, authenticated EXECUTE and private registry reference. | **PASS — database foundation present** |
| RC114 business employee hiring | Business job positions/employees, scoped indexes and owner/admin RPCs | Both tables and all four expected indexes exist. RLS and FORCE RLS are enabled; direct client table grants are absent. Position-upsert, employee-upsert and employee-list RPCs exist; mutation RPCs use empty search_path and confirmed-auth check. | **PASS — core schema and RPCs present** |
| RC115 Control Center integration | Scoped permission resolution, user/role/audit lists and employee operations; registry-backed platform authority | Platform people, assignments, audit, permission and role-management RPCs exist, empty path, anon denied and authenticated EXECUTE; the platform-wide functions reference `private.platform_admins`. Business employee RPCs are separately scoped. | **PASS WITH DEPENDENCY — function layer exists, but depends on the root registry which remains incorrectly implemented by RC484** |

## Important detail on order processing

### RC103 / RC106 branch authorization
The live `update_order_status_backend(uuid,varchar,uuid,varchar,text)`:
- Locks the order row.
- Preserves customer cancellation and the payment-success cancellation guard.
- Checks tenant and business membership.
- Does not read or compare `user_memberships.branch_id` with `orders.branch_id`.
- Treats OWNER/ADMIN as scope-valid without verifying their membership is fully unscoped.

This is materially weaker than RC103's exact branch contract. RC106's trusted service-role identity branch is also absent.

### RC104 replay scope
The live `create_order_backend(...)` selects an existing order by:
`tenant_id = p_tenant_id AND client_idempotency_key = trim(p_client_idempotency_key)`, then returns that order's ID/status/amount/currency/pricing snapshot. It does not compare the existing order's customer, business or branch to the current request. The existence of a row lock does not replace the missing ownership/seller-scope comparison.

### RC105 service-role caller
The live function has service_role EXECUTE but requires `auth.uid() = p_customer_id` unconditionally. The RC105 source explicitly allows service_role when the Edge Function has already verified the bearer with `auth.getUser(token)`. That source-level branch is missing from the deployed function body.

## Control Center / subscriber management / default images

- RC113 custom role and assignment tables are present with forced RLS and no direct table grants; the source's restricted SECURITY DEFINER RPC model is present.
- RC114 employee position and employee tables are present, forced-RLS protected and accessible through authenticated RPCs rather than raw table grants.
- RC115/RC116 platform-wide functions use direct `private.platform_admins` checks, empty search_path, and authenticated-only EXECUTE. They cannot be certified end-to-end while `public.is_platform_admin()` / `mnty_can_platform_admin()` still use the legacy membership-derived bodies in live Production.
- RC117 is absent: neither `marketing_services.image_url` nor `image_source` exists; none of the four default-image functions and none of the three expected triggers exists. The 76-object register also previously found the default-image helper absent.
- The null-safe user/business/branch membership unique index `ux_user_memberships_user_business_branch_nullsafe` remains absent.
- The Qadam Al-Saad homewares seed is present: one ACTIVE business with code `MNTY-HOMEWARES-QADAM-ALSAAD` and 15 catalog items. This confirms seed presence only; no product detail rows were read.

## Release disposition

- Keep SMM Gateway, digital-page product administration, provider-service writes and order create/status flows blocked until least-privilege grants, registry authorization, replay scope and service-role identity are repaired.
- Preserve the Control Center and employee tables' forced-RLS/RPC-only design; fix the global registry helper before certifying platform-wide operations.
- Do not recreate RC117 columns/functions/triggers directly in Production; restore through the ordered release after dependency and rollback checks.
- No Production schema, ACL, policy, Auth, Storage, order, employee, product or business data was changed.

**Production mutation:** NONE.
