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
- [ ] Reconcile live `is_platform_admin()` and `mnty_can_platform_admin()` with RC464, RC471, RC484 and RC485 source.
- [ ] Test the ordered migration set on disposable PostgreSQL 17 using repo CI. Preserve the 57-policy / 24-table dependency map.
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
- [ ] Refresh the ordered mainline release manifest (79 identifiers at the 2026-11-24 checkpoint).
- [ ] Classify every migration by physical effect: exact-present, alias/effect-present, safe-to-replay, superseded/forward-fixed or blocked.
- [ ] Reconcile functions, policies, ACLs, indexes, triggers and constraints; 0/79 exact ledger matches is not proof all effects are absent.
- [ ] Run full chronological forward replay on GitHub Actions PostgreSQL 17 with required integration jobs.
- [ ] Never blindly replay the release chain on Production.

### P1.2 Edge parity
- [x] Read-only comparison shows `public-catalog` v9 and `public-catalog-directory` v19 match current main across all files returned by Supabase (7/7 file comparisons across both bundles).
- [x] Focused entrypoint comparison covered 11 launch-relevant Edge Functions; 9 critical entrypoints differ from current main. Audit and shared-file addendum: `docs/audits/PASS_2051_2060_EDGE_SOURCE_PARITY_20261124.md`.
- [ ] Reconcile the nine mismatched functions with their SQL/RPC/ACL/Auth dependencies; never deploy one individually.
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
- [x] Merged SEO metadata PR #1033, legacy-title regression PR #1035 and SPA route-listener PR #1037. Exact-head CI: 34/34 for each release candidate; current main includes canonical-root indexing, private-route noindex, and `popstate`/`mantiqatix:routechange` refresh. Root-only sitemap; no SSR/prerender or dynamic catalogue sitemap claimed.
- [ ] Verify Pages deployment and deployed-origin `/legacy/`, root and V6 Preview checks for latest main `9bb63466f7b0f2f3f3d454247662e2a911b0218a` (workflow run `45388644048` pending).
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
- Live migration ledger: 310 entries through `20261110150618`; exact required-ID intersection was 0/79 at this checkpoint, with physical effects still requiring reconciliation.
- Both platform-root helpers remain membership-derived in Production; registry FORCE RLS is false.
- Directory consent registry and source-permission evidence are absent; directory endpoint remains disabled.
- Some critical Edge Functions are behind current-main contracts.
- Independent encrypted backup/restore, Auth/Vault coverage and measured RPO/RTO are not verified.
- Li2Lak candidate has prior successful partial checks, but its latest source requires complete exact-head test evidence after rebasing; Paymob remains fail-closed.

## Latest verified status — 2026-11-24
- [x] Zero-cost execution board is merged and remains the active priority queue.
- [x] Marketing button responsive routing regression merged and verified.
- [x] SEO route metadata, legacy-title preservation and SPA history refresh merged; exact-head CI passed 34/34 for each PR. Latest main Pages deployment is pending deployed-origin validation.
- [x] Edge parity audit completed: public catalog bundles match across all returned files; 9 other critical entrypoints remain different and no Edge deployment was made.
- [x] Production Health Monitor passed on latest main `9bb63466f7b0f2f3f3d454247662e2a911b0218a`, including root, legacy, Supabase health and read-only DB probe.
- [ ] Continue P0 authorization and Edge dependency closure, then review Li2Lak/gallery candidate PRs.
- [ ] Backup/restore remains the final work stage and a hard release blocker.

## This session
- [x] Re-read the uploaded owner directive and verified ZIP integrity and SHA-256; R7 remains reference-only.
- [x] Reconfirmed Production project identity, 310 migration records, 42 ACTIVE Edge Functions and current advisors without production writes.
- [x] Re-read live authorization definitions and measured 57 policies across 24 tables.
- [x] Verified existing historical RC464/RC484/RC922 test evidence; did not mislabel historical runs as current full release certification.
- [ ] Next: complete a no-cost source/CI audit of current-main candidate PRs, then select the first mergeable zero-risk slice.
