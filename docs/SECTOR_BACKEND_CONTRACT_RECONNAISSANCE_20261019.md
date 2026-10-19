# Sector Backend Contract Reconnaissance — Read-only Production Snapshot

**Date:** 2026-10-19  
**Environment:** Supabase production project moyhiluyhjsujhwlyeuu  
**Purpose:** Identify existing contracts before connecting the new 27-sector UI.  
**Change scope:** Read-only catalog inspection only. No production rows, DDL, grants, RLS, Auth settings, Edge Functions, or migrations were changed.

## Executive result

The 27-sector frontend is not equivalent to 27 operational backend modules. The live schema currently exposes shared catalogs and a small number of reusable domain contracts. Several sectors have no dedicated table family visible in this inspection. Do not invent parallel tables or wire a generic CRUD interface directly to existing tables.

## Confirmed read-only observations

### Shared sector registry

- public.business_sectors exists with id, code, name_ar, name_en, and status.
- public.business_categories exists with id, sector_id, code, name_ar, name_en, and status.
- Both tables have RLS enabled and forced; authenticated SELECT privilege exists and anonymous SELECT privilege does not.
- Their observed policies include non-anonymous authenticated-session guards. This is a candidate for read-only registry integration, but exact row results and client-path E2E still need testing.

### Medical appointments (sensitive domain)

- public.medical_appointments exists with tenant/business/patient/doctor/time/status/reason fields.
- RLS is enabled and forced. Direct authenticated and anon SELECT table privileges are absent in the inspected privilege surface.
- Existing SECURITY DEFINER functions are present:
  - create_medical_appointment_backend(p_user_id uuid, p_appointment_id text, p_business_id uuid, p_doctor_id text, p_date_time bigint, p_reason text)
  - update_medical_appointment_status_backend(p_user_id uuid, p_appointment_id text, p_target_status text)
- The observed function ACL permits EXECUTE to authenticated (not anon); both functions check that the supplied user ID matches auth.uid(). Creation resolves an active provider/business and checks for an existing conflicting doctor/time slot. Status changes validate allowed target states and membership/role.
- This source inspection is not an E2E security certification. Before connecting UI, review the full function definitions and migration provenance, confirm the exact provider/business/branch authorization semantics, test overlapping appointment concurrency, and run negative cross-tenant and patient/provider authorization tests. Do not expose patient data in a generic sector dashboard.

### Orders and catalog

- public.orders, catalog_items, catalog_item_prices, and inventory_transactions exist.
- The inspected RLS flags are enabled and forced on the listed tables.
- orders has authenticated SELECT privilege and multiple membership/customer/provider policies; catalog_items did not show direct authenticated SELECT privilege in the privilege check. Do not assume that the browser can read a table simply because it exists.
- create_order_backend and update_order_status_backend exist as SECURITY DEFINER routines. The observed creation routine derives authoritative catalog prices and snapshots from catalog tables, checks business/tenant and branch association, and implements a client idempotency lookup. It is a contract to review, not permission to call it without matching the UI's payload and the current live ACL/migration state.

### Fashion and restaurant legacy surfaces

- fashion_products, fashion_orders, restaurant_menu_items, restaurant_orders, and restaurant_tables exist; RLS is enabled and forced, and authenticated SELECT is granted on the inspected tables.
- The current policy catalog contains ownership-oriented permissive policies and separate tenant/business/branch-scope boundary policies. PostgreSQL permissive policies combine with OR, while restrictive policies combine with AND against the permissive result; the policy's `permissive` mode therefore matters.
- **Correction from a read-only live `pg_policies` query on 2026-10-20:** `fashion_products_select` is PERMISSIVE and checks only that the JWT is not anonymous, but `legacy_scope_boundary` is explicitly RESTRICTIVE and requires an active membership matching the row's tenant, business, and branch (or platform-admin access). The restrictive policy therefore narrows the broad SELECT policy; the earlier statement that this boundary did not narrow reads was incorrect. `authenticated_sessions_only`, `mnt_non_anonymous_boundary`, and `non_anonymous_authenticated_guard` are also RESTRICTIVE guards. This is a policy-catalog observation, not cross-tenant E2E proof. The remaining work is to establish migration/source provenance for the live boundary and test private/draft versus intentionally public product visibility with separate tenants before connecting this table to new sector UI.
- Restaurant tables similarly have legacy owner/admin policies alongside scope policies. Existing restaurant mutation behavior is separately documented as not production-certified. Do not enable old RPCs or widen grants as a shortcut.

## Sector coverage decision

| Candidate | Current evidence | Safe next step |
|---|---|---|
| Sector/category directory | Shared registry exists; authenticated SELECT grant; RLS enabled/forced | Implement read-only catalog integration after exact route, loading/error, and anonymous-session tests |
| Clinics / medical | Shared appointments table and server RPCs exist; no direct authenticated table SELECT | Review function ACL/provenance and authorization, then isolated read path + negative E2E |
| Pharmacies / labs / radiology / dental / hospitals / veterinary | No dedicated table family confirmed by this targeted query | Continue schema/function inventory; do not map these to appointments/orders by guess |
| Retail / grocery | Catalog/pricing/orders/inventory contracts exist, but table grants and policies vary | Review canonical catalog RPCs and business/branch scope; no direct browser writes |
| Fashion | Live policy catalog shows restrictive tenant/business/branch boundary; source provenance and cross-tenant E2E remain open | Verify source provenance and public-vs-private catalog contract; run cross-tenant tests before integration |
| Restaurants / cafes | Legacy tables and scope policies exist; mutation path not certified | Keep new sector preview read/write-free until migration/RPC/grant review and E2E pass |
| Remaining sectors | No dedicated operational contract established by this targeted inspection | Keep preview-only; investigate each sector separately |

## Required checks before any sector is declared operational

1. Trace current production migration provenance for every table/function used; do not infer history from object names.
2. Inspect grants, RLS policies, SECURITY DEFINER body, search_path, and function EXECUTE ACL.
3. Define business/tenant/branch roles and public-vs-private record visibility.
4. Add isolated PostgreSQL tests for valid, invalid, replay/concurrent, and cross-tenant cases.
5. Run authenticated browser E2E with at least two distinct tenants/businesses and role-specific accounts.
6. Connect read paths first; sensitive writes only through approved server-authoritative RPC/Edge Function contracts.
7. Re-check the exact PR head CI and keep the global release gate BLOCKED until all independent P0 release gates pass.

## Important limitation

This is a targeted catalog snapshot, not a full schema audit, not a full SECURITY DEFINER review, not proof that the live database matches repository migrations, and not production certification. The new UI remains frontend-only; no live data has been fabricated or changed.
