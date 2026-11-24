# MantiqatiX — Master Execution TODO | Zero-Cost Fast Track
**Updated:** 2026-11-24 — P0.1/P0.2 read-only Production policy and ACL reconciliation  
**Base:** `main @ bc4f6e2ce3560d5c3a9b4fd7a4c7f807fa06af00`  
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
- [x] RC925 merged in PR #1069 as source-only commit `a0a31dab110ac519f8528cbefe74c0eefb727a7c`. All seven catalog RPCs now fail closed unless `is_anonymous=false`; missing/null claims are denied. Exact-head static validation, missing-claim PostgreSQL 17 integration and 82-version chronological replay passed in `45477345349`; module validation passed in `45477345380`; catalog build, RBAC PostgreSQL and dashboard browser E2E passed in `45477345161`. Positive `is_anonymous=false` compatibility coverage for all seven RPCs was added and merged in PR #1071 as `53b8be3784790e56775f16bb51c9c3477cfeb536`; all exact-head workflows passed (runs `45480436807`, `45480436782`, `45480436843`, `45480436853`, `45480436991`, `45480437044`). Production remains unchanged and RC925 is NOT applied.
- [x] Confirmed RC923's current source/integration contract checks all seven direct catalog RPCs for anonymous Auth sessions; exactly three RPC bodies are replaced by RC923, while the other four already guard anonymous sessions.
- [x] Reconcile live is_platform_admin() and mnty_can_platform_admin() with RC464, RC471, RC484, RC485 and RC923 source; exact 57-policy/24-table RC484 dependency map and four direct helper callers verified read-only. Evidence: docs/audits/P0_ANONYMOUS_AUTH_STORAGE_LIVE_RECHECK_20261124.md.
- [x] RC484's post-migration test now asserts registry FORCE RLS and registry/helper owner parity with BYPASSRLS; exact PR-head PostgreSQL 17 run `45390294342` passed (PR #1040 merged).
- [x] PR #1049 widened the RC471/R7 actor matrix to reject tenant-scoped SUPER_ADMIN and MNTY-PLATFORM membership without registry across all four helper callers; exact-head run 45396407812 passed. PR merged as main commit 1b27efb65e32a254e34a7ae9add172de078e6fdf (31 successful checks, 2 skipped; no failures).
- [x] Complete the prior ordered migration set on disposable PostgreSQL 17 using repo CI. Exact-head run 45407602805 passed the checkpoint restore, exact 80-version gate, 117 chronological forward migrations and integration suite; this is disposable-only and does not replace Production backup restore or physical-object reconciliation.
- [x] RC924 ordered authorization and agreement participant scope merged in PR #1064 as `82cdebcdefc4a9c12d4e875548f1cf5f5dd3f896`; dedicated PostgreSQL 17 run `45458313302` and full 117-migration chronological replay `45458313389` passed. The replay's strict static gate still asserted 80 versions; it is not evidence for the updated 81-version count.
- [x] Re-ran the exact 81-version strict release validator and full PostgreSQL 17 forward replay on PR #1066: workflow run `45465702093` passed all static release validators, restored the captured schema checkpoint, and applied 117 later migrations in timestamp order, including RC924. This is disposable-only evidence; it does not replace Production backup/restore or physical-object reconciliation.
- [x] Test RC923 anonymous-session denial for all seven catalog RPCs on the prior chronological 80-version release-chain replay; RC485/RC923 integration marker passed in run 45407602805.
- [x] Test RC924 against the pre-RC482 Legal helper and confirm ordered RC482 → RC924 application in isolated PostgreSQL 17; RC924-specific job `45458313302` passed.
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
- [x] Refresh the ordered mainline release manifest (82 identifiers including RC925 at the 2026-11-24 checkpoint) and compare it with Production's 310-row migration ledger: 0/82 exact source-version identifiers are present; physical-object aliases/effects still require reconciliation.
- [x] Refreshed all 76 previously tracked physical object contracts against Production on 2026-11-24 (tables, indexes, functions, columns, triggers): 35 present / 41 absent, zero status changes since the 2026-11-20 snapshot. Breakdown is in `docs/audits/PASS_2091_2100_PHYSICAL_OBJECT_REFRESH_20261124.md`.
- [x] Added a focused live physical-effect sample: 18 relations (13 present / 5 absent), 12 indexes (3 present-valid / 9 absent), 17 columns (2 present / 15 absent), and 15 function families (11 absent / 4 present but contract-blocked). This is a timestamped 81-version pre-RC925 snapshot, not the full 82-version crosswalk. See `docs/audits/PASS_2161_2170_CURRENT_81_MIGRATION_PHYSICAL_EFFECT_RECHECK_20261124.md`.
- [x] Confirmed three exact source-to-ledger SQL aliases by byte comparison and classified five historic baseline families as partial; no ledger repair or SQL replay occurred. See `docs/audits/PASS_2171_2180_HISTORICAL_MIGRATION_ALIAS_AND_PARTIAL_EFFECT_RECONCILIATION_20261124.md`.
- [ ] Complete classification of all 82 required migrations by physical effect: exact-present, alias/effect-present, safe-to-replay, superseded/forward-fixed or blocked. Three exact aliases and five partial historic baselines are known; full crosswalk remains outstanding.
- [ ] Complete the broader migration→physical effect/alias map beyond these 76 contracts: reconcile all remaining functions, policies, ACLs, indexes, triggers and constraints; 0/82 exact ledger matches is not proof all effects are absent.
- [x] Run full chronological forward replay from the captured Production schema checkpoint; exact-head run 45407602805 passed after 117 forward migrations and ordered integration jobs. This is not a live Production restore/deployment.
- [ ] Never blindly replay the release chain on Production.

