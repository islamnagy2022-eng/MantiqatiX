# Platform Admin Live Authorization Gap — 2026-11-13

**Status:** Forward-only source candidate / draft PR #724 / isolated PostgreSQL and current checkpoint replay passed / not deployed.

## Evidence captured from the connected Production database (read-only)

At the inspection point:

- Supabase migration ledger contained **310 records**, latest version **`20261110150618`**.
- Historical hardening migrations **RC441 `20261010030000`**, **RC449 `20261010170000`**, and **RC462 `20261031064300`** were all absent from the live migration ledger.
- The live `public.mnty_can_platform_admin()` remained a SECURITY DEFINER wrapper around `public.mnty_can('admin', NULL, NULL, NULL)`, configured with `search_path=public, pg_temp`. The live `mnty_can` grants the `admin` permission to tenant OWNER and ADMIN roles, and its null scope can evaluate active memberships without binding the check to `MNTY-PLATFORM`.
- Live RLS policies `digital_pages_admin_manage`, `mantigo_financial_config_admin_update`, and `mantigo_rate_limit_config_admin_update` call this helper. The first policy applies to all authenticated operations on the global `digital_pages` table.
- Four global MantiGO SECURITY DEFINER RPCs were not using the strict shared helper. They checked only that the supplied actor UUID equalled `auth.uid()` and that the user had a matching active role in any tenant:
  - `get_mantigo_admin_dashboard_backend`
  - `get_mantigo_admin_financial_report_backend`
  - `settle_mantigo_captain_backend`
  - `expire_stale_mantigo_rides_backend`
- These four RPCs exposed global MantiGO ride and financial aggregates, settlement mutation, and ride expiration to broad tenant-level OWNER/ADMIN/OPERATIONS/FINANCE roles.
- The private platform-root registry exists with RLS enabled, but the live table did **not** have FORCE RLS enabled at inspection time. The table owner is `postgres`, and the existing shared guard function is also owned by `postgres`. Both `postgres` and `service_role` have `BYPASSRLS`; `anon` does not have schema usage or table privileges, while `authenticated` has schema usage but no SELECT/INSERT/UPDATE/DELETE privileges. The RC463 preflight now requires the guard owner to match the registry table owner and to have `BYPASSRLS` before enabling FORCE RLS, preserving the owner-executed registry lookup while failing closed on owner drift. The candidate RC463 migration validates the RLS/client-ACL boundary, then enables FORCE RLS inside its transaction. The registry currently has one registered account; that account also has the explicit `MNTY-PLATFORM` SUPER_ADMIN membership with `scope=PLATFORM` and `full_control=true`. No identity values were included in this report.

This confirms an authorization-boundary defect in the live function/policy definitions. It does **not** establish that an unauthorized request was successfully executed or that any data was accessed or changed. No probe invocation, settlement, financial write, or policy mutation was performed.

## Candidate forward fix

The new migration `supabase/migrations/20261113214500_rc463_platform_admin_live_registry_hardening.sql` is deliberately self-contained and does not edit historical RC441/RC449/RC462 migrations:

1. Requires the canonical `private.platform_admins` registry to exist, RLS enabled, and no direct client SELECT/INSERT/UPDATE/DELETE grants; then enables FORCE RLS transactionally.
2. Requires all four live MantiGO RPC signatures and all four additional helper-dependent global functions to match the audited live contract.
3. Requires the existing global RLS policies on digital pages, MantiGO financial config and MantiGO rate-limit config to reference the shared helper.
4. Replaces `mnty_can_platform_admin()` with the canonical registry-only check, SECURITY DEFINER, empty search_path, no PUBLIC/anon EXECUTE, and authenticated EXECUTE for RLS/function use.
5. Replaces the four MantiGO global RPCs with the hardened RC449 implementations: exact actor binding, the shared platform-root check, pinned empty search_path, and preserved audited operational behavior.
6. Because `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend` already call the shared helper, the new canonical guard also governs those paths and the RLS policies above.

## Validation evidence — tested source head `33a2f55b1152e44fe8242766f4b1a608eb6421b0`

At this tested source head, all **12/12 PR checks** completed successfully. Key evidence:

- RC463 dedicated PostgreSQL 16 run: [43516232029](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/43516232029) — source contract, weak-behavior reproduction, migration commit, RC462 integration suite, and RC463 shared-helper caller suite all passed.
- Complete forward migration replay from the captured production schema checkpoint: [43516232028](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/43516232028) — checkpoint/static inventory validation passed, isolated Supabase instance started without repository migrations, all later migrations replayed in timestamp order, and isolated instance stopped successfully.
- Migration-history immutability, version uniqueness, PR collision guard, RC425 Paymob atomicity, MantiGO privacy, MantiGO platform-admin scope, backend-only boundaries, module validation, and approval-action atomicity: all passed.
- The `Deploy MantiqaTix Web` workflow on the PR event ran validation only. Its actual Pages deployment job is guarded to require a push to `main` or an explicit `workflow_dispatch`; no live site deployment occurred.

The isolated PostgreSQL sequence demonstrates both sides of the change:

- First, a disposable baseline reproduces the weak live helper and proves that a synthetic tenant OWNER can reach each of the four broad global RPC paths.
- Then RC463 is applied in the disposable database.
- The existing RC449 integration suite verifies tenant OWNER/ADMIN/OPERATIONS_MANAGER/tenant-scoped SUPER_ADMIN and membership-only platform SUPER_ADMIN are denied; only the canonical registry entry is accepted.
- The same suite tests global dashboard/report access, settlement and replay behavior, stale-ride expiration, RLS protection of global digital pages, registry privacy, and immediate revocation when a registry entry is removed.

The test-only settlement writer is a stub and performs no real journal or financial writes. The integration suite is disposable PostgreSQL evidence only; it is not a production data test.

## Remaining release gates

- Review the generated diff and confirm RC463's preflight matches the live schema at rollout time.
- Obtain a complete current-schema restore/replay rehearsal and verified recoverable backup/rollback path before production deployment.
- Confirm the existing service-role bootstrap/revocation path for `private.platform_admins` remains authoritative and audited.
- Refresh Security Advisor, verify the four global RPC ACL/search_path/function bodies and shared helper after any later authorized rollout.
- Enable leaked-password protection only after controlled auth compatibility review; this is separate from RC463.

`TESTED_HEAD=33a2f55b1152e44fe8242766f4b1a608eb6421b0` · `PR_CHECKS=12/12_PASS` · `PRODUCTION_DDL_DML=false` · `SUPABASE_WRITES=false` · `EDGE_DEPLOYED=false` · `MAIN_CHANGED=false`.
