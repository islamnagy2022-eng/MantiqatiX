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

### Follow-up: default-owner trigger invocation surface

The trigger catalog confirms `assign_default_owner_to_unowned_business()` is attached to `businesses`. The current live table grants show neither anon nor authenticated has direct INSERT privilege on `businesses`; business creation therefore depends on privileged backend/RPC paths rather than direct client table inserts. The trigger's hard-coded default-owner fallback still deserves review against every privileged business-creation path (actor attribution, rate limits, ownership expectation, and auditability), but this inspection did not establish an unauthorized assignment or a direct anonymous RPC path.


## 2026-10-31 — RC441/RC449 source equivalence and full helper dependency map

### Source comparison

A line-by-line comparison of current `main` versions of:
- `supabase/migrations/20261010030000_rc441_platform_admin_scope_hardening.sql`
- `supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`

found substantive SQL equivalence. RC441 is 245 lines / 11,534 characters; RC449 is 244 lines / 11,533 characters. Differences are the migration comment label, the comment text stored on `mnty_can_platform_admin()`, and the final newline. Both define the same strict helper, replace the same four MantiGO global RPCs, and apply the same `PUBLIC/anon` revokes plus `authenticated` grants. Do not edit/delete historical migrations. Full chronological replay should apply both exact IDs and confirm the second idempotent replacement causes no schema/ACL drift.

### Shared-helper dependency map

The original RC258 helper delegates platform-admin authorization to `mnty_can('admin', NULL, NULL, NULL)`. Because the null scope admits any active membership and the permission matrix treats tenant OWNER as admin, this is not a platform boundary.

In addition to the four MantiGO RPCs recreated by RC441/RC449, the same helper is called by:
- `admin_create_global_ad` — creates a platform-wide advertisement.
- `fulfill_digital_page_publish` — publishes a paid digital-page order/page.
- `review_mantigo_captain_application` — approves/rejects/suspends captain profiles.
- `set_mantigo_financial_config_backend` — changes global MantiGO commission/currency configuration.

The helper replacement is therefore the common authorization fix for all eight global SECURITY DEFINER entrypoints. The four additional functions were inspected in source and each invokes `mnty_can_platform_admin()`; they are not separately redefined in RC441/RC449. Add direct caller-level adversarial tests to the full isolated suite before production certification.

### Existing test evidence

`rc449_mantigo_platform_admin_integration.sql` tests tenant OWNER, tenant ADMIN, OPERATIONS_MANAGER, tenant-scoped SUPER_ADMIN and explicit platform SUPER_ADMIN. It exercises the four global MantiGO RPCs, settlement/expiration replay behavior, ACL checks, empty search_path checks, and the `digital_pages_admin_manage` RLS CRUD boundary. The fixture is disposable and does not touch Production. This is source-level/isolated PostgreSQL evidence only.

### Current Production status

Read-only refresh at 2026-10-31 04:39:16 UTC: migration ledger 308 rows through `20261029083845`; exact RC441 and RC449 identifiers are both absent. Security Advisor: 8 RLS-enabled/no-policy tables, 3 anon-executable SECURITY DEFINER functions, 67 authenticated-executable SECURITY DEFINER functions, 90 anonymous-policy findings, and leaked-password protection disabled. No Production mutation occurred. Gate remains **BLOCKED / NOT CERTIFIED**.


### Governance alignment item — platform authority registries

A separate source review found a second platform-root authorization model: the newer Super Admin Control Center RPCs (`mnty_platform_admin_*`) authorize against `private.platform_admins`, while the RC441/RC449 MantiGO/global-digital-page helper authorizes against an active `user_memberships` row in `MNTY-PLATFORM` with `SUPER_ADMIN`, `scope=PLATFORM`, and `full_control=true`. These are distinct authority sources, not the same predicate. The platform-control-center design explicitly describes `private.platform_admins` as the protected root registry; an earlier documented production checkpoint (2026-09-27) recorded zero rows, but that count has not been re-read in this session. Do not infer the current registry contents. Before rollout, decide and test whether both sources must agree, whether one is the canonical root, and how bootstrap/revocation keeps them synchronized. This is a governance consistency gap to resolve, not proof of a privilege escalation. No sensitive registry rows were queried.


