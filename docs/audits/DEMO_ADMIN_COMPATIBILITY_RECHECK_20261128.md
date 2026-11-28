# MantiqatiX-DEMO — Admin Control Center Delivery & Security Recheck

**Checkpoint:** 2026-11-28  
**Project:** `MantiqatiX-DEMO` — `lkijdgqanbqjudiducjt`  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Branch:** `dev/demo-admin-compat-20261128`  
**Pull request:** [#1216 — isolated admin control-center compatibility](https://github.com/islamnagy2022-eng/MantiqatiX/pull/1216) (Draft)

## Applied migrations

The DEMO migration ledger contains these three applied versions:

| Ledger version | Migration file | Purpose |
|---|---|---|
| `20261128112058` | `20261128112058_demo_platform_root_authority_convergence.sql` | Registry-backed root authority, FORCE RLS, coordinated RC464/469/471/472-index/484/485 chain, then RC486/923/925 later catalog protections |
| `20261128112119` | `20261128112119_demo_admin_control_center_compatibility.sql` | Custom platform roles and assignments, people/audit/business RPCs, employee job positions and employees, BizCatalog settings, guarded business deletion |
| `20261128112653` | `20261128112653_demo_mnty_permission_helper_empty_search_path.sql` | Empty search_path on legacy `mnty_active_membership` and `mnty_can` helpers |

The GitHub files are named to match the actual migration ledger versions. Do not reapply these migrations manually.

## Verified DEMO schema and authorization state

Read-after-apply checks confirm:
- `mnty_can_platform_admin()` and `is_platform_admin()` both consult `private.platform_admins`.
- `private.platform_admins` has RLS and FORCE RLS enabled. Browser roles cannot read the registry directly.
- Anonymous users cannot execute the root guards; authenticated users may invoke the guarded root check.
- Registry row count remains **0**; no user has been promoted.
- All 36 public `SECURITY DEFINER` functions executable by `authenticated` have empty `search_path`. The legacy `mnty_active_membership` and `mnty_can` helpers were hardened in the third migration without changing their ACL or permission logic.
- The four admin/employee tables (`platform_custom_roles`, `platform_role_assignments`, `business_job_positions`, `business_employees`) have RLS enabled, no permissive policies and no direct anon/auth table privileges. The resulting Advisor INFO finding is intentionally fail-closed.
- `bizcatalog_platform_settings` has RLS, a service-role-only policy, and no direct browser table privileges.
- `mnty_platform_admin_delete_business(text,uuid,uuid)` is SECURITY INVOKER, has empty search_path, and is executable only by service_role. It blocks deletion when historical order/payment/inventory/accounting/legal records exist and writes an audit event.
- Final employee RPC definitions preserve the RC457 permission ceiling and override-subset checks.

## Edge Function deployment

`catalog-platform-admin` is deployed to MantiqatiX-DEMO only:
- Status: ACTIVE
- Version: 1
- Gateway `verify_jwt=false` so CORS OPTIONS requests can reach the handler.
- The handler requires a Bearer token, validates the user with Supabase Auth, rejects anonymous users, and requires `mnty_can_platform_admin()` before any platform action.
- Shared activity-module sanitization and subscriber-membership deduplication modules are included in the deployed bundle.

Supabase read-back confirms the deployed function is ACTIVE version 1. A direct HTTP smoke test has **not** completed: the execution environment could not resolve the Supabase hostname, so the request did not reach the Edge Function. Do not describe CORS or unauthenticated HTTP behavior as network-verified yet.

## Operator bootstrap still required

The platform-admin registry contains zero identities. The migration intentionally does not invent or seed a privileged user. An authorized project operator must create/verify a separate confirmed Auth account inside DEMO and follow [the bootstrap runbook](../runbooks/DEMO_PLATFORM_ADMIN_BOOTSTRAP_20261128.md). Never copy a Production identity, session, or credential into DEMO.

Until an approved DEMO account is registered, the admin UI correctly denies users. Do not substitute a tenant OWNER/ADMIN/SUPER_ADMIN membership for the protected platform registry.

## Deliberately disabled function

The activity-module override editor remains fail-closed at the server boundary. Any direct `activityModuleOverrides` write receives HTTP 409 (`ACTIVITY_MODULE_SETTINGS_NOT_READY`) until settings persistence and audit insertion can be committed atomically. This is an intentional safety lock, not a front-end-only restriction.

## PostgreSQL rehearsal and CI evidence

Before applying the migrations, the complete ordered root + admin chain was executed against the actual DEMO schema inside one transaction and rolled back. The rehearsal passed:
- registry-only root behavior (tenant ADMIN/SUPER_ADMIN denied; registry-only user allowed);
- admin RPC ACLs, internal helper denial, FORCE RLS, exact DEMO policy-inventory fingerprint;
- RC472 null-safe membership index preflight;
- BizCatalog service-role settings write and history-protected business delete + audit;
- employee RBAC, tenant/business/branch isolation and RC457 permission ceilings;
- RC485 registry root, RC486 price serialization and RC925 missing-anonymous-claim tests.

The rehearsal returned `DEMO_EXACT_SCHEMA_ROOT_ADMIN_RBAC_RC485_RC486_RC925_ROLLED_BACK`; a read-after-rollback confirmed no rehearsal schema or data remained. The migrations were then applied individually and verified through the live DEMO ledger and catalog queries.

The separate chronological PostgreSQL 17 GitHub replay applies the migration chain on a disposable localhost Supabase instance restored from the captured Production schema checkpoint. It is not an exact DEMO schema replay. On the latest PR head, this replay was in progress after source-contract checks; final completion is pending.

## Supabase Advisor findings

Latest security advisor findings to keep visible:
- 6 RLS-enabled tables without policies: the four new admin/employee tables above, plus the pre-existing `digital_page_payment_events` and `mantigo_payment_provider_events`. Direct browser grants remain denied.
- 1 anon-executable SECURITY DEFINER function: `get_mnty_targeted_advertisements`, the intentionally public targeted-advertising read endpoint.
- 36 authenticated-executable SECURITY DEFINER functions. All have empty search_path. They are user-callable RPCs and rely on their own auth/tenant/permission logic; continue targeted review. Do not remove required product RPC access indiscriminately.
- Leaked-password protection remains disabled (pre-existing Auth setting).
- Performance Advisor still reports unrelated baseline items (unindexed foreign keys, RLS initplan notices, unused/duplicate indexes and multiple permissive policies). They were not bulk-modified in this scoped task.

## Latest CI state

On the most recent checked PR head:
- Migration version uniqueness, migration-history immutability and cross-PR collision guard: passed.
- Forward PostgreSQL 17 replay: running in a disposable local environment.
- Primary catalog build and professional-dashboard browser checks: running.
- Module Professionalization / platform-admin, Pages/V6 and related validation: running or queued.
- PR deployment workflow is main-gated; no GitHub Pages production publication was performed from this Draft PR.

## Environment boundaries

- Three migrations applied only to Supabase project `MantiqatiX-DEMO`.
- `catalog-platform-admin` deployed only to MantiqatiX-DEMO.
- No Production schema/data/Auth/Edge Function was changed.
- No GitHub Pages production publication occurred.
- No Auth identity or platform-admin registry row was created.
- PR #1216 remains Draft pending final latest-head CI, direct DEMO HTTP/browser authorization tests and an explicitly approved DEMO-only administrator bootstrap.
