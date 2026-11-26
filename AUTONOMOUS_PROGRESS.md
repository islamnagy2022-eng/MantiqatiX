# Autonomous Development Progress

## Session checkpoint — 2026-11-26

### Repository baseline
- Repository: `islamnagy2022-eng/MantiqatiX`; default branch `main`.
- Latest main source commit from this pass: `ffd91df42c0cc70bfce692cc79045132cff5c383`.
- Central task list: `TODO_PRODUCTION.md` and `docs/release/MASTER_EXECUTION_TODO_20261124.md`.
- Production remains **BLOCKED / NOT CERTIFIED**.

### Merged to main
- PR #1113 — reject applications to inactive jobs. Squash merge `affe3ddb8e0328d6b6166a417373d6789d19b086`.
  - Exact-head PostgreSQL 17 integration passed: active job accepted; inactive job rejected without insert; missing job rejected.
  - Forward migration chain replay passed. Migration remains source-only; it was not applied to Production.
- PR #1116 — constrain direct CRM writes to an exact ACTIVE business membership and restrict provider-profile owner updates to branding columns. Squash merge `f885d5c0669349ffad5d3ffa10ba241186eb3178`.
  - Exact-head CRM PostgreSQL integration, static validator and chronological migration replay passed.
  - Cross-business/cross-tenant writes, requester spoofing, anonymous writes, self-approval, self-verification, profile reassignment, direct profile create/delete and legacy-profile escalation cases were covered.
  - Migration remains source-only; it was not applied to Production.
- PR #1118 — correct Pages case-redirect test scope and add a pull-request-only smoke test against the current deployed Pages origin. Squash merge `86df8c82d2652a46e72575e5b04be23999f22427`.
  - Exact-head Primary Catalog Frontend Validation, Module Professionalization, SMM contract, MantiGO privacy, Backend-only boundary, RC425 atomicity and Pages workflow passed.
  - The deployed-origin redirect regression job passed. On PR validation, `validate_public_only` and `deploy` were skipped; no PR-triggered production deployment took place.
- PR #1119 — fail closed on catalog price writes until RC486 is verified. Squash merge `8e88bed845c0e9fff33d40768cb3540ad296fc77`.
  - Exact-head Primary Catalog Frontend Validation (including dashboard browser E2E), Module Professionalization, CORS, public catalog contact privacy, Directory Contact Consent, MantiGO privacy, Backend-only boundary, RC425 atomicity and Legacy Catalog validation all passed.
  - Source guard returns HTTP 503 for `ITEM_PRICE_UPSERT` and `PRICE_UPSERT` before membership/database reads and both price RPCs, with a stable error. Read operations and other catalog actions remain unchanged.
  - Source only: live `catalog-admin` Edge Function was not deployed, so this commit does not yet enforce the guard in Production.

### Current draft — user-requested cover/gallery feature
- PR #1120 — `feat(storefront): one cover plus up to ten promotional images`.
- Branch: `feat/promotional-gallery-current-main-20261126`; current exact head: `bbea4d5651f0dd102f6b6897f030434fc782ff6a`.
- Ported the old feature onto current main without overwriting the latest catalog implementation or losing RC486's fail-closed guard.
- One fixed cover; separate gallery of up to ten owner-provided public HTTPS image URLs; editor, de-duplication and validation; Edge persistence under the existing catalog profile JSON; public catalog and directory sanitize the returned list. No DB migration.
- First browser run caught a duplicated gallery section. Removed the duplicate and reran exact-head CI. Do not use the first failed run as current evidence; the corrected head is being rechecked.
- Current corrected-head exact CI: build and TypeScript passed; owner/employee RBAC PostgreSQL passed; promotional image editor and HTTPS validation tests passed; gallery wiring validator passed; Module Professionalization, RC425, CORS, public contact privacy, directory contact-consent, MantiGO privacy, backend-only, legacy catalog and flexible commission workflows passed.
- Pages workflow exact-head validation and deployed-origin redirect regression passed; `validate_public_only` and `deploy` were skipped. No website deployment occurred.
- Corrected-head exact CI is fully green, including `professional_dashboard_browser_e2e` in Primary Catalog Frontend Validation (run `45724571648`). The browser test confirmed one fixed cover and a separate single gallery with the two expected URLs.
- Keep PR #1120 as **Draft**. Even after CI passes, do not merge/deploy until the live `catalog-admin`, `public-catalog` and `public-catalog-directory` Edge versions are reconciled and an approved coordinated release can prove save/read parity on the deployed origin. The gallery is not live today.
- Old PR #1098 was commented and closed as superseded by #1120.