## 2026-10-31 — P0 platform-admin authority-source convergence review

### Confirmed source-level distinction

- RC113 explicitly states that platform authority remains anchored to `private.platform_admins`. Its Super Admin Control Center RPCs check `private.platform_admins.user_id = auth.uid()` and reject anonymous sessions before reading/managing platform users, memberships, businesses, custom roles and role assignments.
- RC115's `mnty_platform_has_permission` also grants platform-owner authority only from `private.platform_admins`; tenant/business/branch delegated permissions are evaluated separately from scoped employee memberships and `platform_role_assignments`.
- By contrast, RC441/RC449's `mnty_can_platform_admin()` checks only an active `user_memberships` row for `tenant_id='MNTY-PLATFORM'`, role `SUPER_ADMIN`, `scope=PLATFORM`, and `full_control=true`. It does not consult `private.platform_admins`.
- Therefore two distinct authorization sources currently define platform-admin authority. The source does not establish whether this is intentional dual authorization or an incomplete convergence. Do not silently select one model or claim a proven exploit from this observation alone.

### Test coverage gap

- The existing RC449 test fixture defines `user_memberships` and tests tenant OWNER/ADMIN/OPERATIONS_MANAGER/tenant-scoped SUPER_ADMIN against the global RPCs and `digital_pages` RLS.
- It does not define `private.platform_admins` or seed the explicit platform test user in that registry. As a result, its positive case proves only the membership-based model; it does not verify alignment with the registry-based Control Center model.
- Required new isolated cases, after the canonical policy is approved:
  1. Membership-only `MNTY-PLATFORM` SUPER_ADMIN with `scope=PLATFORM/full_control=true` but absent from `private.platform_admins` must be rejected if the registry is canonical.
  2. Registry-only platform admin without an active platform membership must have an explicitly documented expected result.
  3. A registered platform admin with active platform membership must pass the selected policy.
  4. Tenant OWNER, tenant ADMIN, OPERATIONS_MANAGER, and tenant-scoped SUPER_ADMIN remain denied across all eight helper-dependent global operations.
  5. Verify revocation/removal behavior and audit attribution in the isolated fixture.

### Historical bootstrap source limitation

- The historical RC42 manifest records production migration identifiers for platform authority, atomic registration review, bootstrap authority and the MNTY owner bootstrap. The corresponding exact candidate SQL paths `20260927065218`, `20260927065247`, `20260927065347`, and `20260927131555` were not found on current `main`; do not reconstruct their SQL from names. The later `20260927140202_lock_platform_admins_rls.sql` is present, while the manifest also records a live version alias `20260927140200`.
- The existing test fixture describes `private.platform_admins(user_id)` as a primary key referencing `auth.users(id)`, but that fixture is not proof of the complete live DDL or bootstrap semantics.
- No current production rows or identities from `private.platform_admins` were queried in this review. A 2026-09-27 documentation snapshot had recorded zero rows then; that historical count must not be presented as the current count.

### Next required decision and controls

- [ ] Recover authoritative historical SQL/history for registry creation, service-role bootstrap and MNTY owner bootstrap; compare with current live objects and grants.
- [ ] Define one canonical platform-root authority contract and explicitly document whether MNTY platform membership is an additional operational constraint or a redundant second root source.
- [ ] Align the forward-only helper migration and the RC449 disposable fixture/integration tests with that contract. Preserve RC441/RC449 historical files unchanged.
- [ ] Add adversarial tests for registry-only, membership-only, synchronized, suspended/revoked, and non-platform tenant identities before any production rollout.
- Production migration ledger was freshly rechecked at 308 records through `20261029083845`; RC441 and RC449 remain absent. Security Advisor at 2026-10-31 06:39:56 UTC: 8 RLS/no-policy findings, 3 anon-executable SECURITY DEFINER findings, 67 authenticated-executable SECURITY DEFINER findings, 90 anonymous-policy findings, and leaked-password protection disabled.
- No Production DDL/DML, grant, RLS/Auth change, registry-row read, Edge deployment, payment, settlement or journal mutation occurred. Overall gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — RC462 proposed forward convergence (source PR; not production)

