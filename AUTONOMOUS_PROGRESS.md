# Autonomous Progress — MantiqatiX

**Updated:** 2026-11-27  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Verified main:** `7cb8e96ae1bf6a739039c0ec0e8673d0025ef4cb`  
**Release status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`  
**Production boundary:** read-only; no Production database, Auth/RLS/GRANT, Storage, Edge, payment, wallet, settlement, or customer-data mutation.

## Latest verified source work

- PR #1155 merged on 2026-11-26 as `5bc82aa8c2fcb49588764a57e288c1a32c711aa9`.
- PR #1155 adds public activity keyset pagination: 20 activities per page, signed/filter-bound cursors, expiration/tamper/cross-filter rejection, server-side geographic filters, area matching only through the branch-specific public-contact consent projection, and deduplicated explicit “See more” loading.
- Exact PR-head CI for #1155 completed with 28 successes, two expected skipped deployment-only checks, and no failures. Post-merge main checks also passed catalog build, dashboard browser E2E, employee RBAC, public-directory pagination, contact privacy, and the module/financial integration suites. The Pages deployment job was still running at the time of this checkpoint; do not treat it as deployed until its deploy job completes successfully.
- Subsequent verification on 2026-11-27: Pages deployment run [45913948208](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45913948208) completed successfully. It published the root catalog and verified `/legacy/` rollback, `/v6-preview/`, mixed-case catalog URLs, and dashboard/mobile/QR routes. This verifies the website deployment only; it does not clear the database or Edge release blockers.
- Duplicate pagination PRs #1152 and #1153 were closed after #1155 merged.
- Gallery-viewer PR #1150 was closed as superseded; the change was recreated on current main and merged as PR #1157, commit `9f6824750ab21bb754ad0c0253732f9b49919c64`. It adds the accessible promotional-image viewer, RTL keyboard navigation, Escape/backdrop close, focus containment/restoration, and browser/source-contract coverage. Exact-head CI completed with 28 successes, two expected skips, and no failures, including the dashboard browser E2E.
- Public unclaimed-directory listings remain disabled. Do not enable them until publication/source rights, consent schema/RPC/ACL/RLS, and deployed Edge contracts are verified.

## 2026-11-27 — Latest merged source work after PR #1157

- PR #1163 merged as `77271bcb82eb4f09ee7e6a3eedca23265df76a13`: the disposable Supabase forward-replay workflow now allocates non-conflicting local host ports. Exact-head CI completed 34/34 checks with no failures; the 87-version strict gate and chronological PostgreSQL 17 replay passed. Main replay run: [45918214620](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45918214620).
- PR #1162 merged as `78deab17b26d528a637e4eedadab34b4185350f0`: `CREATE_BUSINESS` now enforces name length by Unicode code points and requires normalized governorate + markaz values server-side; village remains optional. Exact-head CI completed successfully, including build, dashboard browser E2E, Employee RBAC, and source-contract checks.
- PR #1164 merged as `82eb082bf7afffe349bb50ed20db07a0651bf04e`: subscriber memberships are deduplicated only when user, tenant, organization, business, branch, role, and canonical permission payload all match. Active duplicate rows take precedence; the latest timestamp is used within the same status priority. Different branch and permission scopes remain separate. Account-only detection uses the full pre-deduplication membership set. Node regression tests were added.
- PR #1164 exact-head CI completed 36/36 checks: zero failures, two expected deployment-only skips. The browser run reported `PRIMARY_CATALOG_BROWSER_E2E=PASS` and `ACTIVITY_SHARE_DIALOG_BROWSER_E2E=PASS`: [45918613427](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45918613427).
- The primary catalog validation for main commit `78deab1` completed successfully, including the dashboard browser E2E. The Pages deployment for that commit was still running at the time of this checkpoint; the post-PR #1164 Pages deployment run [45918953383](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45918953383) had been queued.
- Production remains read-only. No Production migration, Auth/RLS/GRANT, Storage, Edge deployment, payment, wallet, settlement, or customer-data mutation was made by these merges or CI runs.

## 2026-11-27 — Super Admin control-center resilience

- PR #1169 merged as `db5f015ba2ada4e385f816215671f74b17fa338a`: control-center role/audit RPC flows now release loading/saving states in `finally`, surface rejected network requests, keep audit search explicit rather than firing on every keystroke, and disable duplicate in-flight audit searches.
- Exact-head CI for PR #1169 completed with 33 successful checks, two expected deployment-only skips, and zero failures. Build, dashboard browser E2E, and employee RBAC all passed.
- The merge changed frontend request handling and source-contract tests only. It did not change database schema, Production data, Auth/RLS/GRANT, Edge deployments, payments, wallets, or settlement.
- The merge is not a Production release certification. The production migration/authorization/Edge/backup-restore gates below remain blocked.

## Verified Production release blockers — carried forward from the 2026-11-26 read-only audits

- The latest documented Production migration ledger contains 310 rows through `20261110150618`. The exact required migration-ID match remains 0/87. This is an identity mismatch, not proof that every physical effect is absent.
- Live platform-root helpers remain documented as membership-derived or delegated to broad tenant-admin membership. The private platform-admin registry still requires FORCE RLS and the coordinated helper/policy/caller release. The audited scope is 57 policies across 24 tables plus five policies across three tables.
- Gallery-dependent Edge bundles remain behind current source and depend on coordinated schema/RPC/ACL/RLS changes. Do not deploy `catalog-admin`, `public-catalog`, or `public-catalog-directory` individually.
- Full platform remains **BLOCKED / NOT CERTIFIED**. Backup/restore remains deferred and unverified; disposable CI replay is not Production backup/restore evidence.

## Fresh read-only Supabase recheck — 2026-11-27 00:04 UTC

The connected Supabase project `MANTIQATIX FINAL` is `ACTIVE_HEALTHY` on PostgreSQL 17.6.1.155. Read-only catalog queries reconfirmed:

- Migration ledger: 310 rows; latest version `20261110150618`.
- `private.platform_admins`: RLS enabled, FORCE RLS disabled.
- `public.is_platform_admin()`: SECURITY INVOKER, `search_path=public`, derives global authority from any ACTIVE tenant ADMIN/SUPER_ADMIN membership; it does not read the private registry.
- `public.mnty_can_platform_admin()`: SECURITY DEFINER, `search_path=public, pg_temp`, delegates to `public.mnty_can('admin', NULL, NULL, NULL)`; it does not read the private registry.
- Both helpers are executable by `authenticated`, not `anon`. The issue is the authority semantics for signed-in callers, not public execution.

- Current canonical release contract: 87 required migration versions; direct comparison with the connected 310-row Production ledger found 0/87 exact IDs, while all three declared alias target versions are present. This does not certify physical-effect parity.
- RC929 live order guard recheck: `orders` and `order_status_history` both have RLS and FORCE RLS enabled, anon SELECT denied and authenticated SELECT granted, but the new strict `is_anonymous=false` restrictive policies are absent. RC929 remains unapplied.
- Policy blast radius: 57 policies / 24 tables reference `is_platform_admin()`; five policies / three tables reference `mnty_can_platform_admin()` (62 / 27 combined).

The Supabase Security Advisor returned 94 lint types and 166 counted findings: 157 WARN and nine INFO. Warn categories include 90 RLS-policy role warnings for `anon`, 65 authenticated-callable SECURITY DEFINER functions, one anon-callable SECURITY DEFINER targeted-advertisements RPC, and disabled leaked-password protection. Nine INFO findings flag tables with RLS enabled and no policies. These advisor categories are triage signals, not proof that every listed policy/function is exploitable; inspect each policy predicate, direct grant, caller path, and intended public-read contract before changing it. Do not bulk-revoke or modify policies based only on the lint label.

No SQL write, migration, grant, Auth setting, Edge deployment, or customer-data change was made during this recheck.

## Next execution order

1. Complete exact-head review and CI for PR #1174 (read-only production evidence) and PR #1175 (accurate health-monitor reporting); merge only when all required checks pass.
2. Keep the Edge `/health` result explicitly **NOT CHECKED** until the owner-configured `HEALTH_MONITOR_TOKEN` is available to the workflow; do not mistake the legacy anon read probe for an Edge health check.
3. Reconcile all 87 canonical migration identities against aliases and live physical schema/function/ACL/RLS effects; preserve the fail-closed release gate.
4. Prepare the coordinated platform-root sequence (RC464 → RC471 → RC484 → RC485) and dependent policy/caller work with disposable PostgreSQL positive/negative tests and exact live preflight evidence. Do not hot-edit Production helpers or bulk-rewrite policies.
5. Keep Production read-only until the complete chronological migration chain, ACL/RLS, Edge parity, deployed-origin positive/negative tests, and verified backup/restore/rollback gates are complete.

**Non-actions:** no Production migration, Edge Function deployment, payment, wallet, settlement, Auth setting, Storage, or customer/business-data write was performed in this checkpoint.


## Main deployment closeout — 2026-11-27 02:37 UTC

- [x] Confirmed the post-merge GitHub Pages deployment for main commit `38f70c516110566e7a568f268abe45842b77342c` completed successfully (workflow run [45928869346](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45928869346)).
- [x] Deployment job completed its site composition, Pages artifact upload, GitHub Pages publish, production-root / legacy rollback / V6 Preview checks, and deployed-origin browser checks for catalog URLs and dashboard/mobile/QR routes.
- [x] This verifies the web/Pages deployment for the recorded main commit only. It does not certify Supabase migration application, Edge Function deployment parity, database authorization, payments, wallets, or full production readiness.
- [x] PR #1171 merged as `730515fa1082c7063bab84499bc45102cce363d4`; exact-head build, dashboard browser E2E, Employee RBAC/PostgreSQL, and related CI checks passed.
- [x] PR #1172 merged as `7cb8e96ae1bf6a739039c0ec0e8673d0025ef4cb`; overview/KPI/shortcut browser tests, build, Employee RBAC/PostgreSQL and related CI checks passed.
- [x] Main Pages deployment for `7cb8e96ae1bf6a739039c0ec0e8673d0025ef4cb` completed successfully in run [45930249106](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45930249106), including deployed-origin checks for the catalog, legacy rollback and dashboard/mobile/QR routes.
- [ ] PR #1175 adds accurate health-monitor status output and a CI contract test. The current main health run [45930248943](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45930248943) used the legacy anon read-only database probe because `HEALTH_MONITOR_TOKEN` is missing, but still printed an unconditional Edge `/health` success line. PR #1175 corrects this; its exact-head CI is still running.
- [ ] Keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` until the separate live database migration, ACL/RLS, Edge, privacy, finance, backup/restore and rollback gates are satisfied.
- **Non-actions:** no Production database write, migration, Auth/RLS/GRANT change, Edge Function deployment, payment, wallet, settlement, or customer/business-data mutation was performed as part of the Pages deployment closeout.

