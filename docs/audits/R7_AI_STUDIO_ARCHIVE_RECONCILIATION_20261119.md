# R7 AI Studio Archive — Source Reconciliation and Production Blockers

**Reviewed:** 2026-11-19  
**Input:** `bizcatalog-manager (11).zip`, uploaded in the current MantiqatiX work session  
**Archive timestamp:** 2026-11-11 14:10 (ZIP entry timestamps)  
**Archive size:** 46,114,882 bytes  
**Authority:** source inspection only. This report does not certify the release claims inside the archive.

## 1. Source identity and relationship to current main

The archive contains a React 19 / Vite 8 / Express TypeScript application at its root:
- `src/App.tsx`, `src/main.tsx`, `src/index.css`
- `server.ts`
- `src/components/**`, `src/lib/**`, `src/utils/**`
- `package.json`, `vite.config.ts`
- `android-webview-wrapper/**`
- R7 reports, TODO, migration plan, and `RELEASE_MANIFEST_R7.json`

The current GitHub `main` is a different source layout and deployment architecture: the root `package.json` is a small production-verifier package; the application is in `web/**`, with Supabase Edge Functions and SQL migrations under `supabase/**`. The current main tree does not contain the archive's `src/App.tsx`, `server.ts`, or Android wrapper path.

**Decision:** preserve the archive as the R7 AI Studio reference candidate and preserve its Android source. Do not overwrite current `main`, import its server/database model wholesale, or claim it is already deployed. Port UI/features into the current web/backend architecture only after source-to-contract mapping and targeted tests.

## 2. Critical project-reference mismatch

The R7 archive hardcodes:
- Project ref: `moyhiluyhjsujhwlyweuu`
- URL: `https://moyhiluyhjsujhwlyweuu.supabase.co`

The connected Production project used by the current repository is:
- Project ref: `moyhiluyhjsujhwlyeuu`
- URL: `https://moyhiluyhjsujhwlyeuu.supabase.co`

The archive value contains an extra `w` and is not the connected Production project reference. It appears repeatedly in `.env.example`, `RELEASE_MANIFEST_R7.json`, `src/lib/supabaseClient.ts`, `server.ts`, and the archive's reports/TODO.

**Release blocker:** do not place real keys or production data into the archive's configured URL. The archive must use the verified project ref from deployment secrets/configuration and fail closed on mismatch. Do not change the live Supabase project or infer that the wrong ref points to an existing project.

## 3. Secret handling and startup safety

Static source inspection found fallback secrets in `server.ts`:
- `PAYMOB_HMAC_SECRET || 'mantiqatix_paymob_hmac_secret_2026'`
- `SESSION_JWT_SECRET || 'mantiqatix_enterprise_jwt_secret_2026'`
- `BACKUP_ENCRYPTION_SALT || 'mantiqatix_backup_sha256_salt_v19'`

The same backup engine also contains a fallback salt in `src/utils/productionEnterpriseEngine.ts`.

The archive's `src/lib/supabaseClient.ts` selects `SUPABASE_SERVICE_ROLE_KEY` before anon-key variables in a shared client module. The exact browser-bundle exposure is not proven by this static inspection because the Vite build configuration and environment substitution determine what is bundled; however, this is an unsafe source boundary and must be split into a server-only service client and a browser anon-only client. The service-role key must never be referenced by browser-importable code.

**Required correction before any production use:**
1. Remove all hardcoded/default cryptographic and payment secrets.
2. Validate mandatory production secrets at server startup; refuse production startup if absent or weak.
3. Restrict service-role initialization to server-only modules and assert it is absent from generated browser assets.
4. Rotate any real secret previously used with this source if it was ever committed, exposed in a build, or shared outside its intended secret store.
5. Use independent, high-entropy secrets for session signing, backup encryption, and Paymob webhook verification.

## 4. Data authority and dual-engine conflict

The archive declares a dual-engine architecture: a local authoritative JSON file at `.data/production-live-db.json` plus Supabase PostgreSQL. The `.gitignore` excludes `.data/`, and the ZIP does not include the live JSON database or `.env` secrets. The server source contains local file read/write paths and seeded demo/business/customer/financial records, while also exposing Supabase sync/pull paths.

