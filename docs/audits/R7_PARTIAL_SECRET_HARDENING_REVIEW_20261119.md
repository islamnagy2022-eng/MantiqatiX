# R7 Partial Secret Hardening Review — 2026-11-19

**Source:** uploaded R7 archive `bizcatalog-manager (11).zip` and its working copy `/mnt/data/mantiq-r7-hardened`  
**Original archive SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Working-copy manifest SHA-256:** `a8811ebc64ebfffce53f00cfd86b4349d9bb10cc7ee7d10e56010c7d0a95c084`  
**Updated `server.ts` SHA-256:** `073640d8bf7f29d7ead2e263b612e0dec66ebb35d9ad28ae0caa9a1b31e25a02`  
**Disposition:** PARTIAL SECRET HARDENING ONLY — **R7 remains BLOCKED / NOT DEPLOYABLE**.

## 1. Changes verified in the working copy

The working copy differs from the original archive in seven tracked source/config/test files plus two new security checks:

- `.env.example`: removed placeholder-looking secret values and leaves sensitive variables empty.
- `server.ts`: removed three hard-coded HMAC/session/backup secret fallbacks; production startup now requires each configured secret to be at least 32 characters and rejects common placeholder prefixes. Development without a local value uses an ephemeral random secret.
- `src/lib/supabaseClient.ts`: browser client no longer references `process.env` or `SUPABASE_SERVICE_ROLE_KEY`; it accepts only Vite publishable/anon keys.
- `src/utils/billingEngine.ts`: removed default Paymob HMAC secret arguments.
- `src/utils/productionEnterpriseEngine.ts`: removed default session/audit/backup secrets; encrypted backups now reject envelopes missing their salt instead of using a fixed fallback.
- `src/utils/productionEnterpriseEngine.test.ts`: supplies an explicit test-only secret.
- `package.json`: adds `test:security`.
- Added `scripts/security/check-browser-supabase-client.mjs`.
- Added `scripts/security/check-server-secret-contract.mjs`.

## 2. Verification actually completed

- `npm run test:security`: PASS — `BROWSER_SUPABASE_CLIENT_SECURITY_PASS` and `SERVER_SECRET_CONTRACT_PASS`.
- The source still contains 113 API route declarations: 40 GET and 73 mutating (55 POST, 11 PUT, 7 DELETE).
- Updated line references for the critical endpoints are recorded below.
- `npm install --ignore-scripts --no-audit --no-fund` timed out in this environment. Consequently **no full build, TypeScript check, unit suite, runtime integration suite or browser E2E is claimed**.

## 3. Critical authorization defects remain unchanged

The secret-only edits do not fix the P0 API authorization findings. Manual source inspection of the updated working copy reconfirmed:

| Route | Updated source line | Finding |
|---|---:|---|
| `GET /api/production-state` | 1203 | Returns the full local JSON snapshot without a visible authentication guard. |
| `POST /api/production-state` | 1215 | Accepts and persists caller-supplied state without a visible authentication/authorization guard. |
| `POST /api/auth/session-token` | 2590 | Mints a signed token from caller-supplied userId/role; defaults to `admin_main` / `super_admin`. |
| `POST /api/auth/login` | 3009 | Admin branch retains default `admin` and fixed bypass passwords `admin` and `01010171770`. |
| `POST /api/wallets/transaction` | 1707 | Sensitive wallet mutation has no visible route-local authentication/authorization guard. |
| `POST /api/merchant-hub/ledger` | 3558 | Ledger mutation has no visible route-local authentication/authorization guard. |
| `POST /api/finance/audited-transaction` | 3805 | Trusts caller-supplied actorId/actorRole and defaults actorRole to `super_admin` before local ledger mutation. |

The Express middleware inspected before route registration adds security headers and an IP-based rate limiter; it does not establish a verified Supabase identity or tenant/branch/platform authorization boundary. The limiter derives its key from caller-provided `X-Forwarded-For` before socket address, so proxy trust and spoofing behavior also require review.

## 4. Android wrapper remains incomplete

The working copy still has only the manifest and Gradle build file in `android-webview-wrapper`; no `MainActivity`, Gradle wrapper/settings, or referenced Android resources were present in the inspected tree. The manifest still sets `android:allowBackup="true"`. No Android build or security verification was run.

## 5. Release decision and next implementation

1. Preserve the secret-removal patch as a partial, source-only improvement; do not describe the full application as hardened.
2. Implement verified Supabase Auth identity resolution and server-side membership/tenant/branch scope checks.
3. Require the protected platform-admin registry for platform-wide routes; never accept actor/role/tenant/business/branch authority from request bodies or localStorage.
4. Disable unsafe local snapshot, caller-minted session, legacy admin bypass, wallet and finance mutation routes until their reviewed backend contracts replace them.
5. Add adversarial tests for anonymous access, forged roles/actors, cross-tenant and cross-branch IDs, inactive memberships, replay and audit atomicity.
6. Complete the Android project structure and WebView origin/bridge/backup restrictions before any mobile release.

**No Production DB/Auth/RLS/GRANT/Edge/payment/wallet/settlement or deployed catalog change was made by this review. The live catalog remains the only approved public release surface.**


## Addendum — R7 fail-closed production gate revalidation (2026-11-19, Pass 950–959)

