# PASS 2411–2420 — AI Studio R7 archive source and security review

**Review date:** 2026-11-25  
**Artifact:** user-uploaded `bizcatalog-manager (11).zip` (AI Studio export dated 2026-11-11)  
**Instruction source:** user-uploaded `الامر-التقني.txt` and repository `docs/MASTER_SOURCE_OF_TRUTH.md`  
**Canonical repository baseline:** `main @ 3f67694a5a1da9c8f217d1883dda4a324710bc0e`  
**Production Supabase:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Mode:** archive inspection and source comparison only; no Production or deployable source mutation.

## Decision

**Preserve the R7 ZIP as a historical/reference artifact. Do not import it wholesale, point it at Production, or replace current `main`.** The archive is a separate implementation with a conflicting database identity, a competing local-authoritative data model, and unsafe static secret fallbacks. It is not a verified production release for the current platform.

## Source identity and architecture comparison

| Check | Uploaded R7 archive | Current canonical repository |
|---|---|---|
| Frontend entry | root `src/App.tsx` | `apps/catalog-frontend/src/App.tsx` |
| Runtime model | root `server.ts`, Express on port 3000 | deployed catalog SPA and its documented Supabase runtime contract |
| Root package scripts | `dev/start: tsx server.ts`, `build: vite build`, `lint: tsc --noEmit`; no test script | root package is release-verification tooling; app package and lockfile are under `apps/catalog-frontend` |
| Supabase reference | `moyhiluyhjsujhwlyweuu` | actual Production project `moyhiluyhjsujhwlyeuu` |
| Claimed authoritative data | `.data/production-live-db.json` plus Supabase as a dual engine | Supabase is authoritative for identity, authorization and production data |
| Production deploy surface | standalone Express/Vite artifact | canonical GitHub Pages catalog root and rollback topology |

The uploaded manifest and its application code contain the R7 reference `moyhiluyhjsujhwlyweuu`, which does not match the connected Production project `moyhiluyhjsujhwlyeuu`. This is a project-identity mismatch; no request was sent to the archive's claimed project.

The current repository has no root `server.ts`, `src/App.tsx`, or root `src/lib/supabaseClient.ts`; its frontend is under `apps/catalog-frontend`. The uploaded archive therefore cannot be treated as a drop-in update to the current repository.

## Security blockers found in the archive

1. **Known static cryptographic fallbacks.** Root `server.ts` falls back to literal values when environment secrets are missing:
   - `mantiqatix_paymob_hmac_secret_2026`
   - `mantiqatix_enterprise_jwt_secret_2026`
   - `mantiqatix_backup_sha256_salt_v19`

   A production service must fail startup when required secrets are absent or invalid; these fallbacks must not be used for webhook verification, session signing, or backup encryption.

2. **Competing local authority.** `server.ts` initializes `.data/production-live-db.json` from seed collections when the local store is initialized. The included default state is populated from `INITIAL_BUSINESSES`, `INITIAL_PRODUCTS` and other seed sources, and the builder marks seeded businesses verified. This is not an acceptable authority for production identities, approvals, orders, wallet balances, or permissions.

3. **Privileged-key selection in a shared Supabase client module.** `src/lib/supabaseClient.ts` selects `SUPABASE_SERVICE_ROLE_KEY` before the anon/publishable key. The review found no imports of this module in the uploaded source tree, so this is not evidence that a service key was actually bundled or disclosed. It remains an unsafe dormant design path and must be removed before that module is used by browser code.

4. **Release claims are not independently established.** The archive documents `23/23` production gates and `99/99` tests. Its root `package.json` does not define a test script; 15 test files exist, but this review did not execute them. The documented AI Studio commands `compile_applet` and `lint_applet` are not repository scripts. These claims remain archive assertions, not production verification.

## Required handling

- Keep the archive unchanged as a reference; do not overwrite current frontend source or database migrations with it.
- Reuse a component only after reviewing it against `apps/catalog-frontend`, current Supabase RPC/RLS contracts, accessibility, and source ownership.
- If any server-side module is ever ported, remove static secrets, require runtime secret validation, use the exact Production project identity, and make Supabase the only authority for auth, authorization and persistent business/financial data.
- Validate all imported changes on a dedicated branch with exact-head CI and deployed-origin tests. No direct Production SQL, Auth, Storage, Edge, payment or deployment changes are authorized by this archive review.

## Evidence boundary

- Inspected the uploaded R7 manifest, continuation/release reports, root package, `.env.example`, Vite config, root `server.ts`, `src/lib/supabaseClient.ts`, seed initialization and test-file inventory.
- Compared paths and package layout with current GitHub `main` and inspected current `apps/catalog-frontend` source/runtime entrypoints.
- No archive code was copied into the canonical app.
- No Production migration, query that changes data, Auth setting, RLS/GRANT, Storage, Edge Function, payment, secret, or website deployment was changed.

**Disposition:** archive preserved; current `main` remains canonical; R7 wholesale import is **BLOCKED** pending a reviewed, incremental port and security remediation.