- [x] Added forward-only migration `supabase/migrations/20261031064300_rc462_platform_admin_registry_authority_convergence.sql` on an isolated feature branch. It aligns `mnty_can_platform_admin()` with the authoritative `private.platform_admins` registry used by RC113/RC115; it does not modify RC441/RC449 historical files.
- [x] Added a migration preflight requiring the private registry and all four RC449 MantiGO global RPCs to exist and call the shared guard. This prevents applying RC462 before RC449's function replacements.
- [x] Expanded disposable PostgreSQL fixture to model the private registry with RLS + FORCE RLS and no direct client grants.
- [x] Expanded integration coverage: membership-only MNTY-PLATFORM SUPER_ADMIN is denied; registry-only platform admin is permitted; registry deletion immediately revokes platform authority; the existing four global MantiGO RPC tests and digital_pages RLS tests remain in the suite.
- [x] Updated the dedicated CI workflow to apply RC449, then RC462, then the behavioral integration test; updated the static validator to inspect all eight shared-helper-dependent source functions.
- [ ] Exact-head PostgreSQL CI and full repository checks are pending. Do not merge until all checks pass and the final diff is reviewed.
- [ ] Production rollout requires full current-schema restore/replay, reconciliation of both historical RC441 and RC449 IDs in order, backup/restore and rollback rehearsal, verification that the real service-role bootstrap correctly provisions/removes `private.platform_admins` entries, and explicit release authorization.
- No production registry rows were read or changed. No Production DDL/DML, grants, RLS/Auth setting, Edge deployment, payment, settlement or journal mutation occurred. Overall gate remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-31 — RC462 merged; Production intentionally unchanged