The isolated working copy was re-opened after the earlier partial-secret review. Its current `server.ts` SHA-256 is `bd511d6cf6effaba185d82e9e0861fdee8cb4f7e554de7d42ed1fbfd8df923dc`; this supersedes the earlier working-copy server hash `073640d8bf7f29d7ead2e263b612e0dec66ebb35d9ad28ae0caa9a1b31e25a02` recorded before the additional gate edit.

The current source now includes a hard-coded closed production API gate: in `NODE_ENV=production`, every `/api/*` request except `GET /api/health` is rejected with HTTP 503 and `R7_PRODUCTION_RELEASE_BLOCKED`; the health route itself returns HTTP 503 with `BLOCKED_NOT_CERTIFIED`. The gate is registered before route declarations. Production startup skips `ensureProductionDb()`, so the local JSON store is not initialized/read by startup. The gate is containment only; it does not authenticate Supabase users, establish tenant/branch/platform scope, or make the remaining routes safe to enable.

Revalidation on the current working copy: `npm run test:security` PASS (`BROWSER_SUPABASE_CLIENT_SECURITY_PASS`, `SERVER_SECRET_CONTRACT_PASS`); TypeScript/TSX syntax-only transpilation PASS for 95 files with 0 parse errors. No full TypeScript type-check, Vite build, dependency-backed unit/integration tests, browser E2E, or Android build is claimed. `node_modules` is absent and the prior npm install attempt timed out.

Remaining critical findings are unchanged: no verified Supabase Auth/tenant/branch/platform authorization; unsafe local snapshot/token/admin/wallet/ledger/finance route implementations remain in source but are contained by the closed production API gate; pseudo-HMAC/Paymob callback handling is not production-valid; Android wrapper is incomplete and `allowBackup=true`. No Production resources or deployed catalog were changed. R7 remains BLOCKED / NOT DEPLOYABLE.


## Addendum — Android WebView containment patch (Pass 960–969, 2026-11-19)

A further isolated working-copy patch corrected the Android WebView boundary. The original archive already contains `MainActivity.kt`; the earlier Pass 940–949 note stating that MainActivity was absent was inaccurate and is superseded by this correction. The actual project gaps were missing root Gradle settings/wrapper files, missing referenced ProGuard configuration/resources, and unsafe WebView configuration.

The current working copy now restricts WebView in-app navigation to exact HTTPS host `mantiqatix.com` (no prefix matching, userinfo, or nonstandard port); sends external HTTPS, `tel:` and WhatsApp navigation outside the WebView; blocks other schemes; cancels TLS certificate errors; disables file/content access, mixed content, automatic JS windows and multiple windows; enables Safe Browsing where supported; and removes the JavaScript bridge. Android backup is disabled and cleartext traffic remains disabled. Added root `settings.gradle.kts`, `gradle.properties`, ProGuard rules, vector launcher resources, and a pinned Android/Kotlin Gradle plugin configuration.

Verification on the isolated working copy: `npm run test:security` PASS for browser client, server secret/API gate and Android WebView checks; Android manifest/drawable XML parsing PASS. MainActivity SHA-256 `7cad176f5ae445c3d6a75e1bd25d42bcbad78a3b94da05315175ade58ce1cde5`; manifest SHA-256 `a777421891496af3d4ceb4589661e0155855cfb88caa2e8e3c0478a710fca123`; Android security checker SHA-256 `18ac37cf048d8b8b5064c767ec2e56dcd544ed36543b50e2814f28dc2d14ca2e`.

The Android Gradle wrapper scripts/JAR are still absent and no native Android build/runtime test was run. Deep links, file chooser, permission flows and external-intent behavior still need native verification. The WebView change is containment, not Android release certification. R7 remains BLOCKED / NOT DEPLOYABLE; no Production resource or deployed catalog was changed.

## Addendum — Paymob payment-integrity containment (Pass 970–979, 2026-11-19)

The isolated R7 working copy was further hardened after identifying a false-payment path. The previous FNV-style pseudo-HMAC generator and local payment-application helper were removed; fake seeded payment intents marked `paid` were removed. The checkout no longer collects card PAN, expiry, CVV, wallet PIN or OTP. Fake local Paymob intention creation, payment history, direct subscription payment, auto-renew mutation and billing sweep now fail closed with HTTP 503.

A server-only transaction callback verifier was added at `src/server/paymobTransactionHmac.mjs`. It uses Paymob's documented 20-field concatenation order, HMAC-SHA512 and timing-safe comparison. The webhook reads `body.obj` and the `hmac` query parameter. Invalid signatures return 403. A valid signature still returns 503 without changing state because the archive does not yet implement official Intention API correlation and atomic Supabase fulfillment; no payment is marked paid.

Verification: all five dependency-free security scripts PASS, including a fixed transaction fixture with tamper/wrong-secret/malformed/missing-field rejection and a static payment-security contract. TypeScript/TSX syntax-only transpilation PASS for 95 files with 0 parse errors. No full typecheck, Vite build, dependency-backed tests, live Paymob transaction, browser E2E or Android build is claimed. Current `server.ts` SHA-256: `da0ba4af7a722624974ad4fcafa38552d742e8912b80f2164f80cc9ba0faa1d3`.

Official contract references: https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac and https://developers.paymob.com/paymob-docs/integration-paths/apis. No Production resource or deployed catalog was changed. R7 remains BLOCKED / NOT DEPLOYABLE.