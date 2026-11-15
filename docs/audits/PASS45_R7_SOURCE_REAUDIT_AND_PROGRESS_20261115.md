# Pass 45 — R7 source re-audit and realistic progress baseline

**Date:** 2026-11-15  
**User-designated source archive:** `bizcatalog-manager (11).zip`  
**SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Source integrity:** ZIP integrity PASS; 233 files extracted for read-only review.  
**Release status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

## 1. Source-of-truth clarification

Per the user's continuity directive, R7 archive is the current intended development baseline. GitHub `main` remains the older V6 deployed code path and is not yet replaced by R7. R7 must be integrated non-destructively after its blockers are corrected and verified. The archive is preserved unchanged; no R7 code was uploaded to Production or substituted into main.

The archive contains three Android wrapper files. It does not contain `.data/production-live-db.json`, real environment secrets, `node_modules`, a Gradle wrapper, `settings.gradle`, or `gradle-wrapper.properties`.

## 2. Verified source findings

### P0 — authentication / authorization
- `POST /api/auth/session-token` accepts caller-supplied `userId` and `role`, defaults the role to `super_admin`, and signs a token without first validating an authenticated session.
- `POST /api/auth/refresh` issues a new token from caller-supplied identity/role when no valid prior token is provided.
- `POST /api/auth/login` retains a default `admin` password and explicit static bypass values. `INITIAL_ADMIN_SETTINGS` also seeds the admin password as `admin`.
- Frontend demo flows still call `loginAsAdmin('admin')`; client auth state is held in `localStorage`.
- These are source-confirmed critical authentication defects. The source cannot be considered safe for public production exposure.

### P0 — secrets and payment configuration
- `SESSION_JWT_SECRET`, `PAYMOB_HMAC_SECRET`, and `BACKUP_ENCRYPTION_SALT` each fall back to hardcoded source constants when environment values are absent.
- `DEFAULT_PAYMOB_CONFIG` contains a credential-like literal. Its validity is unknown; treat it as exposed until the owner verifies and rotates it if genuine. The literal is intentionally not reproduced here.
- Paymob live/Sandbox E2E is not evidenced by this archive's reproducible test commands.

### P0/P1 — production data and persistence
- `server.ts` treats `.data/production-live-db.json` as its authoritative runtime database and writes it directly.
- If that file is absent or unreadable, `ensureProductionDb()` silently creates a fresh state from `INITIAL_BUSINESSES` / `INITIAL_PRODUCTS` and writes it.
- `buildDefaultProductionDb()` marks seeded businesses verified, unfrozen and paid. The upgrade path also forces imported custom businesses to verified/unfrozen/paid. This can misrepresent real verification/payment state and is unsafe as a production bootstrap.
- The frontend initializes and persists core businesses, products, subscribers, customers, sales, wallets, and other state in `localStorage`; backend synchronization is not authoritative.
- The `/api/supabase/sync` and `pull` endpoints are optional environment-dependent sync paths; the current source describes local JSON as authoritative. This is not a production-grade multi-instance transactional data architecture.
- The archive excludes the actual `.data` file, so no production data snapshot can be independently validated from the archive.

### Database / RLS
- The single bundled SQL migration creates **7 actual tables**, not the 11 claimed in some R7 reports.
- It enables RLS on those 7 tables and defines 7 policies. This does not prove that the live Supabase schema has been reconciled or that tenant/role claims are securely issued.
- Several policy conditions trust JWT role/subject claims. Because the current Node token minting routes are unsafe, those claims cannot be treated as a trusted identity boundary.
- The live Supabase project has a much larger migration history and schema. The R7 one-file schema must not be applied to Production as a replacement or reset.

### Android
- Archive includes only `MainActivity.kt`, `AndroidManifest.xml`, and `build.gradle.kts` under `android-webview-wrapper/`.
- No Gradle wrapper, root `settings.gradle`, wrapper properties, or reproducible Android build evidence was found. Android is a retained partial wrapper, not a releasable APK project.

### Tests / release claims
- Archive contains 15 TypeScript test files, but `package.json` defines no `test` script.
- `npm install --ignore-scripts --no-audit --no-fund --prefer-offline` did not complete in the available environment (timed out).
- Global `tsc --noEmit` is BLOCKED because `vite/client` type definitions are unavailable without installed dependencies.
- Native Node `--experimental-strip-types --test` was attempted and failed because the source uses extensionless TypeScript imports that Node did not resolve.
- Therefore the archive's 99/99 PASS report, build PASS, and Production Certified statements were **not independently reproduced**. They are treated as claims, not release evidence.

## 3. Realistic engineering progress by the 12 workstreams

These are conservative source-and-evidence estimates for the R7 archive as reviewed on 2026-11-15. A feature existing in source does not mean it is production-secure or live-verified.

