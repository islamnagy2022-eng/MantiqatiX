# MantiqatiX — Master Execution TODO | Zero-Cost Fast Track
**Updated:** 2026-11-24  
**Base:** `main @ 3e8bee5eff855ee903bab29fe3b6241d15cf2cbb`  
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
- [ ] Reconcile live `is_platform_admin()` and `mnty_can_platform_admin()` with RC464, RC471, RC484, RC485 and RC923 source.
- [ ] Test the ordered migration set on disposable PostgreSQL 17 using repo CI. Preserve the 57-policy / 24-table dependency map.
- [x] RC923 Anonymous Auth denial passed on `main` commit `751367f7ea6a7290e5c62bbff5f1979ee456dc20`: the full chronological 80-version replay and post-migration integration rejected Anonymous Auth on all seven catalog RPCs while preserving the RC486 price-serialization lock.
- [ ] Test registered platform admin allow; tenant ADMIN/OWNER/SUPER_ADMIN without registry deny; inactive membership deny; cross-tenant/business/branch deny; tenant-local access still works.
- [ ] Assert function ownership, empty `search_path`, grants, FORCE RLS and caller coverage in tests.
- [ ] Prepare one coordinated migration bundle and post-release read-back. Do not hot-patch or apply it to Production in this phase.
**Live evidence:** Production still uses membership-derived helpers; registry RLS is on but FORCE RLS is false. See `docs/audits/PASS_2041_2050_LIVE_PRODUCTION_RECHECK_20261124.md`.

### P0.2 Anonymous Auth and private profile boundaries
- [ ] Reconcile RC479 and RC488–RC495 against live policy and ACL state.
- [ ] Run PG17/JWT cases for raw anon, anonymous Auth session, confirmed user, owner and platform admin.
- [ ] Preserve intentional public discovery and ad reads; no blanket policy denial or privilege revocation.
- [ ] Keep leaked-password protection marked NOT AVAILABLE/NOT VERIFIED while the current plan does not expose the setting.

### P0.3 Directory and public-contact consent
- [ ] Keep `directory-listings` fail-closed.
- [ ] Reconcile RC472/RC473 consent schema, owner grant/revoke/expiry audit and matching Edge bundle.
- [ ] Require source/republication rights before importing or publishing directory listings.
- [ ] Test no-consent, revoked-consent and explicitly consented public projection; omit phone, address and precise location unless their individual consent scopes are present.
- [ ] Deploy DB + Edge only as a coordinated versioned unit after exact-head CI and evidence review.
**Live evidence:** consent registry absent; source-permission evidence count is zero; deployed `directory-listings` v18 is fail-closed.

## P1 — Database and backend contracts
### P1.1 Migration reconciliation
- [ ] Refresh the ordered mainline release manifest (80 identifiers at the 2026-11-24 checkpoint).
- [ ] Classify every migration by physical effect: exact-present, alias/effect-present, safe-to-replay, superseded/forward-fixed or blocked.
- [ ] Reconcile functions, policies, ACLs, indexes, triggers and constraints; 0/80 exact ledger matches is not proof all effects are absent.
- [x] Full chronological PostgreSQL 17 replay passed in GitHub Actions run [45393984396](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45393984396); 116 migrations after the captured schema checkpoint applied in the isolated local Supabase environment. This is not a Production migration.
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
- [x] Deployed-origin GitHub Pages verification passed in run [45393984388](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45393984388): root, `/legacy/` rollback, `/v6-preview/` alias, brand assets, retired `preview/` and `smm.html` routes not published; Playwright confirmed root/history/route refresh, empty catalog, guest denial and mobile/desktop/dashboard/QR flows.
- [ ] Preserve Activity → Specialty, all-Egypt default search, GPS nearest-first only with permission, and 20-item pagination + See More.
- [x] Merged SEO-only PR #1033 at `34a072312b29e613fb95a39050bb499eedabc786`; exact-head CI 34/34 passed. Mainline Pages deployment and deployed-origin browser verification later passed in run `45393984388`. Scope is SPA metadata plus a root-only sitemap; no SSR/prerender or dynamic catalogue sitemap is claimed.
- [ ] Keep storefront gallery PR #978 draft until rebased and proven compatible with live catalog-admin/public-catalog contracts.
- [x] Merged Marketing button regression PR #1032 at `f317a69fe186da7bff560657e161951e8794e81f`; Playwright verified the official persisted business UUID at 390px and 1440px with no horizontal overflow.
- [x] Verified existing logo, cover, favicon and fixed PWA/install icon on the mainline validation and Pages root/preview smoke checks.
- [ ] Verify Open Graph image delivery and external social-crawler previews separately.

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

- [x] RC923 full-chain replay and seven direct Anonymous Auth denial cases passed on main commit `751367f7ea6a7290e5c62bbff5f1979ee456dc20` (116 migrations; run 45393984396); no Production mutations. Evidence: `docs/audits/PASS_2071_2080_RC923_FULL_REPLAY_20261124.md`.
- [x] Pages deployment smoke + deployed-origin Playwright passed on main commit `751367f7ea6a7290e5c62bbff5f1979ee456dc20`; run 45393984388 covers root, legacy, V6 preview, catalog, dashboard, responsive and QR.

## Current factual blockers
- Live migration ledger: 310 entries through `20261110150618`; exact required-ID intersection was 0/79 at this checkpoint, with physical effects still requiring reconciliation.
- Both platform-root helpers remain membership-derived in Production; registry FORCE RLS is false.
- Directory consent registry and source-permission evidence are absent; directory endpoint remains disabled.
- Some critical Edge Functions are behind current-main contracts.
- Independent encrypted backup/restore, Auth/Vault coverage and measured RPO/RTO are not verified.
- Li2Lak candidate has prior successful partial checks, but its latest source requires complete exact-head test evidence after rebasing; Paymob remains fail-closed.

## Latest verified status — 2026-11-24
- [x] Zero-cost execution board is merged and remains the active priority queue.
- [x] Marketing button responsive routing regression merged and verified.
- [x] SEO-only route metadata/canonical-root guard merged; exact-head CI passed 34/34. Main Pages deployment is still pending verification.
- [x] Live Edge entrypoint comparison recorded; 9 critical mismatches remain and no Edge deployment was made.
- [ ] Continue P0 authorization and Edge dependency closure, then review Li2Lak/gallery candidate PRs.
- [ ] Backup/restore remains the final work stage and a hard release blocker.

## This session
- [x] Re-read the uploaded owner directive and verified ZIP integrity and SHA-256; R7 remains reference-only.
- [x] Reconfirmed Production project identity, 310 migration records, 42 ACTIVE Edge Functions and current advisors without production writes.
- [x] Re-read live authorization definitions and measured 57 policies across 24 tables.
- [x] Verified existing historical RC464/RC484/RC922 test evidence; did not mislabel historical runs as current full release certification.
- [x] Completed a read-only direct dependency closure pass for nine critical Edge functions; no Production Edge or database changes.
- [ ] Next: finish transitive Edge bundle/import-map and exact SQL/ACL closure, then reconcile deployed Edge versions with their database contracts. Keep encrypted backup/restore and all Production deployment steps in P6.
