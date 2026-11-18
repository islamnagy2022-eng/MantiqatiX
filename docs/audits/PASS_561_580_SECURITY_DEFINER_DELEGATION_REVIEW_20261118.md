# Pass 561–580 — authenticated SECURITY DEFINER delegation review (2026-11-18)

## Scope

Read-only review of every authenticated-executable public SECURITY DEFINER routine whose body did not directly contain `auth.uid()`, excluding the intentionally public targeted-ad RPC. The live query returned six routines in this category. Each was traced to its delegated authorization boundary.

## Results

| Entry point | Delegated boundary | Result |
|---|---|---|
| `mnty_business_employee_list(tenant,business)` | `mnty_business_employee_list_scoped(tenant,business,NULL)` | Scoped helper binds actor to `auth.uid()`, rejects anonymous JWTs, verifies business/tenant and branch relationships, and requires an active scoped membership or explicit employee-view/manage permission. No bypass observed in the reviewed path. |
| `mnty_can(permission,tenant,business,branch)` | `mnty_active_membership(...)` | Membership helper filters `user_id=auth.uid()`, active status, and supplied tenant/business/branch scopes. Role/permission matrix is applied to that actor-scoped result. |
| `mnty_can_platform_admin()` | `mnty_can('admin',NULL,NULL,NULL)` | **P0 authorization defect remains live.** Null scope allows ordinary active tenant OWNER/ADMIN or broad SUPER_ADMIN membership permission to satisfy the global helper. RC464/RC471 source repair correctly uses `private.platform_admins`; it remains unapplied in Production. |
| `preview_commission_backend(...)` | `assert_financial_membership(tenant)` | Helper requires non-null `auth.uid()`, an active membership for that actor in the supplied tenant, and one of the explicitly allowed finance roles before reading commission rules. |
| `upsert_catalog_item_and_price_backend(...)` | `upsert_catalog_item_backend(...)` and `upsert_catalog_price_backend(...)` | Both delegated routines independently bind to `auth.uid()`, require active membership with tenant/business/branch role scope, verify the business/item/branch relationships, and validate write inputs. |
 
## Search-path and grant observations

- All six entry points had a function-level `search_path` setting in the live catalog.
- The employee-list wrapper is pinned to an empty path; `mnty_can`, `mnty_active_membership`, commission preview and catalog upsert paths use a non-empty `public` path (some also include `pg_temp`). Their schema-qualified calls and object references reduce ambiguity, but the non-empty configuration remains a hardening candidate for a separately tested forward migration.
- This review does not assert that all 65 SECURITY DEFINER bodies are safe. It covers only the six no-direct-`auth.uid()` cases identified by the live query and their immediate delegation paths.
- Existing CI source `scripts/validate-r7-platform-admin-migration.mjs` statically checks RC471's canonical registry helper, exact signatures, empty search paths, and fixture call paths. Workflow `.github/workflows/mantigo-platform-admin-scope.yml` provisions disposable PostgreSQL and orders RC449, RC462, RC471 plus three integration SQL suites. These are source-contract observations; no fresh workflow run was triggered by this documentation-only audit.

## Actions and boundaries

- No Production SQL, grants, function definitions, Auth configuration, RLS policy, Edge deployment, payment, or settlement was changed.
- Do not deploy RC471 solely from static review. First require the dedicated disposable PostgreSQL workflow to pass on the exact candidate head, reconcile the exact migration chain, and satisfy the encrypted off-site backup/restore gate.
- Next review: the remaining authenticated SECURITY DEFINER routines with direct `auth.uid()` checks, prioritizing global/financial mutations and checking tenant/business/branch binding, anonymous-session handling, grants, search path, idempotency, and audit coverage.

