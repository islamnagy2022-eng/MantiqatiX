# MantiqatiX — Master Execution TODO | Zero-Cost Fast Track
**Updated:** 2026-11-24 — P0.1/P0.2 read-only Production policy and ACL reconciliation  
**Base:** `main @ 80cd991f6d591c42f77f58531de995d4e1ef2f3f`  
**Authority:** `docs/MASTER_SOURCE_OF_TRUTH.md` + `docs/SOURCE_OF_TRUTH_MAP_20261124.md`  
**Release gate:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

This is the active priority queue. Older Pass logs remain append-only evidence, not a competing work queue. Ordering is based on dependencies and work that can be completed without a paid Supabase branch or paid tooling.

## Execution rules
- Preserve the current catalog root, `/legacy/` rollback and existing production data. Do not replace current main with the R7 ZIP.
- Default to GitHub Actions disposable PostgreSQL 17 tests; do not create a paid Supabase branch.
- Production remains read-only until the relevant release gates pass. No unsanctioned DDL/DML, Auth, RLS, GRANT, Storage, Edge, payment or finance writes.
- Use focused tests for each changed slice. Re-run broader suites only when dependencies or source change.
- PASS is valid only for the exact tested commit. A skipped deploy job is not a deployment.
- Keep directory publication and Paymob fail-closed. Backup/restore is intentionally last, but remains a hard launch blocker.

## P0 — Authorization, identity and privacy
### P0.1 Platform-root authorization
- [x] Rechecked Production helper definitions, all dependent policy counts, helper callers, all seven catalog RPC ACLs and anonymous-session guards using read-only PostgreSQL catalog queries; see `docs/audits/PASS_2071_2080_P0_AUTHORIZATION_RECHECK_20261124.md`.
- [x] Confirmed RC923's current source/integration contract checks all seven direct catalog RPCs for anonymous Auth sessions; exactly three RPC bodies are replaced by RC923, while the other four already guard anonymous sessions.
- [x] Reconcile live is_platform_admin() and mnty_can_platform_admin() with RC464, RC471, RC484, RC485 and RC923 source; exact 57-policy/24-table RC484 dependency map and four direct helper callers verified read-only. Evidence: docs/audits/P0_ANONYMOUS_AUTH_STORAGE_LIVE_RECHECK_20261124.md.
- [x] RC484's post-migration test now asserts registry FORCE RLS and registry/helper owner parity with BYPASSRLS; exact PR-head PostgreSQL 17 run `45390294342` passed (PR #1040 merged).
- [x] PR #1049 widened the RC471/R7 actor matrix to reject tenant-scoped SUPER_ADMIN and MNTY-PLATFORM membership without registry across all four helper callers; exact-head run 45396407812 passed. PR merged as main commit 1b27efb65e32a254e34a7ae9add172de078e6fdf (31 successful checks, 2 skipped; no failures).
- [x] Complete the ordered migration set on disposable PostgreSQL 17 using repo CI. Exact-head run 45407602805 passed the checkpoint restore, exact 80-version gate, 117 chronological forward migrations and integration suite; this is disposable-only and does not replace Production backup restore or physical-object reconciliation.
- [x] Test RC923 anonymous-session denial for all seven catalog RPCs on the full chronological 80-version release-chain replay; RC485/RC923 integration marker passed in run 45407602805.
- [x] Test registered platform-admin allow; tenant ADMIN/OWNER/SUPER_ADMIN and MNTY-PLATFORM membership without registry deny; cross-tenant/business/branch denial; tenant-local scope preserved (RC484 run 45390294342, RC471/R7 actor matrix run 45396407812; companion exact-head module run 45407602698 passed).
- [x] Added an inactive tenant SUPER_ADMIN (INACTIVE membership with stale platform metadata) negative actor to the RC449 global MantiGO RPC matrix and RC464 shared-helper caller matrix; exact-head run 45411811229 and RC464 live-hardening run 45411811351 passed.
- [x] Re-ran the existing read-only high-risk SECURITY DEFINER SQL contract against Production: 14 RPCs checked; 5 PASS, 9 FAIL_SEARCH_PATH; all 14 preserve anon EXECUTE=false and authenticated EXECUTE=true. Direct anon/authenticated write grants on five MantiGO tables are both zero; see PASS_2071_2080.
- [x] Assert function ownership, empty `search_path`, grants, FORCE RLS and caller coverage in the RC464/RC471/RC484/RC485 suites; exact-head module and forward replay workflows passed.
- [ ] Prepare one coordinated migration bundle and post-release read-back. Do not hot-patch or apply it to Production in this phase.
**Live evidence:** Production still uses membership-derived helpers; registry RLS is on but FORCE RLS is false. See `docs/audits/PASS_2041_2050_LIVE_PRODUCTION_RECHECK_20261124.md`.