| # | Workstream | Current estimate | Evidence-based status |
|---:|---|---:|---|
| 1 | Interfaces and design | **85%** | Broad React UI and visual captures exist; build/browser/accessibility regression not reproduced. |
| 2 | Backend and database | **30%** | 115 Express route declarations and one local JSON authoritative store; only 7 tables in bundled migration; cloud persistence/reconciliation incomplete. |
| 3 | Login and permissions | **8%** | Critical token-minting, refresh, default-admin and client-side identity defects. |
| 4 | Catalog, classification and geography | **65%** | Sector/catalog/geographic UI and data structures exist; live source-of-truth and real-data verification incomplete. |
| 5 | Orders and cart | **45%** | Cart, order routes and WhatsApp dispatch exist; authoritative persistence, identity binding and full lifecycle tests incomplete. |
| 6 | Accounting, commissions and wallets | **35%** | Calculation engines and screens exist; ledger authority, database parity and payment/reconciliation E2E unverified. |
| 7 | Admin and merchant dashboards | **75%** | Extensive dashboards and controls exist; their backend authorization and runtime contracts are not production-verified. |
| 8 | Marketing, CRM and advertising | **55%** | Campaign, lead and ad components/routes exist; live delivery, billing and isolation tests incomplete. |
| 9 | External integrations | **25%** | Paymob, WhatsApp, Gemini and Supabase code exists; secret management and live/sandbox E2E not verified. |
| 10 | Android application | **15%** | Partial WebView wrapper files preserved; no reproducible Gradle build or installable artifact. |
| 11 | Security and backup/recovery | **5%** | Critical auth defects, hardcoded fallbacks, local-file persistence and no verified production restore. |
| 12 | Testing and release | **5%** | Test sources exist but no test script; install/typecheck/build/browser/Android and release evidence not reproduced. |

**R7 arithmetic mean:** **37.33%** (unweighted mean of the 12 categories; not a certification score).

### Comparison with the previous reported total

The prior continuity record reported **60.8333% weighted overall**, but the per-category baseline and weighting formula are not present in the retrieved source records. The new 37.33% is an unweighted, R7-source-based re-audit. The 23.50 percentage-point difference is a **method/source-baseline recalibration**, not evidence that 23.50% of working features were removed.

No category-level increase can honestly be calculated without the previous category values. This pass did not deploy R7, so no R7 production workstream percentage is marked as increased. The separate RC468 payment candidate is source/test progress only and is not included in the R7 production score.

## 4. Separate backend candidate progress — RC468

- Draft PR #731: `security/rc468-digital-page-payment-claim-20261115`.
- Candidate migration, disposable precondition, integration test, and isolated PostgreSQL workflow created.
- Dedicated RC468 PostgreSQL 16 workflow passed on current candidate head `3f75de7b7d4b474b2dfea5497d503c409796f313`.
- Forward migration chain replay passed on the same head: **77 migrations** replayed from the historical schema-only checkpoint; RC468 integration passed, as did owner-profile, RC455/RC456 commission, and tenant-isolation tests.
- All **11/11** workflow runs returned success on this head. The V6 Pages workflow's validation job passed (desktop/mobile browser validation); `validate_public_only` and `deploy` jobs were skipped for the PR event. No website deployment occurred.
- PR #731 remains Draft/unmerged. No Production migration, RPC invocation, Edge deployment, or payment was performed.
- RC468 must be deployed only together with the matching five-argument Edge Function after the complete dependency chain, Paymob Sandbox E2E, backup/restore evidence, and human review.

## 5. Immediate priority order

1. Remove unauthenticated arbitrary JWT issuance and unsafe refresh fallback; establish one trusted identity authority before protecting every privileged route.
2. Remove default admin credentials and all source fallback secrets; rotate any genuine embedded provider credential.
3. Make production startup fail closed when an approved real data snapshot/backend is absent; remove auto-verification/auto-paid state mutation.
4. Reconcile R7 data contracts against the actual live Supabase schema; do not apply the one-file schema wholesale.
5. Build full Android Gradle project without deleting retained wrapper source.
6. Restore dependencies reproducibly, add a real test script, run all tests/typecheck/build/browser tests and Android build.
7. Complete RC468 and the coupled Paymob flow in disposable/Sandbox tests.

**Safety:** R7 archive was read-only during this audit. No Production data/schema/Auth/RLS/GRANT change, Edge deployment, website deployment, payment, Staging, or paid resource occurred.


### RC468 expanded regression addendum — 2026-11-15

- Extended the disposable regression suite to cover NULL idempotency key and NULL claim token on release/finalize in addition to NULL/blank/malformed claim token and cross-user/replay cases.
- Current PR #731 head: `5e5b832e0114476604bf195d336105c6ee437246`. Dedicated RC468 PostgreSQL workflow PASS. Forward migration-chain replay and V6 Pages validation are still in progress on this expanded-test head. The preceding head `3f75de7b7d4b474b2dfea5497d503c409796f313` had 11/11 workflows PASS, including 77-migration replay; the expanded tests are being rerun before claiming the same for the current head.
- No Production change/deployment. PR #731 remains Draft/unmerged.
