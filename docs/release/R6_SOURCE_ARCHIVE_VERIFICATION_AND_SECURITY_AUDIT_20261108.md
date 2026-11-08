# R6 Archive Verification & Security Gate — 2026-11-08

## Executive result

The exact user-selected archive `bizcatalog-manager (6).zip` is now available as a mounted conversation file and was inspected locally. Its observed digest matches the digest already recorded in the authoritative project TODO. This supersedes the prior note that raw archive bytes were unavailable.

- Source archive: `bizcatalog-manager (6).zip`
- Observed size: 37,305,478 bytes
- SHA-256: `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`
- ZIP integrity check: PASS
- ZIP entries: 216 total
- `src/`: 83 regular files
- React components: 48
- Existing test files: 12
- Mobile web components: `src/components/mobile/MobileAppBottomNav.tsx`, `src/components/mobile/MobileSponsoredStoriesBar.tsx`
- Native Android Gradle project: NOT PRESENT in this archive; do not conflate mobile web components with the separately retained native Android workstream.

## Test evidence

- Unit tests: **78 passed / 78 total, 0 failed**, across the 12 existing `.test.ts` files.
- Test invocation used Node 22.16.0 with the globally available ts-node ESM loader and a temporary resolver for the archive's extensionless TypeScript imports. The temporary resolver was not added to the source tree.
- Full TypeScript check: NOT VERIFIED. The available global `tsc` stopped at missing `vite/client` declarations because application dependencies were not installed.
- Dependency install: NOT VERIFIED. `npm install --offline` failed with `ENOTCACHED` for `@google/genai`; this environment has no network access and no cached npm package set.
- Vite production build, browser E2E, accessibility, mobile viewport, PWA runtime, and deployed-origin verification: NOT VERIFIED.

## Confirmed integration and security blockers

### 1. Private files inside the uploaded archive

- `.data/production-live-db.json` exists and is labeled `isOfficialProduction: true` inside its own local payload. That label is not proof that this is the authoritative live Supabase database.
- `.data/backups/` contains four local JSON backup files.
- The local DB snapshot contains business, subscriber, wallet, payment-intent, message, and audit collections. Personal record values were not reproduced in this report.
- The archive's `.gitignore` does not exclude `.data/`.
- Required action: exclude the complete `.data/` directory and all backups/snapshots from every repository import, preview bundle, artifact, or public build. Do not use this snapshot as production seed data.

### 2. Transient AI Studio artifacts

- `.aistudio/` contains 76 archive entries, including temporary media storage and rendered screenshots.
- These are not required application source and should be excluded from a clean source import unless a specific runtime asset dependency is proven.

### 3. Express backend is not safe for production import

Static review of `server.ts` (1,842 lines) confirmed a local JSON-file backend using `.data/production-live-db.json`, not the existing Supabase production backend. The server has JSON parsing and Vite middleware but no central authentication/authorization middleware protecting its API routes.

Confirmed route-level issues include:
- `GET /api/production-state` returns the full local snapshot.
- `POST /api/production-state` merges request-body state into the local database.
- Business, product, subscriber, sales, wallet, subscription, message, notification, audit, upload, and backup operations have no demonstrated server-verified user, membership, tenant, business, or branch authorization.
- Backup list/download/create/restore/import routes are exposed without an authorization guard in the reviewed route definitions.
- `POST /api/auth/session-token` accepts `role`, `userId`, and `businessId` from the request body and signs the supplied role; no server-verified identity check precedes token issuance.
- Paymob intention creation is exposed without a verified customer/business authorization step. The webhook route uses `hmacSignature || targetIntent.hmacSignature`, meaning the stored signature is accepted when the caller omits the signature field. This is an unsafe trust boundary and must be redesigned against the actual Paymob callback contract before any payment operation is enabled.
- Predictable fallback values are hard-coded for `PAYMOB_HMAC_SECRET` and `SESSION_JWT_SECRET`. `.env.example` also contains non-empty fallback values for Paymob HMAC, session JWT, and backup encryption salt.
- Startup calls the local database initializer and constructs a seed-backed state that sets `isOfficialProduction: true`. Such seed-derived state must not be represented as real production data.

