# Pass 876–883 — MantiGO global RPC authorization and Production parity

**Date:** 2026-11-19  
**Environment:** Supabase Production read-only; GitHub source-only audit  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Production writes:** NONE

## Executive result

The live Production database still exposes four authenticated SECURITY DEFINER MantiGO operations whose authorization predicate is based on generic active tenant membership roles rather than canonical platform-admin registry membership. Their role gates are not equivalent to platform-root authority.

A fresh aggregate-only query found **5 active users** matching each of the two relevant role sets and **4 of those users outside `private.platform_admins`**. The query returned counts only; no user identifiers or contact data were selected. This establishes that non-registry actors exist who satisfy the role portion of the live predicates. It does not establish that any actor invoked the operations or that every call would pass the remaining row/state checks.

The correct source repairs already exist in RC464/RC471, including regression coverage. The blocker is Production/source parity and the controlled release prerequisites, not the absence of a source fix.

## 1. Exact live function findings

All five listed functions are `SECURITY DEFINER`, owned by `postgres`, and currently executable by `authenticated` but not `anon`. None grants `service_role` EXECUTE. Production definitions were read directly from `pg_proc`; no function was invoked.

| Function | Live authorization currently observed | Impact if role predicate is satisfied |
|---|---|---|
| `get_mantigo_admin_dashboard_backend(uuid)` | Binds supplied admin ID to `auth.uid()`, then accepts active `ADMIN/SUPER_ADMIN/OWNER/BUSINESS_OWNER/MANAGER/OPERATIONS/OPERATIONS_MANAGER` membership without platform-registry check or tenant/business scope | Returns aggregate KPIs over global MantiGO rides and ledger |
| `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` | Binds actor to `auth.uid()`, then accepts active global-looking tenant roles including `BUSINESS_OWNER`, without platform registry or tenant scope | Attempts to aggregate the platform-wide MantiGO ledger |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | Binds actor to `auth.uid()`, then accepts active `ADMIN/SUPER_ADMIN/OWNER/BUSINESS_OWNER/MANAGER/OPERATIONS/OPERATIONS_MANAGER` membership without registry check or business/branch scope | Mutates stale rides across the global MantiGO ride table, with audit/notification writes |
| `settle_mantigo_captain_backend(uuid,text,text)` | Binds actor to `auth.uid()`, then accepts active `ADMIN/SUPER_ADMIN/OWNER/BUSINESS_OWNER/ACCOUNTANT/FINANCE_MANAGER/FINANCE` membership without registry check or tenant/business scope | Posts captain settlement/journal and marks the global MantiGO ledger row settled |
| `mnty_can_platform_admin()` | Delegates to `public.mnty_can('admin',NULL,NULL,NULL)` | Generic membership/permission helper is used as a platform-root assertion |

The actor-ID equality checks in the four RPCs are useful but insufficient: they prove which authenticated user made the call, not that the user is a platform administrator.

## 2. Aggregate eligible-role population

Read-only, privacy-preserving counts from active memberships and the canonical platform-admin registry:

| Live predicate family | Distinct users matching role set | Matching users absent from platform-admin registry |
|---|---:|---:|
| Dashboard / financial report / stale expiration | 5 | 4 |
| Captain settlement | 5 | 4 |

These are current role-predicate populations, not access logs and not proof of historical exploitation. The database was not asked to execute the affected RPCs under impersonated users.

## 3. The helper is also a direct RLS trust boundary

Five live RLS policies call `mnty_can_platform_admin()`:

- `digital_pages.digital_pages_admin_manage` — ALL
- `mantigo_financial_config.mantigo_financial_config_admin_select` — SELECT
- `mantigo_financial_config.mantigo_financial_config_admin_update` — UPDATE
- `mantigo_rate_limit_config.mantigo_rate_limit_config_admin_select` — SELECT
- `mantigo_rate_limit_config.mantigo_rate_limit_config_admin_update` — UPDATE

Therefore the helper defect is not limited to four RPC endpoints; it also controls direct authenticated RLS access on these tables. The source fix must precede any attempt to claim the affected policies are registry-backed.

## 4. Confirmed live financial schema drift

