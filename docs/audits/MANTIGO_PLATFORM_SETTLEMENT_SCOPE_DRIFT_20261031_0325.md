# MantiGO platform settlement authorization drift — 2026-10-31 03:25 UTC

## Scope and safety

Read-only inspection of live Supabase project metadata, migration history, SECURITY DEFINER function metadata, and the exact function definition. No business rows were read. No SQL mutation, migration, grant, Auth/RLS change, Edge Function deployment, payment, settlement, wallet, or journal operation was performed.

## Live Production evidence

- Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.6.
- Live migration ledger: 308 records; latest version `20261029083845`.
- Migration versions `20261010030000` (RC441) and `20261010170000` (RC449) are absent from the live migration ledger.
- Live `public.settle_mantigo_captain_backend(uuid,text,text)` is `SECURITY DEFINER`, configured with `search_path=public`, and directly executable by `authenticated` (`anon` is not executable).
- The live function checks `p_admin_user_id = auth.uid()`, then accepts any active membership for that user whose role is one of `ADMIN`, `SUPER_ADMIN`, `OWNER`, `BUSINESS_OWNER`, `ACCOUNTANT`, `FINANCE_MANAGER`, or `FINANCE`. The membership predicate is not restricted to tenant `MNTY-PLATFORM`, does not require platform scope/full-control permissions, and does not call `mnty_can_platform_admin()`.
- After that check, the function reads a platform-wide MantiGO ride and financial ledger row, calls `create_settlement_and_post_journal`, marks the ledger settled, and writes audit/notification records.

## Risk classification

**P0 / BLOCKING — platform-wide financial authorization is broader than the intended platform-admin boundary.**

A signed-in user with one of the accepted active tenant roles may be able to invoke the authenticated RPC for a qualifying completed and paid/cash-confirmed MantiGO ride. This is a confirmed authorization-contract defect in the live function definition and EXECUTE grant. This audit does not establish that the function has been abused or that any unauthorized settlement occurred.

## Existing source remediation

The repository already contains a forward-only source remediation in:

- `supabase/migrations/20261010030000_rc441_platform_admin_scope_hardening.sql`
- `supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`

The RC449 source replaces the broad role predicate with `public.mnty_can_platform_admin()`, requiring an active `SUPER_ADMIN` membership in `MNTY-PLATFORM` with explicit `scope=PLATFORM` and `full_control=true`; it pins an empty `search_path` and keeps authenticated RPC entrypoints while enforcing authorization inside each RPC.

The isolated integration test `supabase/tests/rc449_mantigo_platform_admin_integration.sql` covers rejection of tenant OWNER, tenant ADMIN, OPERATIONS_MANAGER and tenant-scoped SUPER_ADMIN, acceptance of the explicit platform SUPER_ADMIN, authorized settlement persistence, and replay/idempotency. This is source/test evidence only, not proof that the live Production migration has been applied.

## Required closure

1. Keep Production financial mutations blocked; do not test this by invoking settlement against live records.
2. Obtain an approved, cost-reviewed, restorable, schema-faithful isolated environment and a credential-scrubbed current Production schema capture.
3. Restore and rehearse the exact chronological forward-only migration chain, including RC441/RC449 and payment/journal dependencies, with the existing isolated integration tests.
4. Verify the exact current source/ledger/object/ACL contract and rollback plan before release approval.
5. Apply the approved migration only through the controlled Production release process.
6. Re-read the live function body, `search_path`, `mnty_can_platform_admin()` contract and grants after deployment.
7. Run negative tests for tenant-scoped roles and positive/idempotency tests for the explicit platform SUPER_ADMIN in the isolated environment; do not create live financial transactions as a test.

## Status

- Live authorization drift: **CONFIRMED / NOT REMEDIATED IN PRODUCTION**.
- Source remediation: **PRESENT / ISOLATED TEST SOURCE PRESENT**.
- Production migration: **NOT APPLIED**.
- Overall Production Gate: **BLOCKED / NOT CERTIFIED**.


## Expanded live RPC scope — same 03:25 UTC read-only query

The same read-only catalog query inspected all four platform-wide MantiGO RPCs covered by RC449. All four are SECURITY DEFINER, configured with `search_path=public`, executable by `authenticated`, and not executable by `anon`. None of the live definitions calls `mnty_can_platform_admin()`.

| RPC | Live authorization predicate | Platform-wide effect |
|---|---|---|
| `get_mantigo_admin_dashboard_backend(uuid)` | Any active ADMIN, SUPER_ADMIN, OWNER, BUSINESS_OWNER, MANAGER, OPERATIONS, or OPERATIONS_MANAGER membership | Reads global ride counts and financial aggregates |
| `get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)` | Picks a user's active membership role from the same broad tenant-role set; no platform-tenant scope | Reads global financial ledger totals and report data |
| `settle_mantigo_captain_backend(uuid,text,text)` | Any active ADMIN, SUPER_ADMIN, OWNER, BUSINESS_OWNER, ACCOUNTANT, FINANCE_MANAGER, or FINANCE membership | Mutates platform-wide settlement and journal state |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | Any active ADMIN, SUPER_ADMIN, OWNER, BUSINESS_OWNER, MANAGER, OPERATIONS, or OPERATIONS_MANAGER membership | Mutates platform-wide ride statuses and writes audit/notification records |

This expands the finding beyond settlement alone: the current live contract exposes platform-wide dashboard and financial reporting to tenant-scoped roles and permits tenant-scoped operational roles to invoke global ride expiration. The source RC449 migration already hardens all four RPCs with the same explicit platform-admin guard; the migration is still absent from Production.

**Risk remains P0 / BLOCKING.** No evidence of unauthorized access or mutation was established, and no live RPC was invoked as part of this audit.


