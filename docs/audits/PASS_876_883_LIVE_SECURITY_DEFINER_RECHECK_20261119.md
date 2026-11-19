# Pass 876–883 — Live SECURITY DEFINER authorization recheck

**Date:** 2026-11-19  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Environment:** Supabase Production, read-only; GitHub source review  
**Production mutations:** NONE

## Confirmed live settlement authorization defect

The live definition of `public.settle_mantigo_captain_backend(uuid,text,text)` was fetched using `pg_get_functiondef` and its effective ACL/configuration was checked in the same read-only query.

| Property | Live result |
|---|---|
| SECURITY DEFINER | true |
| Owner | postgres |
| `search_path` | `public` |
| anon EXECUTE | false |
| authenticated EXECUTE | true |
| Platform registry guard | absent |
| Authorization predicate | caller must match `auth.uid()`, then any ACTIVE membership with role ADMIN, SUPER_ADMIN, OWNER, BUSINESS_OWNER, ACCOUNTANT, FINANCE_MANAGER, or FINANCE is accepted |

This function can mutate platform-wide settlement state and invoke the settlement/journal writer. The role predicate is not sufficient to authorize a platform-wide settlement. A tenant-scoped business owner or finance user must not gain global settlement authority.

## Canonical source correction already exists

The source migration `supabase/migrations/20261113214500_rc464_platform_admin_live_registry_hardening.sql` and follow-forward migration `supabase/migrations/20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` replace the global settlement RPC with:
- caller UUID bound to `auth.uid()`;
- `public.mnty_can_platform_admin()` required before any global settlement;
- empty `search_path`;
- anon execution revoked and authenticated execution retained for in-function authorization.

The existing disposable PostgreSQL integration `supabase/tests/rc449_mantigo_platform_admin_integration.sql` checks that tenant OWNER, tenant ADMIN, and BUSINESS_OWNER are denied, while a registry-backed platform admin can settle; it also checks persisted ledger state, audit/notification, and idempotent replay. RC471's workflow includes the fixture, ordered migrations, and behavioral integration suite. These are source/CI controls only: Production still has the old definition.

## Shared helper remains weak in Production

Live `public.mnty_can_platform_admin()` still delegates to `public.mnty_can('admin',NULL,NULL,NULL)`. The live `mnty_can` body includes generic role and permission grants for tenant OWNER, BUSINESS_OWNER, and ADMIN. This is why deploying a dependent Edge Function or changing only its TypeScript source cannot close the database authorization gap.

## Additional spot review

- `preview_commission_backend` delegates to `assert_financial_membership`, whose live body binds to `auth.uid()` and requires an active tenant finance membership. No defect was confirmed from this spot check; business/branch scoping still needs a complete call-path test.
- `upsert_catalog_item_and_price_backend` delegates to the separately guarded `upsert_catalog_item_backend` and `upsert_catalog_price_backend` functions. No independent bypass was confirmed from the wrapper definition; continue reviewing the delegated functions and exact tenant/branch constraints.
- Security Advisor's 65 authenticated-executable SECURITY DEFINER count is a review population, not a vulnerability count.

## Current main and deployment evidence

Main is `c8de990468698c1719b0a022b202175690a08d2b`. Seven push workflows for this exact SHA completed successfully, including Production Health Monitor, Backend-only Module Boundary, MantiGO Open Ride Privacy Boundary, Module Professionalization, Directory Claim Atomicity, SMM Deferred Storefront Contract, and Deploy MantiqatiX Web. The Pages deploy job and deployed-origin checks passed.

The deployment workflow composes the legacy catalog as the production root, preserves a rollback copy under `/legacy/`, and publishes the AI Studio V6 build under `/v6-preview/`. V6 is not the production root. The workflow step name "Verify V6 production root" is inaccurate; its actual commands verify the existing catalog root, legacy copy, and V6 preview alias. No root cutover is claimed.

The path-filtered RC471 workflow did not run on this documentation-only commit. The previously recorded PR-head PostgreSQL tests are the source validation for RC471; do not attribute them to this commit.

## Release boundary

No Production SQL, DDL, DML, grants, Auth settings, RLS policies, Edge Functions, payments, wallets, settlements, or customer data were changed. Do not deploy RC464/RC471 or dependent Edge Functions individually. Production remains **BLOCKED / NOT CERTIFIED** pending coordinated migration/object reconciliation, owner-controlled encrypted backup and isolated restore, measured RPO/RTO, and post-deploy adversarial authorization tests.