### P0.2 Anonymous Auth and private profile boundaries
- [x] Refreshed Advisor + live ACL snapshot: 90 anonymous-Auth table warnings, 9 RLS-no-policy tables with all client grants denied, 65 exposed authenticated SECURITY DEFINER functions (18 empty search_path, 47 other pinned, 0 unset); see PASS_2081_2090 and Issue #928.
- [x] Reconcile RC479 and RC488–RC495 against live policy and ACL state; 28 required restrictive guard policies are absent, raw anon profile SELECT and several authenticated-role grants remain, and RC494/RC495 have ordered root/schema dependencies. Evidence: docs/audits/P0_ANONYMOUS_AUTH_STORAGE_LIVE_RECHECK_20261124.md.
- [x] Run raw anon, anonymous Auth session, missing is_anonymous claim, confirmed user, owner/provider and platform-root cases across RC479, RC488–RC493, RC471/RC484/RC485; forward replay run 45407602805, module validation run 45407602698 and RC493 isolated run 45410089951 passed.
- [x] Preserve intentional public discovery and ad reads; RC479 raw anon profile-base grant removal is isolated from the public projection, RC488 preserves public profile-media SELECT, and no blanket privilege revocation was added.
- [ ] Keep leaked-password protection marked NOT AVAILABLE/NOT VERIFIED while the current plan does not expose the setting.

### P0.3 Directory and public-contact consent
- [x] Keep `directory-listings` fail-closed: verified Production v18 is a single-file stub; GET returns an empty page with `directoryDisabled=true` and POST returns 503. No unconsented rows are exposed through this endpoint.
- [x] Reconcile RC472/RC473 schema, owner grant/revoke/expiry source contract and deployed Edge bundle read-only. RC472 claim-review RPC and null-safe membership index are absent; RC473 contact-consent table is absent; current deployed Edge v18 has only `index.ts` and is fail-closed. Evidence: `docs/audits/P0_3_DIRECTORY_CONSENT_LIVE_RECHECK_20261124.md`.
- [x] Verified the current non-doctor publication contract is an explicit allowlist: business, clinic, pharmacy, medical_center, hospital, laboratory and health_provider; unknown/missing types fail closed. The doctor-profile republication evidence gate is distinct and has 0 approved rows. Contact fields remain separately gated by RC473 scope consent. Do not expand the allowlist without separate review.
- [x] Current-source/isolated tests cover no-consent, revoked-consent and explicitly consented field-by-field public projections; phone, address and precise location require their individual consent scopes. These are source/isolated tests, not deployed-origin evidence.
- [ ] Deploy DB + Edge only as a coordinated versioned unit after exact-head CI, source-rights evidence, encrypted backup/restore and deployed-origin negative/positive tests.
**Live evidence:** 869 listings are marked PUBLISHED and contain phone/address data, but deployed Edge v18 returns an empty fail-closed page. The RC473 registry is absent; source-rights evidence registry exists with zero rows.

## P1 — Database and backend contracts
### P1.1 Migration reconciliation
- [x] Refresh the ordered mainline release manifest (80 identifiers at the 2026-11-24 checkpoint) and compare it with Production's 310-row migration ledger: 0/80 exact source-version identifiers are present; physical-object aliases/effects still require reconciliation.
- [x] Refreshed all 76 previously tracked physical object contracts against Production on 2026-11-24 (tables, indexes, functions, columns, triggers): 35 present / 41 absent, zero status changes since the 2026-11-20 snapshot. Breakdown is in `docs/audits/PASS_2091_2100_PHYSICAL_OBJECT_REFRESH_20261124.md`.
- [ ] Classify every migration by physical effect: exact-present, alias/effect-present, safe-to-replay, superseded/forward-fixed or blocked.
- [ ] Complete the broader migration→physical effect/alias map beyond these 76 contracts: reconcile all remaining functions, policies, ACLs, indexes, triggers and constraints; 0/80 exact ledger matches is not proof all effects are absent.
- [x] Run full chronological forward replay from the captured Production schema checkpoint; exact-head run 45407602805 passed after 117 forward migrations and ordered integration jobs. This is not a live Production restore/deployment.
- [ ] Never blindly replay the release chain on Production.

