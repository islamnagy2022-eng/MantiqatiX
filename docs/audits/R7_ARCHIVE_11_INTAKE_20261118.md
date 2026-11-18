# R7 archive (11) — exact upload intake audit

**Review date:** 2026-11-18  
**Artifact:** `bizcatalog-manager (11).zip`  
**SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Size:** 46,114,882 bytes  
**Decision:** **REFERENCE ONLY — NOT APPROVED FOR PRODUCTION IMPORT OR DEPLOYMENT**

## Integrity and inventory

| Check | Result |
|---|---|
| ZIP integrity | PASS — all members passed CRC validation |
| Archive entries | 270 |
| Source files under `src/` | 118 |
| Android wrapper | PRESENT — AndroidManifest.xml, build.gradle.kts and MainActivity.kt source files retained |
| `.env` | NOT INCLUDED — only `.env.example` exists |
| `.data/` production JSON | NOT INCLUDED |
| `public/releases/` release bundle | NOT INCLUDED |
| `dist/`, `node_modules/`, `.git/` | NOT INCLUDED |
| WebP assets | 0 |
| Build / semantic typecheck / runtime tests | NOT RUN for this exact upload |

This exact SHA-256 matches the artifact reviewed in `docs/audits/R7_ARCHIVE_11_PRODUCTION_GATE_20261117.md`; this file is a supplementary inventory addendum, not a different upload. It differs from earlier R7 archives reviewed in the Library, including `bizcatalog-manager (9)(1).zip` (SHA `577752b129763003aa81a9be481460f37a90fc2a46688f3476dce78bd59f6a1b`, 99 source files). Those earlier archives remain historical evidence only.

## Manifest and release-claim mismatches

- `RELEASE_MANIFEST_R7.json` labels the archive `R7-v7.0.0`, target `Final Commercial Production`, and architecture `Dual-Engine (Local Authoritative JSON + Supabase PostgreSQL)`.
- The manifest's Supabase project reference does not match the actual production project `moyhiluyhjsujhwlyeuu`.
- The manifest claims 26 verified businesses, but this archive does not include the referenced live `.data/production-live-db.json` or a verified production data export. These businesses cannot be certified as production records from this artifact.
- `MASTER_TODO.md` and `TODO.md` claim a 99/99 test pass and a v19 production release bundle, but `package.json` has no `test` script and the claimed `public/releases/` artifact is absent from this ZIP.
- `package.json` defines `lint` as `tsc --noEmit`; that is a typecheck command, not an independent lint suite. No dependency installation, build, typecheck or test run was performed for this upload.

## P0 security and architecture findings

1. `server.ts` contains hard-coded fallback values for session JWT signing, backup encryption salt and Paymob HMAC secret. Production secrets must be required from a secure environment and must fail closed when absent.
2. `src/App.tsx` contains hard-coded demo account credential strings and client-side role-switcher login helpers. These are not production authentication.
3. `src/context/AppContext.tsx` persists authentication/session and role state in browser storage. This conflicts with the project rule that Supabase Auth and server-verified membership are the authority.
4. The manifest explicitly declares local JSON as an authoritative data engine. Supabase must remain the source of truth; browser/local JSON cannot authorize roles or replace production records.
5. The Android wrapper source is preserved, but the archive does not establish a reproducible signed APK/AAB build or release artifact.

No credential values are reproduced in this audit.

## Source-of-truth reconciliation

- **Current production implementation:** GitHub repository `islamnagy2022-eng/MantiqatiX`, `main` commit `777884bd76c75d792d9e7a565da26fc7e8fca4b7`.
- **Latest user-supplied UI/behavior candidate:** this exact R7 archive, SHA above. Keep it as a reference candidate; do not replace current main or deployed code with it.
- **Older R7 archives:** retain as historical reference; do not assume they are identical to the current upload.
- **Android:** preserve the wrapper files; do not delete them during source reconciliation.
- **Production data:** use Supabase only. Demo/seed records and local JSON are not verified production businesses or customers.

**Disposition:** retain this archive unchanged for comparison and selective feature extraction. Any desired UI/behavior change must be ported into the current main architecture, then pass semantic typecheck, build, browser/mobile tests and the full security gate. Do not import this archive wholesale or publish it as the production root.
