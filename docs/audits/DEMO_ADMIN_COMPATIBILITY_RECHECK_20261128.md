# MantiqatiX-DEMO — Admin Control Center Delivery & Security Recheck

**Checkpoint:** 2026-11-28  
**Project:** `MantiqatiX-DEMO` — `lkijdgqanbqjudiducjt`  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Branch:** `dev/demo-admin-compat-20261128`  
**Pull request:** [#1216 — isolated admin control-center compatibility](https://github.com/islamnagy2022-eng/Mantiqix/pull/1216) (Draft)

## Implemented and applied on DEMO

The following three migrations are now present in the DEMO migration ledger:

| Version | Migration | Purpose |
|---|---|---|
| `20261128112058` | `20261128085000_demo_platform_root_authority_convergence` | Registry-backed root authority, FORCE RLS, RC464/469/471/472-index/484/485 convergence, then preservation of RC486/923/925 catalog protections |
| `20261128112119` | `20261128090000_demo_admin_control_center_compatibility` | Platform custom roles, assignments, people/audit/business RPCs, employee job positions and employees, BizCatalog platform settings, protected business deletion |
| `20261128112653` | `demo_mnty_permission_helper_empty_search_path` | Empty `search_path` on legacy membership permission helpers `mnty_active_membership` and `mnty_can` |

Post-application read-back confirms:
- `mnty_can_platform_admin()` and `is_platform_admin()` both consult `private.platform_admins`.
- `private.platform_admins` has RLS and FORCE RLS enabled. Browser roles have no direct SELECT access.
- Anonymous users cannot execute the root guards; authenticated users can invoke the guarded check.
- All 36 public `SECURITY DEFINER` functions executable by `authenticated` have empty `search_path`. The only authenticated/anonymous-executable definer surfaced by the advisor is the intentionally public targeted-advertising read endpoint.
- The four administration/employee tables `platform_custom_roles`, `platform_role_assignments`, `business_job_positions`, and `business_employees` have RLS enabled, no direct browser table privileges, and no permissive policies. Access is through the intended guarded RPCs.
- `bizcatalog_platform_settings` has RLS, service-role-only table access and policy; anon/authenticated cannot read it directly.
- `mnty_platform_admin_delete_business(text,uuid,uuid)` is SECURITY INVOKER, uses empty search_path, and is executable only by service_role. It preserves businesses with order/payment/inventory/accounting/legal history and records deletion in audit_logs.
- The RC457 employee permission ceiling and override-subset checks remain in the final employee RPC definitions.

## Edge deployment

`catalog-platform-admin` is deployed to **MantiqatiX-DEMO only**:
- Status: ACTIVE
- Version: 1
- Gateway `verify_jwt=false` to let CORS OPTIONS requests reach the function.
- The handler itself requires a Bearer token, validates the user with Supabase Auth, rejects anonymous users, and calls `mnty_can_platform_admin()` before any platform action.
- Shared activity-module sanitization and subscriber-membership deduplication helpers were included in the deployment.

The deployment was read back from Supabase and matches the expected active function/version. A direct HTTP/browser authorization smoke test has not yet been completed in this checkpoint.

## Intentionally not enabled

The activity-module override editor remains fail-closed at the server boundary. Any direct `activityModuleOverrides` write receives HTTP 409 (`ACTIVITY_MODULE_SETTINGS_NOT_READY`) until settings persistence and audit insertion can be committed atomically. This is not a front-end-only lock.

No administrator identity has been inserted into `private.platform_admins`. The registry count remains **0**. Consequently the admin UI correctly denies all users until an authorized operator creates a separate confirmed Auth account inside DEMO and follows [the bootstrap runbook](../runbooks/DEMO_PLATFORM_ADMIN_BOOTSTRAP_20261128.md). Do not use a Production identity or infer which user should be promoted.

## Verification evidence

Before applying the migrations, the full ordered root + admin chain was executed against the actual DEMO schema inside one transaction and rolled back. The rehearsal passed:
- root registry positive/negative behavior: tenant ADMIN/SUPER_ADMIN denied; registry-only user allowed;
- platform RPC ACLs, internal helper denial, FORCE RLS and exact DEMO policy-inventory fingerprint;
- RC472 null-safe membership index preflight;
- BizCatalog service-role write and history-protected business delete + audit;
- employee RBAC, tenant/business/branch isolation and RC457 permission ceilings;
- RC485 registry root, RC486 price serialization and RC925 missing-anonymous-claim tests.

The transaction returned `DEMO_EXACT_SCHEMA_ROOT_ADMIN_RBAC_RC485_RC486_RC925_ROLLED_BACK`; a read-after-rollback confirmed no rehearsal objects or data had remained. The migrations were then applied individually to the DEMO project and verified through the migration ledger and catalog queries.

After deployment, a further security read-back found two legacy helper functions with `search_path=public, pg_temp`. The third migration set their search_path to empty without changing ACL or permission logic. A post-fix query confirms **0** authenticated-executable public SECURITY DEFINER functions with a non-empty search_path.

## Supabase Advisor results

Current warnings to keep visible:
- 6 RLS-enabled tables with no policy (4 new admin/employee tables, plus 2 pre-existing event tables). The 4 new tables have no direct anon/auth table privileges; their no-policy state is intentionally fail-closed.
- 1 anon-executable SECURITY DEFINER function: the public targeted-advertisements read endpoint. It is intentionally public for published ad discovery; keep its body/return projection under review.
- 36 authenticated-executable SECURITY DEFINER functions. Their search_path is empty; they remain user-callable RPCs and rely on function-level auth/tenant/permission checks. Continue targeted review; do not solve the advisor warning by broad grants or indiscriminate function revocation that would break product RPCs.
- Leaked-password protection remains disabled (pre-existing Auth setting).
- Performance advisor continues to report unrelated pre-existing items (unindexed foreign keys, RLS initplan notices, unused/duplicate indexes, and multiple permissive policies). These were not bulk-modified in this scoped admin delivery.

## CI status at this checkpoint

The latest-head workflows have been triggered again after migration-file renames and the third helper migration:
- Migration version uniqueness and migration-history immutability: passed.
- Cross-PR migration collision guard: passed.
- Forward PostgreSQL 17 replay: running from the captured Production schema checkpoint, not the exact DEMO schema; exact DEMO rehearsal above is separate evidence.
- Primary catalog build, employee RBAC PostgreSQL test and dashboard Playwright browser checks: running.
- Module Professionalization validation and Pages/V6 checks: running/queued.
- PR deployment workflow is main-gated. No GitHub Pages production deployment was performed from this Draft PR.

## Environment boundaries

- Applied only to Supabase project `MantiqatiX-DEMO`.
- Deployed only `catalog-platform-admin` to that DEMO project.
- No Production schema/data/Auth/Edge Function was changed.
- No GitHub Pages production publication occurred.
- No Auth identity or platform-admin registry row was created.
- PR #1216 remains Draft pending latest-head CI completion, direct DEMO HTTP/browser authorization smoke tests, and an explicitly authorized DEMO-only administrator bootstrap.