### P1.2 Edge parity
- [x] Completed a read-only entrypoint comparison for 11 launch-relevant Edge Functions; 9 critical entrypoints differ from current main and 2 public-catalog entrypoints match. Audit: `docs/audits/PASS_2051_2060_EDGE_SOURCE_PARITY_20261124.md`.
- [x] Read-only direct import graph and Production SQL/RPC/table/ACL snapshot completed for nine critical Edge functions; see `docs/audits/PASS_2061_2070_EDGE_DEPENDENCY_CLOSURE_20261124.md`.
- [ ] Complete transitive import-map, function-body, grant and full dependency closure; no individual deployment before the full dependency slice passes.
- [ ] Hash/compare the launch-critical active Edge bundles against current main and their SQL/RPC/ACL prerequisites.
- [ ] Prioritize platform/catalog admin, consent-aware directory, registration, order-create, Paymob webhook/payment intent, subscription payment, financial journal and settlement.
- [ ] Maintain a dependency map: migration → schema/RPC/ACL → Edge version → E2E.
- [ ] Keep affected endpoints fail-closed until the complete dependency slice passes.

### P1.3 Auth, realtime and offline
- [ ] Verify Google OAuth callback, session refresh, logout and recovery against current Auth configuration.
- [ ] Test Realtime and offline conflict/idempotency only for shipped flows.
- [ ] Mark unavailable settings and untested providers NOT VERIFIED.

## P2 — Core public site (zero-cost code and CI)
- [ ] Verify root, `/legacy/`, direct route refresh, 404/error/empty/loading states and mobile/desktop layouts.
- [ ] Preserve Activity → Specialty, all-Egypt default search, GPS nearest-first only with permission, and 20-item pagination + See More.
- [x] Merged SEO-only PR #1033 at `34a072312b29e613fb95a39050bb499eedabc786`; exact-head CI 34/34 passed, including the route metadata contract. Pages deployment is verified by run 45413600172 (main @ 016a8952513ac860b9248c6b561e6cf9216c3f2e): production root, /legacy rollback, /v6-preview, brand assets, and deployed-origin browser E2E passed. Scope is SPA metadata plus a root-only sitemap; no SSR/prerender or dynamic catalogue sitemap is claimed.
- [ ] Keep storefront gallery PR #978 draft until rebased and proven compatible with live catalog-admin/public-catalog contracts.
- [x] Merged Marketing button regression PR #1032 at `f317a69fe186da7bff560657e161951e8794e81f`; Playwright verified the official persisted business UUID at 390px and 1440px with no horizontal overflow.
- [ ] Verify logo, cover, favicon, PWA/install icon and Open Graph assets against the existing brand source.

## P3 — Accounts, partners and Li2Lak
- [ ] Test registration → company review → activity/specialty → branch → product with synthetic CI identities.
- [ ] Rebase Li2Lak PR #971 on current main; reconcile RC497/RC498 with RC922 and refresh the release manifest.
- [ ] Require exact-head PostgreSQL 17 review lifecycle, authenticated order RPC, idempotency race, full replay, frontend build and RBAC tests before merge.
- [ ] Keep Paymob disabled/fail-closed until amount binding, signed webhooks, duplicate protection, failure/refund and reconciliation pass in Sandbox.
- [ ] Verify merchant/customer views deny cross-business orders and private customer data.

## P4 — Commercial and finance
- [ ] Inventory existing subscription, commission, wallet, inventory and accounting contracts; implement only missing pieces.
- [ ] Keep subscription, commission, ads, marketing services and fixed referral fees separate.
- [ ] Test commission snapshots/idempotency, cancellations/returns and journal invariants with fixtures.
- [ ] Do not enable live Paymob, real payouts or cash settlement in this phase.
- [ ] Keep legal/tax templates and invoice rules pending qualified Egyptian legal/accounting review.

