# Platform Admin Live Authorization Gap — 2026-11-13

**Status:** Forward-only RC464 source candidate / draft PR #724 / earlier 12-of-12 validation is historical; latest source includes a live-ledger schema correction and a new disposable regression test, with full CI rerunning / not deployed.

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
- The private platform-root registry exists with RLS enabled, but the live table did **not** have FORCE RLS enabled at inspection time. The table owner is `postgres`, and the existing shared guard function is also owned by `postgres`. Both `postgres` and `service_role` have `BYPASSRLS`; `anon` does not have schema usage or table privileges, while `authenticated` has schema usage but no SELECT/INSERT/UPDATE/DELETE privileges. The RC464 preflight now requires the guard owner to match the registry table owner and to have `BYPASSRLS` before enabling FORCE RLS, preserving the owner-executed registry lookup while failing closed on owner drift. The candidate RC464 migration validates the RLS/client-ACL boundary, then enables FORCE RLS inside its transaction. The registry currently has one registered account; that account also has the explicit `MNTY-PLATFORM` SUPER_ADMIN membership with `scope=PLATFORM` and `full_control=true`. No identity values were included in this report.

This confirms an authorization-boundary defect in the live function/policy definitions. It does **not** establish that an unauthorized request was successfully executed or that any data was accessed or changed. No probe invocation, settlement, financial write, or policy mutation was performed.


## Additional live schema verification — 2026-11-14

A second read-only inspection of the active Supabase project confirmed the following:

- The live `public.mantigo_financial_ledger` table has `gross_amount`, `commission_amount`, and `captain_net_amount`. It does **not** have `amount` or `captain_amount`.
- The currently deployed `get_mantigo_admin_financial_report_backend()` body references `l.amount` and `l.captain_amount`. Those references do not match the live table schema and would fail when an authorized call reaches the aggregate query. No function invocation was made.
- The RC464 forward migration now calculates gross and paid amounts from `gross_amount`, and captain/settlement amounts from `captain_net_amount`. The R7 forward migration carries the same correction.
- Both candidate branches now share a disposable-only regression test, `supabase/tests/mantigo_financial_report_live_columns.sql`. The RC449 integration fixture deliberately leaves its legacy `amount` and `captain_amount` columns NULL; the new test runs only after the candidate migration and checks the settled report totals against the live columns.
- Live `private.platform_admins` has RLS enabled but FORCE RLS disabled; its table owner and the shared helper owner are both `postgres`. The live `postgres` and `service_role` roles have BYPASSRLS, while `anon` and `authenticated` do not. These facts satisfy the RC464 preflight's owner/BYPASSRLS assumptions; the migration still rechecks them at apply time.
- Live `businesses`, `branches`, and `orders` have RLS enabled and FORCE RLS enabled. Their current policies still include broad tenant-level reads; PR #727 narrows business/branch reads and PR #725 narrows order reads.
- The live migration ledger still ends at `20261110150618`. None of the candidate PR migrations have been applied to Production. No production DDL, DML, Edge Function deployment, or Pages deployment was performed during this follow-up.

### Merge and rollout ordering

- PR #722 (`20261113020000`) precedes RC464 by migration timestamp and also pins four existing helper-dependent SECURITY DEFINER callers to an empty search_path. Merge/review #722 before #724 where practical; the database migration runner will apply timestamp order.
- PR #724 remains a draft and must not be treated as deployed or certified. The latest candidate head at this checkpoint is `abe65ba546396f5cd464eaacbc38fddb0ed0e595`; its CI is rerunning after the schema correction and regression wiring.
- PR #725 and PR #727 have completed their current CI suites successfully (25/25 and 24/24 checks respectively). They remain drafts and still require human review and controlled rollout.

## Candidate forward fix