Live `public.mantigo_financial_ledger` contains `gross_amount`, `commission_amount`, and `captain_net_amount`. It does **not** contain legacy `amount` or `captain_amount` columns.

The current Production financial-report function still sums `amount` and `captain_amount`. Consequently the report body is schema-incompatible and is expected to fail when executed. RC471 uses the canonical `gross_amount` and `captain_net_amount` columns while preserving the report's JSON response keys. No Production invocation was used to reproduce the failure.

## 5. Source repair and regression coverage already available

- RC464: `supabase/migrations/20261113214500_rc464_platform_admin_live_registry_hardening.sql` establishes `mnty_can_platform_admin()` from `private.platform_admins.user_id = auth.uid()`, validates registry ownership/RLS/client grants, and replaces the global MantiGO helper callers.
- RC471: `supabase/migrations/20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` is the forward continuation. It replaces the four MantiGO global RPCs, requires the canonical helper, pins SECURITY DEFINER search paths to empty, removes the generic tenant-role gate, and fixes financial-report column usage. It also pins empty search_path on four additional helper-dependent SECURITY DEFINER callers.
- `supabase/tests/rc449_mantigo_platform_admin_integration.sql` exercises denial for tenant OWNER, tenant ADMIN, tenant BUSINESS_OWNER, OPERATIONS_MANAGER, tenant-scoped SUPER_ADMIN, and a MNTY-PLATFORM SUPER_ADMIN membership without registry membership. It verifies a registry-only platform admin can use the global operations, and checks the relevant function grants/search paths and the registry-backed global digital-pages RLS behavior.
- `scripts/validate-rc464-platform-admin-live-hardening.mjs` and `scripts/validate-r7-platform-admin-migration.mjs` enforce the registry-only helper, exact RPC replacements, empty search_path, correct financial fields, and tenant-role negative cases.
- `.github/workflows/mantigo-platform-admin-scope.yml` runs static validation and disposable PostgreSQL 17 integration/forward-replay coverage.

These are source and isolated-test facts. They are not proof that the migrations have been applied to Production.

## 6. Release state

Fresh read-only ledger recheck:

- Live migration rows: **310**
- Latest live version: `20261110150618`
- Exact required release identifiers in the manifest: **62**
- Required identifiers present in the live ledger: **0/62**

This is a migration-identity mismatch, not proof that every intended physical effect is absent. Keep exact object/body/ACL/trigger reconciliation separate; do not fabricate ledger rows or replay historical SQL blindly.

Encrypted off-site backup, isolated Production restore rehearsal, and measured RPO/RTO are still unverified. The coordinated RC464/RC471 rollout is therefore not authorized by the available evidence. Do not update the helper alone, do not deploy dependent Edge Functions independently, and do not mutate financial records.

## 7. Integration checkpoint

PR #829 (documentation-only correction and Pass 868–875 evidence) was merged to main as `c8de990468698c1719b0a022b202175690a08d2b`. Its exact PR-head checks completed 7/7 successfully. The Pages validation job succeeded, while the actual deploy job was skipped under the release gate. The available workflow connector does not expose independently verifiable main-triggered runs for the merge SHA; no post-merge main CI or deployment is claimed.

## Change boundary

- This pass is a source/production read-only review.
- No Production SQL, DDL, DML, grant, RLS, Auth setting, Edge Function, payment, wallet, settlement, or customer-data mutation occurred.
- No UI, catalog, Android, public website, or source migration was changed.

## Next actions

1. Keep all four MantiGO global RPCs and their dependent operations blocked from Production release until RC464/RC471 are applied in the reviewed sequence.
2. Obtain owner-controlled encrypted off-site backup and a successful isolated restore with measured RPO/RTO.
3. Complete exact live-object preflights and resolve the 62-version migration mismatch with forward-only, dependency-aware reconciliation.
4. Apply the coordinated database sequence only under the approved release/rollback gate, then deploy matching Edge Function bundles.
5. Run post-deploy negative tests for tenant OWNER, ADMIN, BUSINESS_OWNER, FINANCE, OPERATIONS_MANAGER, tenant-scoped SUPER_ADMIN, and MNTY-PLATFORM membership without registry membership; verify registry-only platform admin success and audit/financial invariants.
