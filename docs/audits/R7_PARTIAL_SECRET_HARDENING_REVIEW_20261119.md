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