The repository already contains `20261031100000_rc463_trigger_only_security_definer_acl.sql`; that historical RC463 migration is unchanged. To avoid reusing its identifier, this forward-only candidate is numbered RC464. The new migration `supabase/migrations/20261113214500_rc464_platform_admin_live_registry_hardening.sql` is deliberately self-contained and does not edit historical RC441/RC449/RC462 migrations:

1. Requires the canonical `private.platform_admins` registry to exist, RLS enabled, and no direct client SELECT/INSERT/UPDATE/DELETE grants; then enables FORCE RLS transactionally.
2. Requires all four live MantiGO RPC signatures and all four additional helper-dependent global functions to match the audited live contract.
3. Requires the existing global RLS policies on digital pages, MantiGO financial config and MantiGO rate-limit config to reference the shared helper.
4. Replaces `mnty_can_platform_admin()` with the canonical registry-only check, SECURITY DEFINER, empty search_path, no PUBLIC/anon EXECUTE, and authenticated EXECUTE for RLS/function use.
5. Replaces the four MantiGO global RPCs with the hardened RC449 implementations: exact actor binding, the shared platform-root check, pinned empty search_path, and preserved audited operational behavior.
6. Because `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend` already call the shared helper, the new canonical guard also governs those paths and the RLS policies above.

## Validation evidence — tested RC464 source head `5de4c48d44e8690f5a8edb686965de4f157e8ccb`

At this tested source head, all **12/12 PR checks** completed successfully. Key evidence:

- RC464 dedicated PostgreSQL 16 run: [43517025450](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/43517025450) — source contract, weak-behavior reproduction, RC464 migration commit, RC462 integration suite, and RC464 shared-helper caller suite all passed.
- Complete forward migration replay from the captured production schema checkpoint: [43517025336](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/43517025336) — checkpoint/static inventory validation passed, isolated Supabase instance started without repository migrations, all later migrations (including RC464) replayed in timestamp order, and isolated instance stopped successfully.
- Migration-history immutability, version uniqueness, PR collision guard, RC425 Paymob atomicity, MantiGO privacy, MantiGO platform-admin scope, backend-only boundaries, module validation, and approval-action atomicity: all passed.
- The `Deploy MantiqaTix Web` workflow on the PR event ran validation only. Its actual Pages deployment job is guarded to require a push to `main` or an explicit `workflow_dispatch`; no live site deployment occurred.

The isolated PostgreSQL sequence demonstrates both sides of the change:

- First, a disposable baseline reproduces the weak live helper and proves that a synthetic tenant OWNER can reach each of the four broad global RPC paths.
- Then RC464 is applied in the disposable database.
- The existing RC449 integration suite verifies tenant OWNER/ADMIN/OPERATIONS_MANAGER/tenant-scoped SUPER_ADMIN and membership-only platform SUPER_ADMIN are denied; only the canonical registry entry is accepted.
- The same suite tests global dashboard/report access, settlement and replay behavior, stale-ride expiration, RLS protection of global digital pages, registry privacy, and immediate revocation when a registry entry is removed.

The test-only settlement writer is a stub and performs no real journal or financial writes. The integration suite is disposable PostgreSQL evidence only; it is not a production data test.

## Remaining release gates

- Review the generated diff and confirm RC464's preflight matches the live schema at rollout time.
- Obtain a complete current-schema restore/replay rehearsal and verified recoverable backup/rollback path before production deployment.
- Confirm the existing service-role bootstrap/revocation path for `private.platform_admins` remains authoritative and audited.
- Refresh Security Advisor, verify the four global RPC ACL/search_path/function bodies and shared helper after any later authorized rollout.
- Enable leaked-password protection only after controlled auth compatibility review; this is separate from RC464.

`TESTED_HEAD=5de4c48d44e8690f5a8edb686965de4f157e8ccb` · `PR_CHECKS=12/12_PASS` · `PRODUCTION_DDL_DML=false` · `SUPABASE_WRITES=false` · `EDGE_DEPLOYED=false` · `MAIN_CHANGED=false`.
