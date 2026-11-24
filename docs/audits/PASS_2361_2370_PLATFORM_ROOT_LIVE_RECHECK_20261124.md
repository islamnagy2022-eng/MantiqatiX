# PASS 2361–2370 — Platform-root authorization live read-back

**Repository checkpoint:** `main @ d55fc4e3b53f9c069c4618b7c4b4a271213a08e6`  
**Production project:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Database:** PostgreSQL `17.6.1.155`, project status `ACTIVE_HEALTHY`  
**Method:** read-only PostgreSQL catalog/function/ACL/RLS queries. No business rows, user identities, financial payloads or secret values were read.

## Live result — BLOCKED

| Contract | Fresh Production evidence | Disposition |
|---|---|---|
| Canonical registry | `private.platform_admins` owned by `postgres`; RLS ON; FORCE RLS OFF; owner has BYPASSRLS; one registry row. | **PARTIAL — owner prerequisite is correct; FORCE RLS not yet active.** |
| Registry table grants | `anon` and `authenticated`: SELECT/INSERT/UPDATE/DELETE all false. `service_role`: all four true. | **PASS for client isolation; service-role access remains privileged and must stay server-only.** |
| `public.is_platform_admin()` | SECURITY INVOKER, `search_path=public`; implementation accepts ACTIVE tenant `ADMIN` or `SUPER_ADMIN` membership. | **BLOCKED — tenant membership is still treated as platform-root authority.** |
| `public.mnty_can_platform_admin()` | SECURITY DEFINER, `search_path=public, pg_temp`; implementation calls `public.mnty_can('admin', NULL, NULL, NULL)`. | **BLOCKED — legacy unscoped helper remains.** |
| RLS policy dependency | 57 policies across 24 tables reference `is_platform_admin()`; 5 policies across 3 tables reference `mnty_can_platform_admin()`; combined 62 policies across 27 tables. | **BLOCKED — the shared helper correction has a 27-table authorization blast radius.** |
| RC464/RC471 caller set | Eight exact named global/MantiGO RPC identities are present; four of them still call the legacy shared helper. | **BLOCKED — coordinated caller replacement and actor tests still required.** |
| Seven direct catalog RPCs | All seven exist as SECURITY DEFINER with `search_path=public`; anon EXECUTE=false on all; authenticated EXECUTE=true on all; service_role EXECUTE=true on three. Four use the legacy COALESCE anonymous check; three have no direct anonymous-claim check. None requires `is_anonymous` to be explicitly false. | **BLOCKED — RC485/RC923/RC925 source chain is not applied to Production.** |

The eight reviewed RPC identities for RC464/RC471 are `get_mantigo_admin_dashboard_backend`, `get_mantigo_admin_financial_report_backend`, `settle_mantigo_captain_backend`, `expire_stale_mantigo_rides_backend`, `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend`. Exact overloads are in the migration source/preflight contracts; do not replace functions by name alone.

## Source and isolated-test evidence

- RC464 source preflights the protected registry, registry-owner/BYPASSRLS parity, four core MantiGO admin RPCs and four other global helper callers.
- RC471 adds schema prerequisites and forward-hardens four legacy helper callers plus the MantiGO administration functions. RC464/RC471 are forward-only sources; historical RC441/RC449/RC462 must remain immutable.
- RC484 preflights the 57-policy / 24-table registry dependency, then enables FORCE RLS and changes `is_platform_admin()` to a SECURITY DEFINER, empty-search-path lookup against `private.platform_admins`.
- RC485 requires the RC484 registry-backed helper before replacing the seven catalog RPCs. RC923/RC925 add explicit anonymous-session rejection at those direct RPC boundaries; RC925 requires `is_anonymous=false`, not merely a non-true value.
- Exact-head PR #1086 tests on source head `ba5b4deb1fb4575d1fcfc926f956cc411fe751f3`: full PostgreSQL 17 forward-chain replay run `45496742405` passed; module professionalization/RC471 and related PostgreSQL suites run `45496743088` passed; backend boundary, approval audit and journal tests run `45496742460` passed; catalog build, dashboard employee RBAC and browser E2E run `45496742310` passed. Directory, MantiGO privacy, Paymob and RC924 suites also passed. These are isolated CI tests, not Production application.
- PR #1086 deploy workflow `45496742559` passed its validation; public-only and deploy jobs were skipped. No web deployment was performed.

## Release disposition

**Production remains READ-ONLY. No migration, DDL/DML, Auth, RLS, GRANT, Storage, Edge, payment, settlement, customer-data or website deployment mutation was made.**

Do not apply only RC464/RC471/RC484/RC485 in isolation. The migration ledger has 310 rows through `20261110150618`; the release manifest contains 82 required source IDs and 0 exact ID matches. That identity mismatch is not proof all effects are absent. Release must use the canonical ordered 82-source crosswalk and reconcile every physical effect/alias before any write.

The exact preconditions and ordered gate are in [PLATFORM_ROOT_COORDINATED_RELEASE_20261124.md](../release/PLATFORM_ROOT_COORDINATED_RELEASE_20261124.md). Current full platform state: **BLOCKED / NOT CERTIFIED**.
