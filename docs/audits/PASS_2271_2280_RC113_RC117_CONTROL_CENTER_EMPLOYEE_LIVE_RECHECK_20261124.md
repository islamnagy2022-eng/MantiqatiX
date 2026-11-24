# PASS 2271–2280 — RC113–RC117 Control Center, employee and default-image live recheck

**Date:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** Mainline source review and read-only PostgreSQL catalog, RLS, policy, index, function owner/search_path and effective ACL checks. No Production writes.

## Migration-by-migration result

| Migration | Required source contract | Live Production evidence | Status |
|---|---|---|---|
| RC113 — Super Admin Control Center foundation | `platform_custom_roles`, `platform_role_assignments`; active/scope indexes; three registry-backed platform role RPCs | Both tables exist with RLS ON and FORCE RLS ON; no direct anon/authenticated/service_role table privileges and no table policies. Both indexes exist and are valid. All three exact RPCs exist as SECURITY DEFINER, owner postgres, empty search_path, anon EXECUTE=false, authenticated=true, service_role=false; each source body references `private.platform_admins`. | **PASS for sampled RC113 base/table/index/RPC metadata; null-safe membership index is a later forward blocker.** |
| RC114 — Business employee hiring | `business_job_positions`, `business_employees`; four indexes; position and employee upsert RPCs | Both tables exist with RLS+FORCE RLS, no direct client/service-role table grants and no policies. All four indexes are present and valid, including the partial unique lower(email) per business. Both exact RPCs exist as SECURITY DEFINER, owner postgres, empty search_path, anon=false/authenticated=true/service_role=false. | **PASS for sampled RC114 schema/index/ACL metadata. Runtime business-member authorization remains a separate E2E gate.** |
| RC115 — Control Center integration | Scoped permission resolver, admin people/role/audit RPCs, and employee list/upsert integration | `mnty_platform_has_permission`, list-people, list-role-assignments, list-audit and business-employee-list signatures exist. They are SECURITY DEFINER, owner postgres, empty search_path, anon=false/authenticated=true/service_role=false. The four platform-admin RPCs reference the private registry; employee list is business-member scoped rather than platform-root. | **PASS for sampled RC115 function metadata; caller/permission matrix still needs runtime tests.** |
| RC116 — Business subscriber admin | list/manage business and manage membership RPCs; protected platform memberships | All three exact signatures exist as SECURITY DEFINER, owner postgres, empty search_path, anon=false/authenticated=true/service_role=false. Each live body references `private.platform_admins`. | **PASS for sampled RC116 function metadata; live global root still depends on the separate RC484 repair.** |
| RC117 — Default images and activity admin | `mnty_default_image_url`, three trigger functions and attached triggers; marketing-service image columns; preserve owner-selected images | `mnty_default_image_url(text,text,text,text)` and all three trigger functions are absent. Triggers `mnty_business_default_images`, `mnty_catalog_item_default_image`, and `mnty_marketing_service_default_image` are absent from their respective tables. `marketing_services.image_url` and `image_source` columns are absent. Business and catalog image metadata in the source is stored inside JSON `settings`/`metadata`; those are not separate SQL columns. | **BLOCKED — RC117 default-image automation is not installed.** |
| RC113 forward idempotency index — `20261027090000` | `ux_user_memberships_user_business_branch_nullsafe` unique index for NULL-safe business-wide memberships | Exact index is absent. | **BLOCKED — NULL-safe membership idempotency invariant not installed.** |

## Physical inventory

**Tables (4/4 present):**
- `public.platform_custom_roles`
- `public.platform_role_assignments`
- `public.business_job_positions`
- `public.business_employees`

All four currently have `relrowsecurity=true` and `relforcerowsecurity=true`. Effective SELECT/INSERT/UPDATE/DELETE table privileges are false for anon, authenticated and service_role. No RLS policies are defined on these four tables; access is mediated through the SECURITY DEFINER RPCs. This is intentional only while the verified RPC path and caller authorization remain intact.

**Indexes (6/7 present and valid):**

| Index | Present | Unique | Valid |
|---|---:|---:|---:|
| `platform_role_assignments_active_unique` | Yes | Yes | Yes |
| `platform_role_assignments_user_scope_idx` | Yes | No | Yes |
| `business_employees_email_per_business_unique` | Yes | Yes | Yes |
| `business_job_positions_business_active_idx` | Yes | No | Yes |
| `business_employees_business_status_idx` | Yes | No | Yes |
| `business_employees_user_active_idx` | Yes | No | Yes |
| `ux_user_memberships_user_business_branch_nullsafe` | **No** | — | — |

**Function inventory (13/13 expected RPC signatures present):**
- 13/13 SECURITY DEFINER, owner postgres, empty function-level search_path.
- 13/13 anon EXECUTE=false.
- 13/13 authenticated EXECUTE=true.
- 13/13 service_role EXECUTE=false.
- Ten platform-administration RPCs in this sample reference `private.platform_admins`; the two employee-upsert RPCs and business-employee list use their own scoped business-member checks.
- This is metadata and source/body-reference evidence; it does not certify the live `public.is_platform_admin()` global root, which remains blocked by RC484 (FORCE RLS false and membership-derived SECURITY INVOKER helper).

## Release disposition

- RC113–RC116 are materially present for the sampled schema, index, function, owner, path and ACL contracts. Keep full feature certification dependent on exact-head PostgreSQL tests, caller-role matrix and deployed-origin E2E.
- RC113's forward NULL-safe membership index remains absent. Do not infer the whole membership idempotency chain from the existing role-assignment indexes.
- RC117 is not installed: default-image RPC, trigger functions, triggers and marketing-service image columns are all absent. The current UI must not assume automatic image defaults are active.
- No Production DDL/DML, ACL, RLS, Auth, Storage, image URL, business, employee, membership or catalog data was changed.

**Production mutation:** NONE.