Disposition: do not import, deploy, expose, or run this server as a production backend. Preserve the intended frontend workflows, then replace the local JSON/API authority with existing Supabase Auth, membership, tenant/business/branch scope, RBAC, RLS, and approved Edge/API contracts.

### 4. Browser-held authority and local persistence

- `src/context/AppContext.tsx` reads and writes business, product, subscriber, settings, wallet, and session state through `localStorage`.
- The authentication session stores role values in browser storage.
- `loginAsAdmin` compares a supplied password with `adminSettings.adminPassword` in client state.
- Customer/subscriber login helpers are client-side operations over locally loaded state.
- The R6 source tree contains no Supabase client initialization or Supabase adapter imports in `src/`.

Disposition: browser state may support non-authoritative presentation preferences only. It must not decide identity, permissions, ownership, or financial state. Replace those flows with server-verified Auth/session and scoped backend adapters.

### 5. Hosting and PWA compatibility

- `package.json` starts `server.ts` for `npm run dev`; the app calls numerous `/api/*` routes.
- GitHub Pages is static hosting and cannot execute the archive's Express server. An unchanged Pages deployment would leave backend-dependent functions unavailable.
- The Vite configuration does not set a GitHub Pages subpath base; the PWA manifest and service worker use root-absolute paths such as `/` and `/manifest.json`. These need an explicit base-path strategy for `/MantiqaTix/` if deployed there.
- `package.json` does not define a test script despite the 12 test files.

Disposition: do not treat a successful frontend build as proof of backend readiness. Build the static UI against the correct base path and implement real shared Supabase adapters separately.

## Import boundaries

Include after sanitization and dependency mapping:
- R6 `src/` and the responsive mobile UI.
- Required `public/` assets after checking their runtime references and licensing.
- Frontend build configuration and a reviewed package/lockfile.

Exclude from production source import:
- `.data/` and every database snapshot/backup.
- `.aistudio/` transient workspace artifacts.
- `server.ts` until a separate security redesign replaces its local JSON server and unsafe routes.
- Any populated environment file or predictable secret fallback. Keep only a placeholder-only environment example if needed.
- Screenshots and audit claims as evidence of production behavior; retain them only as non-authoritative design references.

## Current release decision

- R6 source integrity: PASS
- Existing R6 unit tests: PASS (78/78)
- Dependency install: BLOCKED / NOT VERIFIED
- TypeScript / Vite build: NOT VERIFIED
- Supabase/Auth/RLS/backend integration: NOT IMPLEMENTED in this R6 source
- API authorization and payment security: BLOCKED
- Mobile web preservation: CONFIRMED in source inventory
- Native Android: separate / not present in R6
- Production deployment / cutover: NOT AUTHORIZED
- `FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED`

## Next implementation sequence

1. Create a clean R6 import tree under `apps/aistudio-v6/`, preserving source UI and mobile web components while excluding private workspace/database material and the unsafe Express backend.
2. Reconcile Vite base path, PWA manifest/service worker, package scripts and lockfile with the repository's Pages build.
3. Produce an exact R6 screen/field/API map against the current Supabase contract baseline.
4. Implement read-only public adapters first; then Auth/session and membership-scoped read/write adapters.
5. Add server-side authorization, adversarial tenant/branch tests and payment-specific verification before enabling sensitive workflows.
6. Run full dependency install, typecheck, Vite build, R6 tests, browser E2E, accessibility, mobile/PWA and Preview checks.
7. Keep the deployed root unchanged until approved Preview, backend/security gates, rollback and explicit cutover approval pass.

This report records source inspection and local tests only. It does not claim that R6 has been imported into GitHub, deployed, connected to production Supabase, or certified.
