# PASS 1275–1284 — Production deploy closure and source revalidation — 2026-11-20

## Deployment and exact-head verification

- Main commit: `295f48789a3d943ba122f2216225b617c3d93290` (PR #896, MantiqatiX first-party logo/cover fix).
- GitHub Actions deploy run `44677886002`: **completed / success**. Validate job and deploy job both succeeded.
- Production deploy job completed all 12 steps, including GitHub Pages deployment, root/legacy/V6-preview route verification, and deployed-origin browser tests.
- Deployed-origin Playwright result: `PRIMARY_CATALOG_BROWSER_E2E=PASS`. Covered canonical root and directory search, 20-item pagination, geographic scope, guest route denial, owner/employee/branch authorization, dashboard responsive layouts and accessibility checks, QR routes, GPS consent behavior, verified storefronts, Activity/Specialty navigation, and subscriber portal.
- Primary catalog validation run `44677886011`: **completed / success**. Build, TypeScript, privacy/contract checks, employee RBAC PostgreSQL tests, and dashboard browser E2E all passed.
- The production root is the catalog frontend build at `/`; `/legacy/` is its path-adjusted rollback copy; isolated AI Studio V6 is served at `/v6-preview/`. The deployed-origin primary catalog browser suite and the separate V6 desktop/mobile preview suite both passed. PR #893/#894 cover catalog branding; PR #896 covers V6 preview branding. Do not conflate the surfaces or overstate the V6 fixture test as a live customer-record image test.

## Uploaded source archive recheck

- Uploaded `bizcatalog-manager (11).zip` SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`, matching the previously audited R7 archive exactly.
- It remains reference-only and is not promoted over current GitHub main/Supabase production. Rechecked its extracted application context: business, products, subscriber/customer, sales, auth-session, selected-business and order state are persisted through browser localStorage. These are not authoritative identity, authorization, tenant, inventory, order or financial records.
- The Android wrapper remains preserved as an incomplete source fragment; it is not certified as a native Android release.
- The uploaded master technical directive hash is `b51078e5aa164067c46347fd327c7230c5968f3cd36df5a354691504a3364ee2`; its autonomous workflow and priority order are reflected in this checkpoint.

## Production status — unchanged and not certified

The successful web deployment does not clear the independent production security/release gates. The latest recorded read-only evidence still requires coordinated remediation:

- Platform-admin helper/registry scope issue: issue #867 remains open; generic `is_platform_admin()` is referenced by 57 policies across 24 tables.
- Directory contact privacy: issue #876 remains open; live anonymous directory output still lacks the consent registry boundary. No individual contact rows were read in this work.
- Payment/order/finance release parity: issue #857 remains open; critical deployed Edge functions and migration contracts are not safe for piecemeal deployment.
- Migration reconciliation, real encrypted off-site DB + Storage backup, Vault recovery, separate PostgreSQL 17 restore, measured RPO/RTO and rollback remain outstanding.
- No Supabase production SQL/DDL/DML, migration, GRANT, RLS, Auth, Storage, Edge Function, payment, wallet, settlement or customer-data mutation occurred in this pass.

## Next execution

1. Continue source/CI-only remediation and adversarial tests for the P0 platform-admin and directory-consent boundaries.
2. Keep payment/order/finance Edge release blocked until the full ordered migration and function bundle are reconciled and sandbox-tested together.
3. Do not perform production mutation until the owner-controlled backup/restore gate is evidenced.
4. Preserve current published catalog root, legacy rollback path, V6 preview, and Android wrapper.