## Expanded authorization boundary — legacy platform-admin helper and digital-pages RLS

A second read-only inspection found the root cause extends beyond the eight SECURITY DEFINER RPCs already recorded.

### Live helper defect

- Live `public.mnty_can_platform_admin()` is SECURITY DEFINER with `search_path=public, pg_temp` and returns `public.mnty_can('admin', NULL, NULL, NULL)`.
- Live `public.mnty_active_membership(NULL,NULL,NULL)` returns every active membership for the authenticated user without requiring `tenant_id='MNTY-PLATFORM'`.
- Live `public.mnty_can('admin',...)` explicitly treats an active `OWNER` role as having the `admin` permission. Therefore a tenant OWNER can satisfy the current platform-admin helper without being a platform SUPER_ADMIN.
- The helper itself is authenticated-executable and anon-denied. The defect is its authorization semantics, not anonymous execution.

### Additional SECURITY DEFINER callers

Four more live SECURITY DEFINER functions rely on this weak helper:

| Function | Global effect guarded by the weak helper |
|---|---|
| `admin_create_global_ad` | Creates a platform-wide advertisement |
| `fulfill_digital_page_publish` | Publishes a paid digital-page order/page |
| `review_mantigo_captain_application` | Approves, rejects, or suspends a MantiGO captain profile |
| `set_mantigo_financial_config_backend` | Changes the global MantiGO commission rate and currency |

Combined with the four directly broad-role-gated MantiGO RPCs already listed, this is at least eight live global SECURITY DEFINER entrypoints relying on an inadequate tenant/platform boundary.

### Direct RLS exposure

- Live policy `public.digital_pages_admin_manage` is `FOR ALL TO authenticated` and uses `mnty_can_platform_admin()` in both `USING` and `WITH CHECK`.
- `public.digital_pages` has RLS enabled; authenticated has SELECT, INSERT, UPDATE, and DELETE table privileges. The policy does not add a tenant/page ownership predicate.
- Because the live helper accepts tenant OWNER as platform admin, a tenant OWNER can satisfy this global RLS policy and may read or mutate digital pages across the platform. This is a confirmed policy/privilege path from catalog definitions and grants; no digital-page rows were read or changed to demonstrate it.
- The policies on `mantigo_financial_config` and `mantigo_rate_limit_config` also call the weak helper, but the authenticated role currently has no direct table grants on those two tables. The separate `set_mantigo_financial_config_backend` SECURITY DEFINER RPC is nevertheless a global write path through the weak helper.

### Existing source remediation and new regression gap

- RC441/RC449 source replaces the weak helper with an active `SUPER_ADMIN` membership specifically in `MNTY-PLATFORM`, explicit `scope=PLATFORM`, and `full_control=true`. That corrected helper also protects its SECURITY DEFINER callers and the RLS policies that call it.
- Existing RC449 disposable tests cover four MantiGO RPCs, but previously did not reproduce the live `digital_pages_admin_manage` RLS policy.
- New test-only work adds a disposable `digital_pages` table/policy and verifies tenant OWNER cannot SELECT/INSERT/UPDATE/DELETE while the explicit platform SUPER_ADMIN can. This must pass in the dedicated PostgreSQL workflow before merge.
- **Risk remains P0 / BLOCKING.** No live RPC was invoked, no business rows were read, and no Production data, DDL, grants, migration, payment, settlement, or RLS policy was changed.


## Supabase Security Advisor triage — 2026-10-31

A separate read-only Security Advisor review was performed to distinguish genuine API exposure from linter findings that are currently closed by grants or function type.

### RLS-enabled tables with no policies

The advisor lists eight tables: `business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `platform_custom_roles`, `platform_role_assignments`, and `public_directory_listings`.

Catalog inspection confirms all eight have RLS enabled and zero policies. It also confirms anon and authenticated currently lack SELECT/INSERT/UPDATE/DELETE table privileges on all eight. Seven have FORCE RLS; `digital_page_payment_events` has FORCE RLS disabled. Therefore the no-policy warnings do not currently establish a direct PostgREST table exposure because the API roles have no table grants. Preserve the deny-by-default state; if any client/API path needs access, add narrowly scoped grants and policies only after ownership/tenant requirements and tests are explicit.

### Anonymous SECURITY DEFINER advisor findings

- `assign_default_owner_to_unowned_business()` returns `trigger` and is attached to the `businesses` table. It is not an ordinary RPC callable directly by a client.
- `capture_commission_rule_audit()` returns `trigger` and is attached to `commission_rules`. It is not an ordinary RPC callable directly by a client.
- `get_mnty_targeted_advertisements(...)` is an anon-executable public read endpoint. It returns approved active ad creative, target URL, placement, geographic match level and distance; the result limit is clamped to 1–50. This appears consistent with public advertisement rendering, but the projection, targeting inputs, and abuse/rate limiting remain review items. Do not revoke anon access without a replacement public-read design.

### Authenticated SECURITY DEFINER inventory and Auth setting

- The advisor reports 67 authenticated-executable SECURITY DEFINER functions. This is an inventory warning, not proof that every function is vulnerable. Perform risk-based review of actor binding, tenant/business/branch scope, role checks, idempotency, fixed search_path, and least-privilege EXECUTE grants. Prioritize global admin, payment/ledger/wallet, identity, and ownership mutation functions.
- Supabase Auth leaked-password protection is currently disabled. Add a controlled Auth hardening action with compatibility/user-impact review and post-change verification.

No DDL, grants, policies, Auth settings, business rows, RPC mutations, payments, settlements, or production deployments were changed during this review. The P0 platform-admin helper/RLS drift documented above remains unresolved; Production stays BLOCKED / NOT CERTIFIED.
