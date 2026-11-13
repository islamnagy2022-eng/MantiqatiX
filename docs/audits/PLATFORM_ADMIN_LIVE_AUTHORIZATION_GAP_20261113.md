# Platform Admin Live Authorization Gap — 2026-11-13

**Status:** Forward-only source candidate / draft PR review required / not deployed.

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
- The private platform-root registry exists, has RLS and FORCE RLS enabled, and client roles do not have direct SELECT privilege. It currently has one registered account; that account also has the explicit `MNTY-PLATFORM` SUPER_ADMIN membership with `scope=PLATFORM` and `full_control=true`. No identity values were included in this report.

This confirms an authorization-boundary defect in the live function/policy definitions. It does **not** establish that an unauthorized request was successfully executed or that any data was accessed or changed. No probe invocation, settlement, financial write, or policy mutation was performed.

## Candidate forward fix

The new migration `supabase/migrations/20261113214500_rc463_platform_admin_live_registry_hardening.sql` is deliberately self-contained and does not edit historical RC441/RC449/RC462 migrations:

1. Requires the canonical `private.platform_admins` registry to exist, with RLS and FORCE RLS enabled and no direct client SELECT grants.
2. Requires all four live MantiGO RPC signatures and all four additional helper-dependent global functions to match the audited live contract.
3. Requires the existing global RLS policies on digital pages, MantiGO financial config and MantiGO rate-limit config to reference the shared helper.
4. Replaces `mnty_can_platform_admin()` with the canonical registry-only check, SECURITY DEFINER, empty search_path, no PUBLIC/anon EXECUTE, and authenticated EXECUTE for RLS/function use.
5. Replaces the four MantiGO global RPCs with the hardened RC449 implementations: exact actor binding, the shared platform-root check, pinned empty search_path, and preserved audited operational behavior.
6. Because `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend` already call the shared helper, the new canonical guard also governs those paths and the RLS policies above.

## Isolated PostgreSQL validation

The CI sequence is designed to demonstrate both sides of the change:

- First, a disposable baseline reproduces the weak live helper and proves that a synthetic tenant OWNER can reach each of the four broad global RPC paths.
- Then RC463 is applied in the disposable database.
- The existing RC449 integration suite verifies tenant OWNER/ADMIN/OPERATIONS_MANAGER/tenant-scoped SUPER_ADMIN and membership-only platform SUPER_ADMIN are denied; only the canonical registry entry is accepted.
- The same suite tests global dashboard/report access, settlement and replay behavior, stale-ride expiration, RLS protection of global digital pages, registry privacy, and immediate revocation when a registry entry is removed.

The test-only settlement writer is a stub and performs no real journal or financial writes. The integration suite is disposable PostgreSQL evidence only; it is not a production data test.

## Remaining release gates

- Exact-head static and PostgreSQL CI must pass.
- Review the generated diff and confirm RC463's preflight matches the live schema at rollout time.
- Obtain a complete current-schema restore/replay rehearsal and verified recoverable backup/rollback path before production deployment.
- Confirm the existing service-role bootstrap/revocation path for `private.platform_admins` remains authoritative and audited.
- Refresh Security Advisor, verify the four global RPC ACL/search_path/function bodies and shared helper after any later authorized rollout.
- Enable leaked-password protection only after controlled auth compatibility review; this is separate from RC463.

`PRODUCTION_DDL_DML=false` · `SUPABASE_WRITES=false` · `EDGE_DEPLOYED=false` · `MAIN_CHANGED=false`.
