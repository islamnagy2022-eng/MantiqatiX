# R6 GitHub Pages Base Path and PWA Hardening — 2026-11-09

## Scope

This checkpoint records work on the locally sanitized, user-approved R6 source only. It does not claim that R6 has been imported into GitHub, built, deployed, or certified for Production.

## Source identity

- Original archive: `bizcatalog-manager (6).zip`
- Original SHA-256: `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`
- Latest sanitized package: `MantiqaTix-R6-preview-basepath-hardened.zip`
- Sanitized package SHA-256: `aa9066eff3f630040ff3e534a3a68b82a801fb16179cfda2b286dc968ba9de1e`
- ZIP integrity: PASS.
- Inventory: 121 files; 85 under `src/`; 48 React components; 13 test files; 2 mobile web UI components; 6 reference captures.
- No private `.data/`, `.aistudio/`, local `server.ts`, populated `.env`, `node_modules/` or backup snapshots.

## Implemented locally

1. `vite.config.ts` now reads `VITE_BASE_PATH`, defaults to `/`, and rejects a non-absolute path or a path missing its trailing slash.
2. `src/main.tsx` registers `sw.js` under `import.meta.env.BASE_URL` and constrains the service-worker scope to the same base.
3. The PWA manifest uses relative `id`, `start_url`, `scope`, and icon URLs, resolving under the Preview subpath.
4. The service worker resolves static assets and notification destinations from `self.registration.scope`, not the domain root.
5. Service-worker cache cleanup is isolated to the `mantiqatix-r6-pwa-` namespace. It no longer deletes unrelated caches belonging to other applications on the same origin.
6. R6 logo references now use the shared base-aware `PLATFORM_OFFICIAL_LOGO_URL`.
7. Added `scripts/verify-r6-pages-base.mjs`, `scripts/test-r6-service-worker.mjs`, and package scripts for `test`, `basepath:check`, `pwa:check` and `verify:local`. The `tsx` dependency was already declared; no dependency or lockfile change was needed.

## Verification evidence

| Check | Result |
|---|---|
| R6 unit tests | **83/83 PASS**, 13 test files |
| Security-boundary assertions | **PASS** |
| Pages base/PWA contract | **PASS**, 71 non-test TS/TSX files scanned |
| Service-worker scope/cache isolation | **PASS**, Node VM runtime harness |
| TypeScript/TSX syntax transpilation | **PASS**, 84 files, 0 syntax errors |
| ZIP integrity | **PASS** |

Test-runner detail: unit tests were rerun with Node's built-in test runner, `TS_NODE_TRANSPILE_ONLY=true`, explicit ESNext/Bundler compiler options and the local ts-node ESM extensionless-import resolver. The package `tsx --test` script remains unverified because dependencies are not installed in this offline runtime. Base-path and service-worker runtime harnesses run directly on Node.

## Not verified

- Dependency installation from the committed lockfile.
- Semantic TypeScript check.
- Vite production build.
- Browser E2E, visual comparison, accessibility, mobile viewport and PWA install/update.
- Deployed-origin R6 Preview.
- Supabase Auth/membership/RBAC, data writes, finance/payments, backup/restore or any full-platform production gates.

## Preservation and release boundary

- `src/components/mobile/` remains in R6.
- Native Android archive `source_RC40.zip` remains separate and preserved; SHA-256 `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`. ZIP integrity and Gradle wrapper/build files plus `AndroidManifest.xml` are present. It is not integrated into `main`.
- R6 source is still **not imported into the GitHub repository**. This is local cleanroom work only.
- Deployed V6 root and `/legacy/` are unchanged. No Supabase Production writes, migrations, Auth/RLS/GRANT modifications, payment actions or Pages deployment were performed.
- `FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED`.

## Next action

Import this exact sanitized R6 tree into `apps/aistudio-v6` on a dedicated branch, preserving its mobile web UI and keeping native Android separate. Then install dependencies, run semantic type/build and browser/PWA/security validation, and publish an isolated Preview only after all required gates pass.