## Main deployment and monitoring closeout — 2026-11-27 02:52 UTC

- The current main source includes PR #1171 and PR #1172; the latter provides the new Super Admin overview as the default landing page with explicit published-catalog, active-subscriber, pending-publication, and payment-attention indicators plus nine section shortcuts.
- Main commit `7cb8e96ae1bf6a739039c0ec0e8673d0025ef4cb` is deployed to GitHub Pages. The deploy workflow run [45930249106](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45930249106) completed successfully; the post-deploy dashboard/mobile/QR route check passed.
- The production health-monitor workflow run [45930248943](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45930248943) completed, but its log confirms `HEALTH_MONITOR_TOKEN` was empty. Therefore the protected Edge `/health` endpoint was skipped; only the legacy anon PostgREST read-only probe passed. The old workflow summary incorrectly reported Edge `/health` as checked. PR #1175 adds truthful mode reporting and a source-contract CI test; it remains unmerged pending full CI.
- **Release status remains `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.** Pages deployment does not certify database migration, Edge parity, authorization, payments, wallets or backup/restore.



## Supabase production read-only recheck — 2026-11-27 02:42 UTC

- [x] Confirmed the connected `MANTIQATIX FINAL` Supabase project is ACTIVE_HEALTHY on PostgreSQL 17.6.1.155.
- [x] Refreshed the live migration inventory: 310 rows through `20261110150618`; direct comparison against the canonical 87 required exact release versions found 0/87 exact IDs. This is an identity mismatch, not proof that all physical effects are absent; aliases and schema/function/ACL/RLS effects must be separately reconciled.
- [x] Re-read deployed Edge source. `catalog-admin` v20 still derives platform-root scope from membership role/permissions and does not use current-main `mnty_can_platform_admin()`. It does manually validate a bearer token and reject anonymous users.
- [x] Verified shared `public-contact-visibility.mjs` parity for `public-catalog` v11 and `public-catalog-directory` v20; verified `promotional-images.mjs` parity for `public-catalog-directory` v20. Their deployed entrypoints are not byte-identical to current main, so full Edge parity remains unverified.
- [x] Confirmed `directory-listings` v18 remains deliberately fail-closed: GET returns an empty result with `directoryDisabled=true`, POST returns 503 `DIRECTORY_LISTINGS_DISABLED_FOR_V1`.
- [x] Refreshed Supabase Advisor snapshots: Security 166 findings (157 WARN, 9 INFO); Performance 600 findings (403 WARN, 197 INFO). Each warning is a triage signal; no bulk ACL/policy/index action was taken.
- [x] Recorded evidence and release disposition in [docs/audits/PRODUCTION_READ_ONLY_RECHECK_20261127.md](audits/PRODUCTION_READ_ONLY_RECHECK_20261127.md) and `docs/release/production-migration-reconciliation.json`.
- **Non-actions:** no Production SQL write, migration, Auth setting, GRANT/RLS/policy change, Edge deployment, Storage write, payment, wallet, settlement, or customer/business-data mutation.
- **Release status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.



### Direct PostgreSQL authorization read-back — 2026-11-27 02:43 UTC

- [x] Queried live function definitions, function ACLs, RLS flags, and policy dependencies using read-only catalog SQL.
- [x] Confirmed `private.platform_admins` has RLS enabled but FORCE RLS disabled.
- [x] Confirmed `public.is_platform_admin()` remains SECURITY INVOKER and derives global authority from any ACTIVE membership role ADMIN/SUPER_ADMIN; anon EXECUTE=false, authenticated EXECUTE=true.
- [x] Confirmed `public.mnty_can_platform_admin()` remains SECURITY DEFINER and delegates to `public.mnty_can('admin', NULL, NULL, NULL)`; anon EXECUTE=false, authenticated EXECUTE=true.
- [x] Counted 57 `is_platform_admin()` policy references across 24 tables and five `mnty_can_platform_admin()` references across three tables. The sets may overlap; do not treat them as distinct table totals.
- [x] Confirmed orders and order_status_history have RLS and FORCE RLS enabled, but the RC929 strict confirmed-Auth restrictive policies are not live. `public.directory_listing_contact_consents` is absent.
- **Release implication:** the root-helper/policy sequence has a broad authorization blast radius. Do not hot-replace helpers or bulk-rewrite policies; require coordinated migrations and adversarial positive/negative tests.
- **Non-actions:** read-only SQL only; no Production database, migration ledger, Auth, GRANT, RLS, Edge, payment, wallet, settlement, or business-data write.

### Platform-root authorization semantics and source repair sequence — 2026-11-27 02:46 UTC

- [x] Read the live definitions of mnty_active_membership, mnty_can, and mnty_can_platform_admin. With all scope arguments NULL, mnty_active_membership returns ACTIVE memberships across all tenants; mnty_can('admin',NULL,NULL,NULL) explicitly treats OWNER and ADMIN roles as admin-capable.
- [x] Confirmed the live mnty_can_platform_admin() delegates to that generic evaluator rather than private.platform_admins. A tenant OWNER/ADMIN can therefore satisfy this named platform-root helper without a registry row.
- [x] Confirmed live is_platform_admin() checks any ACTIVE ADMIN/SUPER_ADMIN membership with no tenant/business/branch predicate; 57 RLS policy references across 24 tables use this helper, often as an OR branch. Classified this as a CRITICAL/P0 source-derived cross-tenant authorization risk; no user impersonation or data-access exploit was attempted.
- [x] Verified that corrective source migrations already exist: RC464 (20261113214500), RC471 (20261117190000), RC484 (20261119040000), RC485 (20261120200000). RC464/RC471 repair the private-registry MantiGO platform guard and callers; RC484 repairs the 57-policy is_platform_admin helper; RC485 aligns seven catalog RPCs while preserving tenant-local scope.
- [ ] Keep this entire migration sequence blocked until the required chronological release, physical preflight, backup/restore/rollback gates and negative/positive PostgreSQL tests all pass. Do not create duplicate migration IDs or hot-patch Production.
- **Non-actions:** read-only SQL and source review only; no Production table/function/policy/ACL changes, no migration application, no Edge deployment, no customer/business-data changes.

### RC464 / RC484 / RC485 read-only preflight matrix — 2026-11-27 02:50 UTC

- [x] RC464/RC484 catalog prerequisites observed: private.platform_admins exists, RLS enabled, owner postgres with BYPASSRLS, user_id UUID NOT NULL, no direct anon/authenticated table grants.
- [x] RC464 expected callers/policies observed: four MantiGO global SECURITY DEFINER signatures, four additional helper-dependent SECURITY DEFINER callers, and three shared-helper RLS policy contracts present.
- [x] RC484 blast radius observed: 57 is_platform_admin policy references across 24 tables; helper owner matches registry owner and has BYPASSRLS.
- [x] RC485 precondition remains BLOCKED until RC484 replaces is_platform_admin(): live helper remains SECURITY INVOKER, search_path=public and membership-derived.
- **Boundary:** These are catalog preflight observations only, not migration execution. Preserve RC464 → RC471 → RC484 → RC485 inside the complete chronological release; do not run them individually.

## Main Pages deployment after Super Admin overview — 2026-11-27 02:52 UTC

- [x] Confirmed the post-merge GitHub Pages deployment for main commit `7cb8e96ae1bf6a739039c0ec0e8673d0025ef4cb` completed successfully (workflow run [45930249106](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45930249106)).
- [x] Deploy job completed successfully after deployed-origin checks, including the legacy catalog root and dashboard/mobile/QR routes.
- [x] Main Primary Catalog Frontend Validation run [45930249165](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45930249165) completed successfully: build, professional dashboard browser E2E and employee-RBAC PostgreSQL job passed.
- **Scope:** website/Pages verification only. It does not close the separate Supabase migration, Edge Function authorization/parity, database ACL/RLS, privacy, finance, backup/restore, or rollback gates.

