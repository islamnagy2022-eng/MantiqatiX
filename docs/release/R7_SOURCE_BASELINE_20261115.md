# R7 Source Baseline — 2026-11-15

## Source identity

- User-provided archive: `bizcatalog-manager (11).zip`
- SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`
- The archive identifies itself as an R7 production-release candidate (v19).
- User-provided continuation directive: `كمل-الموقع.txt`
- The archive was extracted for inspection only. The original ZIP and its contents were not modified.

## Architecture verified from source

- The archive describes a dual-engine architecture: local JSON is authoritative and Supabase PostgreSQL is synchronized from the server.
- `server.ts` reads and writes the local production JSON file using filesystem operations, including direct `writeFileSync`; Supabase synchronization is a separate path.
- The archive excludes the `.data/` runtime directory (it is gitignored); no local production JSON database or uploaded user-data file was present in the ZIP.
- This is not an acceptable final production source of truth for a horizontally scaled, restart-safe, transactionally consistent platform. Replace the local authoritative store with PostgreSQL/Supabase transactions, or confine local JSON to development-only fixtures.
- `src/lib/supabaseClient.ts` uses the public/anon key; the inspected client file does not expose the service-role key. The server-side code reads the service-role key on the server.
- The Android WebView wrapper source is present and must be preserved. No signed APK/AAB was found or built in this inspection.

## Release-claim reconciliation

The archive contains `RELEASE_REPORT.md`, `TEST_REPORT.md`, `DATABASE_SECURITY_REPORT.md`, and `RELEASE_MANIFEST_R7.json`. These are claims, not execution evidence.

Observed discrepancies:

1. `package.json` has no `test` script and the archive contains no discoverable unit/integration test or spec files, despite the report claiming 99 tests.
2. The release manifest references `public/releases/mantiqatix-production-release-v19.tar.gz`; that artifact is absent from the archive.
3. The package has `bun.lock`, but no npm lockfile. The inspection environment had no Bun binary and no `node_modules`.
4. `npm run lint` was attempted and failed because `vite/client` type definitions were unavailable without installed dependencies.
5. `npm ci --offline` could not run because there is no `package-lock.json`. A reproducible build was therefore NOT VERIFIED.

These findings do not prove the source cannot build in its original Google AI Studio environment. They do mean the included certification report cannot be independently accepted as proof of production readiness.

## Relationship to the published platform

- The published GitHub Pages production root remains the V6 application on `main`.
- The R7 archive is the current user-provided reference source for feature comparison and selective integration; it is not the deployed production root.
- Do not bulk-overlay this archive onto `main`. Reconcile missing functionality additively, preserve current V6 UX, and retain the Android wrapper.
- Do not treat the archive's local JSON store or its release report as production-certified.

## Release status

**BLOCKED — NOT VERIFIED FOR PRODUCTION**

Required before R7 can be considered a release candidate:

- Make Supabase/PostgreSQL the authoritative persistent store; use transactions and idempotency for financial and order mutations.
- Add a reproducible package-manager/toolchain contract and CI build.
- Add executable unit, integration, RLS, API, concurrency, and browser tests matching the report's claims.
- Verify migrations against a disposable production-schema checkpoint and then Staging.
- Verify secrets remain server-side and complete authentication/authorization/RLS tests.
- Build and test the Android APK/AAB; preserve signing material outside the repository.
- Produce the release artifact referenced by the manifest and verify its checksum.
- Complete backup restore and disaster-recovery drills.

No production database migration, Edge Function deployment, payment, refund, settlement, or data mutation was performed during this inspection.
