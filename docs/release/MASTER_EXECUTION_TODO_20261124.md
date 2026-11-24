# MantiqatiX — Master Execution TODO | Zero-Cost Fast Track
**Updated:** 2026-11-24 — live Production recheck and PR #1049 actor matrix  
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
- [x] Rechecked Production helper definitions, all dependent policy counts, helper callers, all seven catalog RPC ACLs and anonymous-session guards using read-only PostgreSQL catalog queries; see `docs/audits/PASS_2071_2080_P0_AUTHORIZATION_RECHECK_20261124.md`.
- [x] Confirmed RC923's current source/integration contract checks all seven direct catalog RPCs for anonymous Auth sessions; exactly three RPC bodies are replaced by RC923, while the other four already guard anonymous sessions.
- [ ] Reconcile live `is_platform_admin()` and `mnty_can_platform_admin()` with RC464, RC471, RC484, RC485 and RC923 source.
- [x] RC484's post-migration test now asserts registry FORCE RLS and registry/helper owner parity with BYPASSRLS; exact PR-head PostgreSQL 17 run `45390294342` passed (PR #1040 merged).
- [ ] Complete the ordered migration set on disposable PostgreSQL 17 using repo CI. Preserve the 57-policy / 24-table dependency map; PR #1049's widened RC471 actor matrix is still awaiting exact-head CI completion.
- [ ] Test RC923 anonymous-session denial for all seven catalog RPCs on the full chronological 80-version PostgreSQL 17 replay.
- [ ] Test registered platform admin allow; tenant ADMIN/OWNER/SUPER_ADMIN without registry deny; inactive membership deny; cross-tenant/business/branch deny; tenant-local access still works.
- [ ] Assert function ownership, empty `search_path`, grants, FORCE RLS and caller coverage in tests.
- [ ] Prepare one coordinated migration bundle and post-release read-back. Do not hot-patch or apply it to Production in this phase.
**Live evidence:** Production still uses membership-derived helpers; registry RLS is on but FORCE RLS is false. See `docs/audits/PASS_2041_2050_LIVE_PRODUCTION_RECHECK_20261124.md`.

### P0.2 Anonymous Auth and private profile boundaries
- [x] Refreshed Advisor + live ACL snapshot: 90 anonymous-Auth table warnings, 9 RLS-no-policy tables with all client grants denied, 65 exposed authenticated SECURITY DEFINER functions (18 empty search_path, 47 other pinned, 0 unset); see PASS_2081_2090 and Issue #928.
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
- [x] Refresh the ordered mainline release manifest (80 identifiers at the 2026-11-24 checkpoint) and compare it with Production's 310-row migration ledger: 0/80 exact source-version identifiers are present; physical-object aliases/effects still require reconciliation.
- [ ] Classify every migration by physical effect: exact-present, alias/effect-present, safe-to-replay, superseded/forward-fixed or blocked.
- [ ] Reconcile functions, policies, ACLs, indexes, triggers and constraints; 0/80 exact ledger matches is not proof all effects are absent.
- [ ] Run full chronological forward replay on GitHub Actions PostgreSQL 17 with required integration jobs.
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
- [x] Merged SEO-only PR #1033 at `34a072312b29e613fb95a39050bb499eedabc786`; exact-head CI 34/34 passed, including the route metadata contract. Pages deployment from this main commit is pending verification. Scope is SPA metadata plus a root-only sitemap; no SSR/prerender or dynamic catalogue sitemap is claimed.
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
- `private.platform_admins` has RLS enabled but FORCE RLS=false. The registry-backed forward migrations and seven-RPC RC485/RC923 contract are not applied to Production.
- Of the seven direct catalog RPCs, four live definitions contain an anonymous-Auth guard and three (item upsert, price upsert, item-status update) do not. All seven deny direct `anon` EXECUTE but permit `authenticated` EXECUTE; all seven remain `search_path=public`.
- Directory consent registry and source-permission evidence are absent; the directory endpoint remains fail-closed.
- Supabase Auth leaked-password protection is disabled; 47 of 65 authenticated-callable SECURITY DEFINER functions still have non-empty search_path (public / public, pg_temp); these require targeted review, not blanket changes.
- Some critical Edge Functions are behind current-main contracts.
- Independent encrypted backup/restore, Auth/Vault coverage and measured RPO/RTO are not verified.
- Li2Lak candidate has prior successful partial checks, but its latest source requires complete exact-head test evidence after rebasing; Paymob remains fail-closed.

## Latest verified status — 2026-11-24
- [x] Zero-cost execution board is merged and remains the active priority queue.
- [x] Marketing button responsive routing regression merged and verified.
- [x] SEO-only route metadata/canonical-root guard merged; exact-head CI passed 34/34. Main Pages deployment is still pending verification.
- [x] Live Edge entrypoint comparison recorded; 9 critical mismatches remain and no Edge deployment was made.
- [x] Live P0 authorization and seven catalog-RPC contracts rechecked read-only on 2026-11-24; exact evidence in `PASS_2071_2080`.
- [x] Anonymous Auth/SECURITY DEFINER Advisor snapshot refreshed read-only; 9 no-policy tables have no client grants, 47 exposed authenticated definers still use non-empty pinned search paths; full policy test matrix remains open under #928.
- [ ] Finish PR #1049 exact-head PostgreSQL 17 CI for tenant-scoped SUPER_ADMIN and MNTY-PLATFORM-membership-only negative tests across all four `mnty_can_platform_admin()` callers; no merge until CI is green.
- [ ] Continue per-object migration/alias reconciliation, then review Li2Lak/gallery candidate PRs.
- [ ] Backup/restore remains the final work stage and a hard release blocker.

## This session
- [x] Re-read the uploaded owner directive and verified ZIP integrity and SHA-256; R7 remains reference-only.
- [x] Reconfirmed Production project identity, 310 migration records, 42 ACTIVE Edge Functions and current advisors without production writes.
- [x] Re-read live authorization definitions and measured 57 policies across 24 tables.
- [x] Verified existing historical RC464/RC484/RC922 test evidence; did not mislabel historical runs as current full release certification.
- [x] Completed a read-only direct dependency closure pass for nine critical Edge functions; no Production Edge or database changes.
- [x] Rechecked the 80-version exact migration ledger set (0/80 exact IDs), both live platform-root helpers, 57/24 and 5/3 policy dependencies, four SECURITY DEFINER callers, and all seven catalog RPC guard/ACL/search_path states.
- [ ] Next: await exact-head CI for PR #1049, then complete physical-object alias mapping and transitive Edge/SQL dependency closure.
