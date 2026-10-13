# S02 Scope Registration — MantiGO Admin Authorization
Date: 2026-10-13
Agent: S02
Branch: `agent/s02-mantigo-admin-auth`
Base: `292bce3eaaeb68b83133eae83f8dde4129d57a3f` (PR #218 observed head at registration)

## Exclusive scope
Review and harden only these four PostgreSQL RPCs:
- `get_mantigo_admin_dashboard_backend`
- `get_mantigo_admin_financial_report_backend`
- `settle_mantigo_captain_backend`
- `expire_stale_mantigo_rides_backend`

## Pre-edit observations (read-only)
- PR #218 is open, Draft, and unmerged. Coordination comments were read before edits.
- Production project `moyhiluyhjsujhwlyeuu` was queried read-only. All four functions are `SECURITY DEFINER`, have `search_path=public`, and ACLs show EXECUTE for `authenticated`; no `PUBLIC`/anon grant appeared in the returned ACL.
- Each production function currently relies on membership roles and/or a client-supplied `p_admin_user_id` equality check; these do not establish platform-wide authority. `mnty_can_platform_admin()` currently delegates to `mnty_can('admin',NULL,NULL,NULL)`, whose semantics can include tenant-level roles. Therefore the helper is not trustworthy as currently deployed.
- PR source already contains candidate RC449 hardening, using explicit active `MNTY-PLATFORM` + `SUPER_ADMIN` + `scope=PLATFORM` + `full_control=true`, empty search_path, and per-function checks. RC462 follow-up addresses malformed `full_control` permission parsing. These are source candidates only; neither implies production is fixed.
- No production writes, migration application, grants/RLS/Auth changes, settlement/expiry operations, merge, or deployment are in scope.

## Planned work
1. Add independent negative/positive behavioral tests for all four RPCs: ordinary/tenant admin denial, anonymous/no JWT denial, forged `p_admin_user_id` denial, tenant-scoped SUPER_ADMIN denial, and explicitly authorized platform SUPER_ADMIN allow.
2. Verify fixed response JSON contract and that denial occurs before any settlement or expiry side effect.
3. Run focused static checks and disposable PostgreSQL tests if the existing workflow/tooling permits; otherwise report exact blockers without claiming execution.
4. Document migration forward-path, rollback/forward-fix strategy, compatibility, and remaining risks.
5. Commit on this branch only. Do not merge, deploy, or apply any migration to production.

## Coordination / conflict rule
No existing `agent/s02-mantigo-admin-auth` branch was found at registration. If another session modifies the same four-function migration/tests/workflow while this branch is in progress, stop overlapping edits and record the conflict instead of overwriting.