- [x] PR [#592](https://github.com/islamnagy2022-eng/MantiqaTix/pull/592) merged to `main` as `911f91f7f7e0f2d70bd290467ac33b53dc4f5b30`. The merged source adds forward-only `20261031064300_rc462_platform_admin_registry_authority_convergence.sql`; RC441/RC449 historical files remain untouched.
- [x] Exact candidate head `02265e95260dfdfebf1821647086ec3bdb54502d` passed 12 required GitHub Actions workflows: MantiGO Platform Admin Scope Hardening, Forward Migration Chain Replay from Production Schema Checkpoint, Migration History Immutability, Migration Version Uniqueness, Open PR Migration Collision Guard, RC425 MantiGo Paymob Atomicity, Approval Action Audit Atomicity, MantiGO Open Ride Privacy Boundary, Backend-only Module Boundary, Module Professionalization Validation, SMM Deferred Storefront Contract, and Deploy MantiqatiX Web.
- [x] Dedicated registry-convergence PostgreSQL test run: [41178333719](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41178333719) PASS. It applies fixture → RC449 → RC462 → behavior tests and verifies membership-only denial, registry-only acceptance, removal/revocation, MantiGO global RPC guards and `digital_pages` RLS. Initial attempt failed because the test did not restore the `auth.uid()` actor before a settlement assertion; the fixture was corrected to restore the registered platform actor and the exact-head rerun passed. No test was disabled.
- [x] Chronological isolated Supabase replay: [41178333682](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41178333682) PASS. Restored the captured schema checkpoint, applied every later tracked migration in timestamp order, and ran dependent contract/tenant-isolation tests. This is an isolated replay, not authorization to mutate live Production.
- [x] Other 10 workflows on the exact candidate head also passed, including migration immutability/version/collision checks, Paymob atomicity, approval audit, MantiGO privacy, module boundaries, professionalization, SMM contract and web deploy.
- [x] Fresh read-only Production recheck after merge: 308 migration records, latest `20261029083845`; RC462 version `20261031064300` is absent. RC441 and RC449 remain absent as well. Therefore the new guard exists in `main` source but is NOT active in Production.
- [x] Security Advisor refreshed at 2026-10-31 06:54:55 UTC: 8 RLS-enabled/no-policy INFO findings; 3 anon SECURITY DEFINER warnings; 67 authenticated SECURITY DEFINER warnings; 90 anonymous-policy warnings; 1 leaked-password protection warning. This is an inventory; do not blanket-revoke or add broad policies.
- [ ] Before any Production rollout: recover authoritative historical bootstrap SQL for `private.platform_admins`; verify the legitimate server-side provisioning/removal path without exposing registry rows; rehearse the exact ordered RC441 → RC449 → RC462 effects against a restorable current Production schema; obtain off-site backup + successful restore/rollback evidence; inspect final live ACL/search_path/function bodies; complete auth/payment/finance and tenant-isolation E2E; and obtain explicit rollout authorization.
- No Production DDL/DML, grants, RLS/Auth settings, registry-row reads, Edge deployments, payments, refunds, settlements or journal mutations occurred. Overall Production Gate remains **BLOCKED / NOT CERTIFIED**.

 
## Fresh live Production recheck — 2026-10-31 (read-only, after RC462 merge)

### Migration/source status
- Live migration ledger: **308** records, latest `20261029083845`.
- Exact IDs are all absent: RC441 `20261010030000`, RC449 `20261010170000`, RC462 `20261031064300`.
- PR #592 is merged; current main contains its merge commit `911f91f7f7e0f2d70bd290467ac33b53dc4f5b30`. RC462 source is therefore in main, but none of RC441/RC449/RC462 is active in Production.
- Exact-head isolated tests on RC462 candidate passed: [MantiGO Platform Admin Scope Hardening #41178333719](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41178333719) and [Forward Migration Chain Replay #41178333682](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41178333682). These are fixture/replay evidence, not live deployment.

### Current live authorization state
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp` and returns `public.mnty_can('admin',NULL,NULL,NULL)`.
- `mnty_active_membership(NULL,NULL,NULL)` still enumerates all ACTIVE memberships without tenant/business/branch restriction. `mnty_can('admin')` includes the OWNER role in its built-in admin permission list. Therefore the old helper still does not establish platform-root authority.
- All eight global SECURITY DEFINER entrypoints remain authenticated-executable and anon-denied. The four MantiGO global RPCs retain their broad role predicates; the other four call the weak helper: `admin_create_global_ad`, `fulfill_digital_page_publish`, `review_mantigo_captain_application`, and `set_mantigo_financial_config_backend`.
- `public.digital_pages_admin_manage` remains a permissive `FOR ALL TO authenticated` policy using the weak helper for both USING and WITH CHECK. `digital_pages` has RLS enabled (FORCE RLS false) and authenticated SELECT/INSERT/UPDATE/DELETE privileges. Owner-scoped policies also exist, but permissive policies combine by OR; the weak global admin policy remains a cross-tenant path for a tenant OWNER accepted by the helper.
- No live RPC was invoked and no digital-page, MantiGO, financial or registry row content was read or changed.

### Canonical root registry readiness — aggregate only
- `private.platform_admins` exists, RLS enabled, no direct anon/authenticated table grants, and a restrictive client-deny policy. service_role has the backend table privileges.
- Aggregate count only: the registry contains **1** row. No user ID or row contents were queried.
- Aggregate alignment only: one registry user has an ACTIVE `MNTY-PLATFORM` `SUPER_ADMIN` membership with `scope=PLATFORM` and `full_control=true`. No identity was exposed.
- `private.bootstrap_platform_admin(...)` exists as SECURITY DEFINER with empty search_path and service_role-only EXECUTE; anon and authenticated EXECUTE are false. This is a server-side one-time path, not a public caller. Focused GitHub search found no tracked source caller for this private bootstrap routine.

### Current decision / required next actions
- **P0 remains CONFIRMED / NOT REMEDIATED IN PRODUCTION.** RC462's canonical registry predicate is source-merged and isolated-tested, but Production still runs the weak helper and global RLS path.
- Preserve migration files. Required chronological replay order is RC441 → RC449 → RC462, but this subset must be embedded in the complete required migration-chain reconciliation, not applied ad hoc.
- Next dependency remains an authorized credential-scrubbed current-Production schema/roles capture, disposable restore, complete ordered migration replay, and rollback rehearsal. Only then can the controlled Production rollout be separately reviewed and explicitly authorized.
- No Production DDL/DML, GRANT/REVOKE, RLS/Auth change, Edge deployment, payment, settlement, wallet or journal action was performed. Overall gate remains **BLOCKED / NOT CERTIFIED**.