### Corrected gallery candidate CI — updated 2026-11-26
- PR #1120 corrected head `bbea4d5651f0dd102f6b6897f030434fc782ff6a` now has every required exact-head workflow green, including Primary Catalog Frontend Validation with browser E2E, Module Professionalization, CORS, privacy, directory consent, MantiGO, RC425, backend boundary and Pages checks.
- Browser E2E verified exactly one fixed cover and one separate gallery with the expected two public image URLs. The duplicate found on the first candidate was removed before this successful run.
- Pages run `45724571906` completed successfully; deployed-origin redirect smoke test passed, `validate_public_only` and `deploy` were both skipped. No site deployment occurred.
- PR #1120 remains Draft because live Edge compatibility and deployed-origin save/read parity are still release blockers. The feature currently accepts owner-entered HTTPS image URLs (not file uploads), and is not live.
- Older gallery PR #978 has been commented and closed as superseded by #1120.

### Merged branding asset validation
- PR #1121 — `test(branding): verify approved logo and app icon files exist`, squash-merged as `bc4695f03755dd6e99020ab7f772aed4ec5d7f96`.
- Test-only change checks five official platform brand/PWA assets exist and are non-empty.
- All six exact-head workflows passed, including build, employee RBAC PostgreSQL, dashboard browser E2E, Module Professionalization, Backend-only, MantiGO and RC425. Old PR #1101 was commented and closed as superseded.
- Comparison between previous main `8e88bed845c0e9fff33d40768cb3540ad296fc77` and new main confirms the merge changed exactly one file: `scripts/validate-navbar-business-logo.mjs`, with 13 additions and no deletions. No frontend behavior changed.

### Live Supabase Edge parity evidence — read-only inspection
- Project `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`) was inspected read-only on 2026-11-26.
- Deployed `catalog-admin` version 20 (updated 2026-10-29) contains neither the RC486 fail-closed price-write guard nor promotional-image validation/persistence.
- Deployed `public-catalog` version 9 and `public-catalog-directory` version 19 (both updated 2026-11-22) contain no `promotional_images` projection/sanitizer.
- This confirms #1119's price-write guard is source-only and #1120 must remain Draft. No Edge Function was deployed.

### Mainline Pages deployment after test-only merge
- PR #1121's test-only merge triggered push workflow run `45725376297`.
- Full validation, catalog-pilot verification, Pages artifact creation, GitHub Pages deployment, V6 root/legacy/Preview checks, case-insensitive URL redirect browser check, and deployed dashboard/mobile/QR browser checks all completed successfully.
- The public site was rebuilt and deployed from current main. Because the only change since the previous main was a test script, this deployment did not add the gallery feature or otherwise change frontend behavior.
- The PR-triggered workflow for #1121 had `validate_public_only=success` and `deploy=skipped`; the main push run completed deployment successfully.