## P5 — Release candidate quality
- [ ] Exact-main TypeScript, lint, frontend build, dependency/security audit and source-contract tests.
- [ ] Focused PG17 tests for each changed module; E2E for public/customer/merchant/admin critical journeys.
- [ ] Responsive/accessibility smoke tests and measured performance checks.
- [ ] Verify launch-critical Edge health and source/database parity.
- [ ] Check canonical links, SEO metadata, sitemap/robots and broken routes.
- [ ] Produce a candidate manifest: commit, exact CI runs, Edge versions, migration status and unresolved exceptions.

## P6 — Recovery and launch (last, as requested)
- [ ] Create encrypted owner-controlled off-site DB backup and separate Storage object export; verify hashes and retrieval.
- [ ] Prove Auth users/identities coverage, Storage metadata/object bytes, Edge/config/extensions and Vault/key recovery.
- [ ] Restore into a disposable PostgreSQL 17 environment; test rollback and measure RPO/RTO.
- [ ] Prefer a local/owner-controlled zero-cost restore path. No paid Supabase branch is assumed.
- [ ] Re-run migration reconciliation against the backup and confirm the forward/rollback plan.
- [ ] After approval, release the coordinated DB + Edge set in a controlled window and run deployed-origin security/privacy/payment smoke tests.
- [ ] Mark FULL_PLATFORM_GATE PASS only with evidence for every mandatory item; otherwise retain BLOCKED / NOT CERTIFIED.