### P1.2 Edge parity
- [x] Completed a read-only entrypoint comparison for 11 launch-relevant Edge Functions; 9 critical entrypoints differ from current main and 2 public-catalog entrypoints match. Audit: `docs/audits/PASS_2051_2060_EDGE_SOURCE_PARITY_20261124.md`.
- [x] Read-only direct import graph and Production SQL/RPC/table/ACL snapshot completed for nine critical Edge functions; see `docs/audits/PASS_2061_2070_EDGE_DEPENDENCY_CLOSURE_20261124.md`.
- [x] Refreshed deployed Edge parity: 9 launch-critical deployments differ from main; deployed payment-intent, subscription-payment-intent, settlement-financial-atomic and directory-listings bundles omit local mainline modules. Keep affected endpoints fail-closed. See `docs/audits/PASS_2151_2160_LIVE_EDGE_BUNDLE_RECHECK_20261124.md`.
- [x] Completed transitive local import traversal across nine critical Edge entrypoints: 11 local edges/modules, one additional transitive edge and zero cycles. External dependency resolution and compiled bundle parity remain NOT VERIFIED; no Deno lockfile found. See `docs/audits/PASS_2191_2200_EDGE_TRANSITIVE_LOCAL_IMPORT_CLOSURE_20261124.md`.
- [ ] Complete external import-map/dependency lock, compiled bundle hashes, function-body, grant and SQL/RPC dependency closure; no individual deployment before the full dependency slice passes.
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
- Live migration ledger: 310 entries through `20261110150618`; the current 82-version source manifest has 0/82 exact version identifiers recorded. This is an identity gap, not proof all physical effects are absent; aliases and actual catalog state still require per-object reconciliation. PR #1066 exact-head isolated replay passed run `45465702093`; Production remains unchanged and the exact source-version identity gap still needs physical-effect reconciliation.
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
- [x] Rechecked the 82-version exact migration ledger set (0/82 exact IDs), both live platform-root helpers, 57/24 and 5/3 policy dependencies, four SECURITY DEFINER callers, and all seven catalog RPC guard/ACL/search_path states.
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


## 2026-11-24 — RC925 exact-head verification and source merge
- [x] PR #1069 merged source-only after all its exact-head CI workflows completed successfully; merge commit `a0a31dab110ac519f8528cbefe74c0eefb727a7c`.
- [x] Exact 82-version strict gate, captured-checkpoint PostgreSQL 17 chronological replay, RC925 static validator and missing-claim adversarial integration passed in run `45477345349`.
- [x] Catalog build, employee RBAC PostgreSQL suite and dashboard browser E2E passed in run `45477345161`; module professionalization validation passed in `45477345380`.
- [x] Production migration ledger re-read remains 310 rows through `20261110150618`; RC925 has not been applied. No Production DB, Auth, RLS, GRANT, Storage, Edge, payment, settlement or business data was modified.
- [ ] Continue the P0/P1 release queue: full migration-to-physical-effect/alias crosswalk, live authorization gaps, Edge bundle/dependency parity, and owner-controlled backup/restore with measured RPO/RTO.