This does not prove that production data was lost; the archive simply does not contain the ignored local state. It does prove that the archive's own description makes local JSON an authoritative engine alongside Supabase, which conflicts with the current project rule that Supabase is the sole authority for identity, permissions and production data.

**Required correction:** Supabase must be authoritative. Local disk may be a cache or export/backup artifact only, with explicit versioning, integrity checks, tenant isolation, idempotent reconciliation and no independent financial truth. Seed/demo data must be isolated from production and must never be promoted as real business, wallet, order or consent data.

## 5. Android wrapper completeness and WebView boundary

The archive contains exactly three Android wrapper files:
- `AndroidManifest.xml`
- `build.gradle.kts`
- `src/main/java/com/mantiqatix/app/MainActivity.kt`

Static references in these files require additional absent project assets:
- `@mipmap/ic_launcher` and `@mipmap/ic_launcher_round`
- `@style/Theme.AppCompat.DayNight.NoActionBar`
- `proguard-rules.pro`, referenced by the release build
- Android project settings/root Gradle wrapper and resource tree

The WebView activity exposes a JavaScript interface and loads the production site. It does not implement an explicit origin allowlist before retaining the JavaScript bridge; ordinary navigation is allowed unless it matches the WhatsApp/telephone special cases. This needs an origin-restricted navigation policy and external-browser handling before a production Android build.

**Status:** archive preserves useful Android source, but it is not a verified buildable/signable Android release. Keep it; do not delete or replace it. Complete the native project, resources, signing, deep links, origin restrictions, lifecycle/offline behavior, privacy permissions, and device/browser E2E before release.

## 6. Claims that are not accepted as release evidence

The archive's `RELEASE_REPORT.md`, `MASTER_TODO.md`, and `RELEASE_MANIFEST_R7.json` make PASS/VERIFIED/CERTIFIED claims, including build, database, authentication, RLS, financial ledger, Paymob, tests and Android. The archive itself does not provide independently reproducible logs for all these claims. In particular:
- The declared Supabase project reference is inconsistent with the connected Production project.
- The database report describes 11 tables; current Production is a much larger evolving schema and must be reconciled against live migrations/objects.
- Static source presence is not proof of effective Production RLS, grants, Auth settings, Edge deployment, payment behavior, backup or restore.
- The Android wrapper is incomplete by file inventory.
- Default secret fallbacks conflict with production fail-closed requirements.

Treat these documents as historical design/intent notes, not as certification. Re-run build, typecheck, tests, browser E2E, database integration and security checks against the exact candidate commit and connected Production contracts.

## 7. Next safe integration order

1. Keep current `main` as the production source baseline; keep the R7 archive immutable as a reference artifact.
2. Correct the archive's project-ref mismatch in a candidate copy only, then verify all environment references against the connected project without exposing keys.
3. Remove fallback secrets and separate browser/server Supabase clients.
4. Reconcile R7 React feature screens with the current `web/**` modules and real Edge/RPC/database contracts. Preserve the existing public UI until each replacement passes visual and functional tests.
5. Port business/catalog functionality before local-engine features; retain Supabase as the only source of truth.
6. Complete Android project structure and WebView origin restrictions independently of the responsive web/PWA release.
7. Do not claim production readiness until encrypted off-site backup and isolated restore rehearsal are independently verified.

**No Production SQL, migration, GRANT, RLS, Auth, Edge deployment, payment, wallet, settlement, user data or role assignment was changed during this archive review.**

## 8. Test and build reproducibility

The archive contains 15 files matching `*.test.ts` / `*test*` under `src`, and the inspected test file uses Node's built-in `node:test` API. However, the archive's `package.json` scripts expose `dev`, `start`, `build`, `preview`, `clean`, and `lint`; there is no `test` script and no CI workflow was present in the archive inventory. `RELEASE_REPORT.md` claims 99 unit tests passed, but that claim is not reproducible through the provided package scripts as uploaded.

The `lint` script is `tsc --noEmit`; it is not a unit-test command. The archive does not include `node_modules`, `dist`, coverage output, or the ignored `.data` runtime state. The exact uploaded archive was not built in this environment because its dependencies and Android toolchain were not installed. Therefore no fresh build/test pass is claimed.

Required: wire the Node test suite into an explicit package script, add a CI workflow that runs typecheck + unit tests + production build, publish test counts from the actual runner, and verify the Android build separately with a complete SDK/Gradle project.