## Current factual blockers
- Live migration ledger: 310 entries through `20261110150618`; the current 80-version source manifest has 0/80 exact version identifiers recorded. This is an identity gap, not proof all physical effects are absent; aliases and actual catalog state still require per-object reconciliation.
- `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public` and derives platform-wide authority from active tenant ADMIN/SUPER_ADMIN membership; 57 policies across 24 tables reference it.
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp` and delegates to unscoped `mnty_can('admin',NULL,NULL,NULL)`; 5 policies across 3 tables and four SECURITY DEFINER callers depend on it.
- Existing read-only high-risk SECURITY DEFINER contract: 9/14 expected search_path states fail in live Production (all 14 have anon EXECUTE=false and authenticated EXECUTE=true); the nine include the platform helper, four global-admin callers, and four MantiGO dashboard/settlement paths. No direct anon/authenticated write grants exist on five MantiGO core tables.
- `private.platform_admins` has RLS enabled but FORCE RLS=false. The registry-backed forward migrations and seven-RPC RC485/RC923 contract are not applied to Production.
- Of the seven direct catalog RPCs, four live definitions contain an anonymous-Auth guard and three (item upsert, price upsert, item-status update) do not. All seven deny direct `anon` EXECUTE but permit `authenticated` EXECUTE; all seven remain `search_path=public`.
- Directory consent registry and source-permission evidence are absent; the directory endpoint remains fail-closed.
- Supabase Auth leaked-password protection is disabled; 47 of 65 authenticated-callable SECURITY DEFINER functions still have non-empty search_path (30 public, 17 public, pg_temp); 0 are unset. Prioritize 17 public, pg_temp entries and the P0 mnty_can_platform_admin() helper; targeted review only, not blanket changes.
- Some critical Edge Functions are behind current-main contracts.
- Independent encrypted backup/restore, Auth/Vault coverage and measured RPO/RTO are not verified.
- Li2Lak candidate has prior successful partial checks, but its latest source requires complete exact-head test evidence after rebasing; Paymob remains fail-closed.

## Latest verified status — 2026-11-24
- [x] Zero-cost execution board is merged and remains the active priority queue.
- [x] Marketing button responsive routing regression merged and verified.
- [x] SEO-only route metadata/canonical-root guard merged; exact-head CI passed 34/34. Main Pages deployment is verified by run 45413600172; catalog root, /legacy rollback, /v6-preview and deployed-origin browser E2E passed. This is catalog-pilot deployment only, not full platform certification.
- [x] Live Edge entrypoint comparison recorded; 9 critical mismatches remain and no Edge deployment was made.
- [x] Live P0 authorization and seven catalog-RPC contracts rechecked read-only on 2026-11-24; exact evidence in `PASS_2071_2080`.
- [x] Anonymous Auth/SECURITY DEFINER Advisor snapshot refreshed read-only; 9 no-policy tables have no client grants, 47 exposed authenticated definers still use non-empty pinned search paths; full policy test matrix remains open under #928.
- [x] PR #1049 merged after exact-head 31-success / 2-skipped CI; dedicated R7 PostgreSQL 17 helper-caller test passed and forward-chain replay passed. Main merge commit: 1b27efb65e32a254e34a7ae9add172de078e6fdf.
- [ ] Continue per-object migration/alias reconciliation and exact Production schema-vs-source object mapping, then review Li2Lak/gallery candidate PRs.
- [ ] Backup/restore remains the final work stage and a hard release blocker.

## This session
- [x] Re-read the uploaded owner directive and verified ZIP integrity and SHA-256; R7 remains reference-only.
- [x] Reconfirmed Production project identity, 310 migration records, 42 ACTIVE Edge Functions and current advisors without production writes.
- [x] Re-read live authorization definitions and measured 57 policies across 24 tables.
- [x] Verified existing historical RC464/RC484/RC922 test evidence; did not mislabel historical runs as current full release certification.
- [x] Completed a read-only direct dependency closure pass for nine critical Edge functions; no Production Edge or database changes.
- [x] Rechecked the 80-version exact migration ledger set (0/80 exact IDs), both live platform-root helpers, 57/24 and 5/3 policy dependencies, four SECURITY DEFINER callers, and all seven catalog RPC guard/ACL/search_path states.
- [ ] Next: await exact-head CI for PR #1049, then complete physical-object alias mapping and transitive Edge/SQL dependency closure.


## 2026-11-24 — P0.1/P0.2 read-only live reconciliation checkpoint
- [x] P0.1 helper, registry, policy blast-radius, helper-caller and ACL reconciliation complete. Live remains on membership-derived helpers; registry FORCE RLS is false, so source repair is not deployed.
- [x] P0.2 RC479/RC488–RC495 source-to-live policy/ACL/Storage reconciliation complete. RC479 confirmed-user SELECT guard is absent and raw anon SELECT remains; RC488 three Storage restrictive write guards are absent; RC489 15 finance restrictive read guards are 0/15; RC490 medical restrictive guard absent (and authenticated table SELECT is not granted); RC491 support guard absent; RC492 four InDrive guards absent; RC493 three CRM/notification guards absent; RC494 settlement RPC still has legacy search_path and is not registry scope hardened; RC495 branding Storage policies remain tenant-SUPER_ADMIN based and old filename pattern.
- [x] Exact-head PostgreSQL/JWT suites passed on PR #1057 head `2aa19b187024c47244b19db1131cfb867ba3f70b`: RC464/RC479 run 45413186145, PG17 parity run 45413185910, full forward replay run 45413186193, module validation run 45413186141, RC493 run 45413186167 and platform-admin scope run 45413187718. All required jobs succeeded; these are disposable/source tests only.
- [ ] Production remains read-only. Apply neither individual policy fixes nor Storage policy updates before encrypted backup/restore and the ordered RC464/RC471/RC479/RC484/RC485/RC488–RC495 dependency bundle is reconciled and approved.


## 2026-11-24 — P0 disposable test acceptance checkpoint
- RC924 agreement-read boundary passed PostgreSQL 17 in run 45407602669 on the feature branch.
- P0.2 source/live reconciliation is documented in docs/audits/P0_ANONYMOUS_AUTH_STORAGE_LIVE_RECHECK_20261124.md.
- Full forward replay and RC479/RC471/RC482/RC483 module validation passed on tested source head e9fa4e0a354ca6428d6d7e95e7ea46306180921d (runs 45407602805 and 45407602698).
- RC493 dedicated PostgreSQL 16 integration passed on audit branch head ecf8dd1242901a893a730dfd7aba8ae48df13815 (run 45410089951); validator now explicitly requires the migration to create RESTRICTIVE policies.
- Production source/ACL reconciliation still shows RC479/RC488–RC495 and platform-root fixes are not deployed. No Production writes, deployments, grants or data mutations occurred. FULL_PLATFORM_GATE remains BLOCKED / NOT CERTIFIED.


## 2026-11-24 — P0.1/P0.2 exact-head CI acceptance
- Branch head `7b585ba393ee076aabf04671ac9da21a69598f95` passed exact-head platform-admin scope run 45411811229, RC464 + RC479 run 45411811351, PG17 parity run 45411811012, full forward replay run 45411811582, module professionalization run 45411811026, RC493 run 45411811175, directory claim atomicity run 45411810983, financial journal/backend audit run 45411811536, MantiGO privacy run 45411811109 and RC425 atomicity run 45411811613. All required jobs succeeded; Pages validate passed but deploy and validate_public_only were skipped because this was a PR event, so no website deployment is claimed.
- The inactive tenant SUPER_ADMIN test was included in the above exact-head suite; old metadata does not restore global authority and the actor is denied on all covered global helper callers.
- Production remains read-only and live helpers/RLS/Storage guards remain uncorrected until the coordinated, backup-backed release. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## 2026-11-24 — P0.3 directory consent live recheck
- [x] Verified RC472 claim-review RPC and null-safe owner index are absent from Production; claim queue has one REVIEWING row (aggregate only).
- [x] Verified RC473 contact-consent table is absent and its migration ID is absent from the live ledger; source migration/test contracts were reviewed.
- [x] Verified directory_source_permission_evidence exists with RLS + FORCE RLS, service-role-only grants, and 0 total/approved evidence rows.
- [x] Verified public_directory_listings and directory_listing_claim_requests have RLS + FORCE RLS and no direct anon/authenticated SELECT; aggregate inventory is 965 total / 869 PUBLISHED / 87 DRAFT / 9 HIDDEN, with 568 published doctor rows.
- [x] Retrieved deployed Edge source: directory-listings v18, ACTIVE, verify_jwt=false, one file only, SHA-256 bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48; GET empty with directoryDisabled=true, POST 503. It does not return listing/contact rows.
- [x] Corrected the release manifest and validator from stale v16 live metadata to the current v18 fail-closed evidence.
- [x] Verified current source contract: non-doctor types use the explicit allowlist (business, clinic, pharmacy, medical_center, hospital, laboratory, health_provider); doctor republication uses the separate evidence registry, and all contact disclosure still requires the matching RC473 scope.
- [x] RC472 claim review atomicity/concurrency workflow passed on source head `2aa19b187024c47244b19db1131cfb867ba3f70b` (run 45413186008). RC473 contact-consent PostgreSQL integration, source contract, Edge type checks and catalog frontend lint/build passed on exact audit branch head `f37f21b6d11733a83d954d02029b4b775476b62b` (run 45447555248). Coordinated backup-backed DB + Edge release and deployed-origin tests remain pending; Production remains read-only.


## 2026-11-24 — Catalog pilot Pages deployment verified
- [x] Main push deployment run 45413600172 on commit 016a8952513ac860b9248c6b561e6cf9216c3f2e completed successfully. `CATALOG_PILOT_GATE=PASS`; the run explicitly recorded `FULL_PLATFORM_GATE=BLOCKED` and allowed only the scoped catalog frontend.
- [x] Public root deployed at https://islamnagy2022-eng.github.io/MantiqatiX/; /legacy/ rollback path and /v6-preview/ alias deployed and verified. First-party logo/cover assets passed root + preview checks.
- [x] Deployed-origin browser E2E passed: catalog/search pagination, marketing button at 390px/1440px, admin and employee role views, direct route refresh, QR/permanent links, GPS consent/manual fallback, storefronts, and axe checks with no critical/serious violations.
- [x] Deployment validation passed Google OAuth handshake, public catalog/Qadam storefront smoke, CORS, public sponsored ads contract, legacy directory-disabled guard and production catalog scope checks.
- [ ] Full platform remains BLOCKED / NOT CERTIFIED. No Supabase migration, Auth/RLS/GRANT, Storage, Edge Function, payment, webhook, settlement or partner-finance release was included in this Pages deployment.


## 2026-11-24 — PR #1057 P0.1/P0.2 exact-head verification
- [x] PR #1057 merged as `016a8952513ac860b9248c6b561e6cf9216c3f2e`; it contains read-only live audit evidence and disposable tests only, not Production security changes.
- [x] Exact-head run `2aa19b187024c47244b19db1131cfb867ba3f70b` passed RC464 platform-admin registry tests, PG17 parity, full forward migration replay, RC479/RC493/module suites and related isolation workflows. Live authorization/Storage policies remain unchanged and unrepaired.
- [x] Inactive tenant SUPER_ADMIN negative case is now covered against the shared platform helper and the four global MantiGO helper callers in the passing exact-head platform-admin suite.
