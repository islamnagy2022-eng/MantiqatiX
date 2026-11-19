# R7 Archive Revalidation — 2026-11-19

**Archive:** `bizcatalog-manager (11).zip`  
**SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Integrity:** ZIP test passed; 233 extracted files; 15 test files; 3 Android wrapper files; one Supabase migration file.  
**Disposition:** UNTRUSTED DEVELOPMENT CANDIDATE — NOT DEPLOYABLE.

This is a source inspection of the uploaded archive, not a live deployment or penetration test. The archive's own SECURITY/RELEASE/DATABASE reports claim verification, but the source contradicts those claims.

## Confirmed source-level P0 findings

1. **Unauthenticated privileged token minting:** `server.ts` `POST /api/auth/session-token` accepts caller-supplied `userId` and `role`, defaults to `admin_main` / `super_admin`, and issues a signed token without authenticating the caller.
2. **Unauthenticated production-state disclosure and mutation:** `GET /api/production-state` returns the complete local snapshot; `POST /api/production-state` accepts a caller-supplied object and merges it into the authoritative JSON store. Neither route shows authentication/authorization middleware at the route declaration.
3. **Hard-coded secret fallbacks:** `PAYMOB_HMAC_SECRET` and `SESSION_JWT_SECRET` fall back to static source literals in `server.ts`; `DEFAULT_SESSION_SECRET` and Paymob helper defaults also exist in frontend-importable utility code.
4. **Weak default/admin bypass credentials:** admin login falls back to `admin` and explicitly accepts the fixed phone-like string as an alternative password. Demo customer credentials are prefilled in production-facing UI paths.
5. **Client-side trust boundary:** `src/context/AppContext.tsx` changes the local auth session and dashboard view before the asynchronous backend login result is checked. Authorization must not rely on this state.
6. **Service-role key selection in a client-imported module:** `src/lib/supabaseClient.ts` selects `SUPABASE_SERVICE_ROLE_KEY` from `process.env` in a module imported by the application. A production build/bundle inspection is required to prove whether the key is emitted; until proven otherwise this is a release-blocking secret-exposure risk. Never configure the service-role key as a Vite-exposed variable.
7. **Dual authoritative storage conflict:** the archive describes local JSON as authoritative while the unified project directive requires Supabase to own identity, authorization and production data. The local JSON endpoint pair is not a safe production source of truth.

## Database / release evidence

- The archive contains exactly one SQL migration: `supabase/migrations/20261110_mantiqatix_master_production_schema.sql`.
- That migration creates 7 tables and enables RLS on those 7 tables; the accompanying report's 11-table / all-table claims are unsupported by this archive.
- The migration includes broad policies that need redesign and adversarial testing, including public product SELECT with `USING (TRUE)`, and customer order INSERT with `WITH CHECK (TRUE)` in the supplied report/schema contract. Do not treat the report's RLS matrix as a verified effective production policy inventory.
- The Android wrapper contains only 3 files and is not a complete independently buildable Android project (no root Gradle settings/wrapper evidence was found).
- `package.json` declares build/lint scripts but no test script. The 15 `.test.ts` files are not wired to a declared test runner in this archive.
- The archive's release claims (99 tests passing, production certified, restore verified) were not independently reproduced.

## Verification attempted in this pass

- ZIP integrity: PASS.
- SHA-256: recorded above.
- Source inspection: completed for the client Supabase key selection, server token/state routes, admin login and frontend auth transitions.
- `npm install --ignore-scripts --no-audit --no-fund`: timed out in this environment.
- Build, TypeScript check, unit tests, browser E2E and Android build: NOT RUN; dependencies/toolchain were not installed.
- No production database, Auth, RLS, GRANT, Edge Function, payment, wallet, website deployment or customer data was changed.

## Required remediation before R7 can be promoted

1. Remove all privileged token-minting routes; use Supabase Auth `getUser` and server-side protected platform-admin registry checks.
2. Remove or strongly authenticate and scope the production-state endpoints; do not persist client-supplied whole-database snapshots.
3. Fail startup when required production secrets are absent; remove static fallback secrets and rotate any value that may have been used.
4. Remove default/admin bypass credentials and demo credential autofill from production builds.
5. Make frontend role state a display-only projection of a server-verified Supabase session; enforce authorization at every API/RPC boundary.
6. Split browser Supabase client (publishable/anon key only) from server-only service-role client; inspect built assets and secret-scan output.
7. Reconcile the archive schema against the live Supabase ledger and current main migrations; redesign RLS with disposable adversarial PostgreSQL tests.
8. Add a declared deterministic test runner, lockfile-based install, CI build/type-check/test/E2E and an actual Android Gradle project.
9. Preserve R7 as an immutable reference archive; do not overwrite the live catalog or promote this archive directly.

**Release decision:** R7 archive import/deployment remains BLOCKED. The verified catalog deployment on `main` is a separate scoped release and must remain intact.


## 2026-11-19 — R7 API route authorization surface recheck (Pass 910–919)

**Scope:** read-only static inspection of the exact uploaded R7 archive, file `server.ts`; this is not a live penetration test.

- [x] Reopened the server route declarations and confirmed the application-wide middleware before route registration contains JSON parsing and an IP rate limiter, but no global authentication/authorization middleware.
- [x] Static route-handler scan identified **54 POST/PUT/PATCH/DELETE handlers** whose route-local handler bodies contain no recognizable signed-session verification or authorization guard.
- [x] Manually confirmed representative high-impact write paths directly mutate the local JSON database from caller-supplied data without a visible route-level identity/scope check: `/api/businesses`, `/api/products`, `/api/subscribers`, `/api/sales`, `/api/orders/:id/status`, `/api/wallets/transaction`, `/api/settings`, `/api/grants`, `/api/merchant-hub/ledger`, and `/api/finance/audited-transaction`.
- [x] Confirmed `/api/finance/audited-transaction` accepts caller-supplied `actorId` and `actorRole` and defaults the actor role to `super_admin` before invoking the local financial transaction helper; this is a critical trust-boundary defect, not proof of a live financial exploit.
- [x] Distinguished intended public ingress paths (for example contact submission and payment webhooks) from privileged mutations. The 54-count is a static screening result, not a claim that every endpoint should require login; each route needs an explicit public/actor/tenant/platform authorization contract.
- [ ] Build a route inventory with an explicit policy for every API endpoint: PUBLIC_INGRESS, AUTHENTICATED_USER, TENANT_MEMBER, BUSINESS_BRANCH_SCOPED, PLATFORM_ADMIN, SERVICE_TO_SERVICE, or DISABLED.
- [ ] Implement shared Supabase Auth token verification and fail-closed authorization helpers; attach them per route according to the approved policy. Do not trust client-supplied role, actorId, businessId, branchId, or localStorage.
- [ ] Move privileged writes from local JSON into narrowly scoped Supabase RPC/Edge contracts with RLS/ACL and audit atomicity. Keep finance and wallet routes disabled until their backend contracts are verified.
- [ ] Add negative tests for anonymous callers, forged roles, cross-tenant and cross-branch IDs, inactive memberships, wrong platform-admin registry state, and replay/idempotency.
- [ ] Add a static CI gate requiring every route to be explicitly classified and every privileged route to declare an authorization guard; exceptions must be narrow, documented, and tested.

**Evidence boundary:** no R7 code was modified in this pass; no Production DB/Auth/RLS/GRANT/Edge/payment/wallet/site changes were performed. R7 remains an untrusted reference candidate, not deployable.
