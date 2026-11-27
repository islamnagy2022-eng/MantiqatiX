# Autonomous Progress — MantiqatiX

**Updated:** 2026-11-27  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Verified main:** `db5f015ba2ada4e385f816215671f74b17fa338a`  
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

1. Confirm the post-merge Pages deployment and deployed-origin checks for main commit `9f6824750ab21bb754ad0c0253732f9b49919c64`, which includes the gallery viewer.
2. Continue the coordinated Production authorization/migration release preparation; do not weaken the fail-closed migration gate.
3. Continue source-to-live physical-effect and alias reconciliation for all 87 required migrations; preserve the fail-closed gate.
4. Continue the coordinated platform-root sequence (RC464/RC469/RC471/RC484 and dependent policy/caller scope) with disposable PostgreSQL tests and exact production preflight evidence. Do not hot-edit Production helpers or bulk-rewrite policies.
5. Keep Production read-only until the entire migration chain, ACL/RLS, Edge parity, deployed-origin positive/negative tests, and verified backup/restore/rollback gates are complete.

**Non-actions:** no Production migration, Edge Function deployment, payment, wallet, settlement, Auth setting, Storage, or customer/business-data write was performed in this checkpoint.


## Main deployment closeout — 2026-11-27 02:37 UTC

- [x] Confirmed the post-merge GitHub Pages deployment for main commit `38f70c516110566e7a568f268abe45842b77342c` completed successfully (workflow run [45928869346](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45928869346)).
- [x] Deployment job completed its site composition, Pages artifact upload, GitHub Pages publish, production-root / legacy rollback / V6 Preview checks, and deployed-origin browser checks for catalog URLs and dashboard/mobile/QR routes.
- [x] This verifies the web/Pages deployment for the recorded main commit only. It does not certify Supabase migration application, Edge Function deployment parity, database authorization, payments, wallets, or full production readiness.
- [ ] Continue exact-head review of Super Admin fixes and overview work in PRs #1171 and #1172. Do not merge either until all required checks pass.
- [ ] Keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` until the separate live database migration, ACL/RLS, Edge, privacy, finance, backup/restore and rollback gates are satisfied.
- **Non-actions:** no Production database write, migration, Auth/RLS/GRANT change, Edge Function deployment, payment, wallet, settlement, or customer/business-data mutation was performed as part of the Pages deployment closeout.


## Consolidated project continuation — 2026-11-27 02:59 UTC

- [x] PR #1171 merged: Super Admin stale person selection and refresh-race fix. Exact-head build, dashboard browser E2E, Employee RBAC/PostgreSQL and companion checks passed.
- [x] PR #1172 merged: Super Admin overview is now the default platform-admin landing page with operational KPIs and nine section shortcuts; published-catalog KPI now requires explicit publication, ACTIVE operation and not frozen. Exact-head browser/build/RBAC checks passed.
- [x] PR #1173 merged: recorded the successful earlier GitHub Pages deployment.
- [x] PR #1175 merged as `036c6655b3796d649abd9e603c24f518f8ee361e`: Production Health Monitor now labels the protected Edge `/health` endpoint accurately. The current run [45931207565](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45931207565) succeeded but explicitly says **Edge /health NOT CHECKED** because `HEALTH_MONITOR_TOKEN` is missing; only the legacy anonymous DB read-only probe passed.
- [ ] Main Pages deployment for `036c6655b3796d649abd9e603c24f518f8ee361e` run [45931067591](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45931067591) had successful validation but deployed-origin browser route verification was still running at this snapshot.
- [x] Supabase read-only review has been recorded in `docs/audits/PRODUCTION_READ_ONLY_RECHECK_20261127.md`. Main manifest's current canonical required version list is **87**; direct live ledger comparison is 0/87 exact IDs out of 310 live rows. This is an ID gap, not proof all physical effects are absent.
- [x] Direct authorization read-back recorded the latent root-helper defect and the existing RC464 → RC471 → RC484 → RC485 source repair order. Aggregate-only current-state check found no non-registry active OWNER/ADMIN/SUPER_ADMIN and no `permissions.admin=true` overrides; no current unauthorized account/data access is claimed.
- [ ] PR #1176 (current-main version of Supabase read-only audit) must pass exact-head migration replay, Primary Catalog E2E/RBAC, privacy and module checks before merge.
- **Release status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`. No Production migrations, SQL writes, Auth/ACL/RLS changes, Edge deployments, payments, wallets, settlements, Storage or customer/business data were changed.
- **Owner action:** repository/project owner must configure `HEALTH_MONITOR_TOKEN` as a protected GitHub Actions secret to enable actual protected Edge /health monitoring. Do not paste secrets into chat or commit them.