## 2026-11-24 — Live Production evidence preservation
- [x] Preserved eight read-only live Production audit reports in `docs/audits/PASS_2111_2120` through `PASS_2181_2190`, covering Legal, catalog RPC, provider profile/Storage/finance, directory consent, deployed Edge parity, physical effects, migration aliases and payment/MantiGO/medical contracts.
- [x] Confirmed the focused physical sample is incomplete and does not replace the 82-migration crosswalk. Exact version gaps are not proof that all physical effects are absent.
- [x] Preserved transitive local Edge import analysis; external dependency resolution and compiled bundle parity remain unverified. No local cycles were found.
- [ ] Continue full 82-migration physical-effect/alias mapping and coordinated DB/Edge dependency planning before any Production write.


## 2026-11-24 — Fresh 76-object Production physical-contract read-back
- [x] Rechecked the 76 physical-object contracts in the curated release register directly against live PostgreSQL catalogs: 35 physically present / 41 absent. Breakdown: tables 5/7, indexes 6/13, columns 2/12, function entries 22/41, triggers 0/3. Evidence: `docs/audits/PASS_2201_2210_PHYSICAL_OBJECT_RECHECK_20261124.md`.
- [x] Rechecked the 22 matched function entries: 21 SECURITY DEFINER / 1 SECURITY INVOKER; 13 empty search_path / 9 non-empty; anon EXECUTE 0, authenticated EXECUTE 19, service_role EXECUTE 2. A name-only match is not treated as exact signature/body parity.
- [x] Reconfirmed key present-but-blocked objects: `private.platform_admins` FORCE RLS remains off; `public.is_platform_admin()` remains SECURITY INVOKER/search_path=public and membership-derived; `public.mnty_can_platform_admin()` remains SECURITY DEFINER/search_path=public, pg_temp.
- [x] Reconfirmed Production ledger at 310 rows through `20261110150618`; no database, ACL, RLS, Auth, Storage, Edge, payment or business-data write occurred.
- [ ] Expand the curated 76-object sample into the full physical-effect/alias map for all 82 required source versions, including every policy, constraint, trigger, overload and transitive Edge dependency.


## 2026-11-24 — RC425–RC432 payment and wallet live contract recheck
- [x] Compared eight exact source migrations with live PostgreSQL signatures, objects, RLS, search_path and effective ACLs. RC425 table/RPC absent; RC426 finalizer overload absent although both provider_order_id columns exist; RC427 active-intent unique index absent; RC428/429/430 exact webhook processors absent; RC431 function exists but has non-empty search_path; RC432 unique index and admin-credit RPC absent, with existing debit/refund routines on search_path=public. Evidence: `docs/audits/PASS_2211_2220_RC425_RC432_LIVE_CONTRACT_RECHECK_20261124.md`.
- [ ] Continue the source-to-live map through RC434–RC439 and the remaining 82-version migration set; keep payment and wallet writes blocked.


## 2026-11-24 — RC434–RC441 ERP, subscription, journal and platform-scope live recheck
- [x] Compared RC434–RC441 source effects with Production: RC434 atomic receiving RPC absent; RC435 subscription claim-state columns/constraint and both claim RPCs absent; RC436 five journal columns, two unique indexes and atomic posting RPC absent; RC437 purchase-order lines table, two indexes, member-read policy and line RPCs absent; RC438 order-creation RPC absent while legacy status RPC is present but has wrong search_path/ACL; RC439 all three encrypted-secret columns absent.
- [x] Reviewed RC440 as a dynamic historical migration: its source targeted functions with exact `search_path=public` at its own execution timestamp. Current read-only snapshot has 30 exposed public SECURITY DEFINER routines matching that predicate (0 anon-executable, 30 authenticated-executable); this is not retroactive evidence that all 30 existed at RC440 execution time.
- [x] Rechecked RC441: all five named routines exist but retain legacy non-empty paths and do not satisfy the source's explicit MNTY-PLATFORM SUPER_ADMIN boundary. Evidence: `docs/audits/PASS_2221_2230_RC434_RC441_LIVE_CONTRACT_RECHECK_20261124.md`.
- [ ] Continue through RC442–RC453 and then reconcile the later 82-version hardening migrations against their exact live physical/body/ACL/RLS effects.