### Merged RC927 anonymous Auth digital-page boundary
- PR #1122 merged as `ffd91df42c0cc70bfce692cc79045132cff5c383`, source-only.
- Added RC927 migration `20261125120000_rc927_digital_page_authenticated_identity_scope.sql`: raw `anon` remains the public page renderer role under RC480's exact ten-column allowlist; `authenticated` sessions require explicit `is_anonymous=false` for page and section reads/writes; existing confirmed-owner/admin policies remain in place.
- Added adversarial PG17 integration covering raw anon public read/internal-column denial, Anonymous Auth and missing claim read/write denial, confirmed-owner compatibility, and confirmed non-owner restrictions.
- Updated the release map to 84 required source migration IDs and corrected RC479 + RC494 migration-count checks to 84.
- CI on exact head `3d349c12064b7d109060885695ecf41592ec02f0`: **17/17 workflows passed**, including the full chronological PostgreSQL 17 forward replay from the Production schema checkpoint. The replay applied 123 forward migration files in timestamp order and passed RC927 integration; this is disposable-only evidence, not a Production restore or migration.
- A test-only ACL overlay was added for the disposable replay because local Supabase defaults differed from the read-only Production snapshot. It removes DML grants from `PUBLIC` and `anon` only in the isolated replay fixture; the RC927 Production migration contains no GRANT/REVOKE.
- The Pages PR validation had `validate_public_only=skipped` and `deploy=skipped`; deployed-origin redirect smoke test passed. No website deployment was triggered by the PR workflow.
- No Production migration, RLS/GRANT/Auth change, Edge deployment, Storage mutation or customer data change was performed. RC927 remains unapplied in Production pending the complete release gate.

### Reviewed but intentionally not merged
- PR #1117 / old #1114 — selected-membership activity-label fix was written to dormant `web/` files, while current Pages production build composes `apps/catalog-frontend` and excludes `web/`. This patch would not reach the live UI. Both PRs closed; Issue #96 left open with a documented topology finding. A real fix requires a fresh deployed repro and change in the current React application.
- PR #1110 — Paymob provider scoping still needs the signed altered-selector HTTP Sandbox replay. Disposable CI alone is insufficient.
- PR #1109 — stale RC927 branch was closed after its focused source changes were ported to current-main PR #1122 and all exact-head checks passed.
- Other stale drafts are not assumed safe merely because GitHub reports them open.

### Safety and rollback boundary
- A GitHub Pages site deployment did occur after the test-only #1121 merge; all post-deploy checks passed, and the frontend source diff was unchanged.
- No Production Supabase migration, DDL/DML, GRANT, RLS, Auth, Storage, Edge Function, payment, wallet, settlement or customer-data mutation was performed.
- Merged changes are source/CI commits and can be reverted with Git if a regression is found.
- Production release remains blocked pending operator-owned encrypted DB + Storage backup, off-site retrieval, Vault/Auth recovery, independent PostgreSQL 17 restore and rollback with measured RPO/RTO, chronological migration reconciliation, coordinated Edge parity, signed Sandbox payment replay, and negative authorization/privacy E2E.
- RC116/RC919/RC486 source changes do not count as live Production remediation until the appropriate coordinated release is completed and verified.

### Next actions
1. Keep #1120 Draft despite green CI until live Edge compatibility, coordinated release and deployed-origin owner save/public read verification pass.
2. Even with green CI, keep gallery feature out of Production until live Edge compatibility and deployed-origin save/read verification are proven in an approved release.
3. Continue current-main source/CI work from the master TODO, prioritizing P0 authorization/privacy and verified user-facing features.
4. Continue source/CI-only work from the master TODO. Keep Production DB/Auth/RLS/GRANT/Storage/Edge/payment/finance changes blocked until documented backup/restore and coordinated release gates pass.


### Continuation checkpoint — 2026-11-26
- Current main: `ffd91df42c0cc70bfce692cc79045132cff5c383`.
- PR #1122 RC927 is merged source-only; all 17 exact-head checks green, including full 84-version/123-forward-file chronological PG17 replay and exact RC927 adversarial integration.
- PR #1120 gallery remains Draft. Its exact-head browser E2E for owner URL validation, save payload and reload succeeded, but the live Edge bundles lack persistence/projection support. Atomic profile persistence and coordinated three-Edge compatibility are still required before merge/release.
- Issue #96 remains open: prior patch touched dormant `web/` files excluded from the current Pages composition.
- PR #1110 Paymob provider scoping remains unmerged until the signed altered-selector Sandbox HTTP replay is evidenced.
- Production remains **BLOCKED / NOT CERTIFIED**; no Production mutation was performed in RC927.