## 2026-11-24 — RC442–RC451 approval, CRM, matrimony and journal live recheck
- [x] RC442 private approval RPC exists but still uses search_path=public, pg_temp; authenticated retains direct approval_actions DML and the old member INSERT policy remains.
- [x] RC444 live CRM manager SELECT policies are broader than the source's matching-business or explicit MNTY-PLATFORM/full_control boundary. marketing_provider_profiles also retains its separate public ACTIVE whole-row read surface tracked under RC479/#928.
- [x] RC447 matrimony discovery/unlocked-contact functions, private verification guard and trigger are absent; the live matrimony profile SELECT policy is not owner-only. RC448 has one unlock-per-request unique index, but active-pair index and four exact lifecycle/contact RPCs are absent; direct authenticated request/unlock DML remains granted.
- [x] RC449 helper and four administrative functions remain present but on old unscoped helper/non-empty search_path contracts. RC449A seven journal columns and running-balance index absent. RC450 posting function exists but lacks service_role EXECUTE and uses wrong path; trigger exists. RC451 targeted ads RPC meets empty-path public read contract and must remain anon-accessible.
- [x] Evidence: `docs/audits/PASS_2231_2240_RC442_RC451_LIVE_CONTRACT_RECHECK_20261124.md`.
- [ ] Continue through RC452–RC453 and then the remaining later 82-version hardening migrations.


## 2026-11-24 — RC452–RC453 CRM and marketing campaign live recheck
- [x] RC452 CRM policies remain broader than the source's matching-business or explicit MNTY-PLATFORM full_control rules. The separate public ACTIVE provider profile base-table read remains tracked under RC479/#928.
- [x] RC453 internal marketing campaign feature is absent from Production: both campaign tables, all four indexes, and five exact RPC signatures are absent. The source describes an internal workflow only, not an external Meta/TikTok/Google publishing integration.
- [x] Evidence: `docs/audits/PASS_2241_2250_RC452_RC453_CRM_CAMPAIGNS_LIVE_RECHECK_20261124.md`.
- [ ] Keep CRM scope and campaign features gated until the ordered migration, RLS, RPC, UI and deployed-origin contracts are verified.


## 2026-11-24 — Latest current-main security audit chain and remaining RC485–RC925 checks
- [x] Current-main Pass 2291–2300 covers RC446, RC456, RC463 and RC525; it confirms RC463's trigger-only ACL effect is present but one function path remains public/auth, RC446 open-ride eligibility gates and RC456 service-role gateway grants remain blocked, and RC525 platform product policy remains membership-derived.
- [x] Current-main Pass 2301–2310 covers RC464–RC470; registry root, exact order/branch scopes, commission preview path, payment finalizer and webhook forward repair remain blocked/partial.
- [x] Current-main Pass 2311–2320 covers RC471–RC478; MantiGO root, directory consent, Paymob processors, captain earnings ledger fields, bid contact privacy and open-ride eligibility remain blocked.
- [x] Current-main Pass 2321–2330 covers Qadam seed and RC479–RC483; Qadam's idempotency-key seed effect is present though its exact migration ID is not in the ledger; raw provider-profile/digital-page anonymous reads and Legal service grants/registry/atomic RPCs remain blocked.
- [x] Additional current Production read-back: Pass 2331–2340 `docs/audits/PASS_2331_2340_RC484_RC496_PLATFORM_CATALOG_AUTH_STORAGE_FINANCE_RECHECK_20261124.md` and Pass 2341–2350 `docs/audits/PASS_2341_2350_RC921_RC925_MEDICAL_AGREEMENTS_CATALOG_RECHECK_20261124.md` are linked below. Pass 2281–2290 is already assigned to the existing RC102–RC106 order/provider report.
- [ ] Keep SMM first-user bootstrap, confirmed-Auth boundaries, global Platform Admin, settlement, MantiGO bid acceptance, medical provider state, agreement participant scope and RC925 catalog RPCs blocked until coordinated release and deployed-origin tests pass.


## 2026-11-24 — PASS 2271–2280 RC113–RC117 Control Center and employee live recheck
- [x] RC113/114 tables (4/4) present with RLS+FORCE RLS and no direct client/service-role CRUD privileges. Six role/employee indexes are valid; only the RC113 NULL-safe membership index is absent.
- [x] Thirteen Control Center/employee RPC signatures are present as SECURITY DEFINER, postgres-owned, empty search_path, anon EXECUTE=false, authenticated=true, service_role=false. Ten platform-admin routines reference the private registry; employee RPCs retain their own business-member scope.
- [x] RC117 default-image URL function, three trigger functions, three attached triggers and `marketing_services.image_url/image_source` columns are absent. Business/catalog image metadata is stored in JSON, not separate columns.
- [x] Evidence: `docs/audits/PASS_2271_2280_RC113_RC117_CONTROL_CENTER_EMPLOYEE_LIVE_RECHECK_20261124.md`.
- [ ] RC117 default-image automation and the RC113 NULL-safe membership uniqueness index remain release blockers.
