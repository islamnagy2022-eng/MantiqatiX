# MantiqaTix R7 — Source Baseline & Current Release Status
Date: 2026-11-11

## Decision

R7 is the latest owner-provided application source for continued development. It is not the deployed Production website and is not Production certified. The current GitHub Pages root remains V6, with /legacy/ retained. No R7 cutover has occurred.

## Scope exclusion — RC40

- Explicit owner instruction: do not work on `source_RC40.zip`.
- Do not inspect, extract, import, merge, build, modify, or reference RC40 as a dependency for this project continuation.
- The only approved source archive for application work in this checkpoint is `bizcatalog-manager (7).zip` (R7).
- Mobile UI/components that exist inside the R7 archive remain part of R7 and may be preserved. This is not permission to bring in RC40 content.

## Source provenance

- Original uploaded source: bizcatalog-manager (7).zip
- SHA-256: 491b25f85218c6ca2196debf860b5225871df710b3997199f1b5a401ef7851ed
- Derived hardened Preview 08: MantiqaTix-R7-Security-Hardened-Preview-08.zip
- Preview 08 SHA-256: fe1c9aeac660e879f1e31cfb0084ca63c5578a5e19802a6e6b8db7323dff6896
- Preview integrity verified; 145 files. .data/, .aistudio/, node_modules/, dist/, and public/releases/ content are excluded.
- Preserved in Preview 08: two src/components/mobile/ files and three android-webview-wrapper/ files.
- The original uploaded archive was not modified. Its local JSON/backups and AI Studio temporary artifacts are not part of the hardened Preview.

## Current R7 verification

- node --test scripts/r7-security-regression.test.mjs: 10/10 PASS.
- Earlier syntax-only transpilation: 93 TS/TSX files, zero syntax diagnostics. This is not a semantic TypeScript check.
- node scripts/check-r7-release.mjs: BLOCKED — 6 findings:
  1. Dependencies/Vite unavailable; production build cannot run.
  2. @supabase/supabase-js is not configured in the R7 package.
  3. Server persistence still relies on local JSON.
  4. Trusted server-side admin identity is not wired.
  5. Real Paymob Intention/Webhook/Inquiry is not implemented; legacy simulation remains fail-closed.
  6. R7 migration declares 7 tables; schema must be reconciled from application usage and actual Production, not a historical claim of 24.
- Full typecheck, Vite build, HTTP runtime, browser E2E, Paymob Sandbox, Supabase Auth/RLS integration, Android build/device tests, backup/restore and rollback remain NOT VERIFIED.

## Production website and Supabase boundary

- Main's production website is still V6; R7 is not imported as the public root and is not deployed.
- Existing Supabase public catalog functions are independently maintained by the current MantiqaTix repository: public-catalog v8 and public-catalog-directory v18. Their live function source was verified to match main.
- A read-only live smoke test from GitHub Actions on 2026-11-11 passed the public disclosure contract: 10 businesses, 47 directory items, 35 items without public price permission, 12 public price rows, 10 direct catalog endpoints, 47 direct catalog items, and 16 quote-only services. This validates the existing public catalog functions only; it does not prove R7 is connected to them.
- No Production rows, schema, Auth settings, RLS policies, grants, payment settings, or live transactions were changed as part of the catalog disclosure fix.

## Remaining high-priority work

1. Map R7 API/domain operations to existing Supabase schema and Edge Functions, without creating duplicate tables or weakening RLS.
2. Implement server-verified Supabase Auth, session validation, active membership and tenant/business/branch authorization for every protected R7 API.
3. Reconcile R7's local migration/data model against the actual live schema in an isolated Preview.
4. Implement official Paymob Intention API, HMAC-SHA512 verification, inquiry/reconciliation and Sandbox E2E before any Live switch.
5. Restore exact dependencies, then run semantic typecheck, build, HTTP/runtime, browser, accessibility, PWA/mobile and Android checks.
6. Prove backup/restore, rollback, monitoring and incident response.
7. Review the deferred default-owner business trigger against the web registration/approval flow using isolated PostgreSQL tests before changing it. No trigger or membership data was changed.

## Rules

- R7 is the development source of truth; R6 and older source trees are reference-only and may be reused only for verified missing capabilities.
- Preserve R7's UI and mobile source; do not bulk-overlay old versions.
- Never transfer .data/, local database JSON, backups, fake paid transactions, or .aistudio/ artifacts to Production.
- Do not claim Production Ready or switch the live root until all P0/P1 gates pass and an approved rollback/cutover exists.

Current status: BLOCKED / NOT CERTIFIED.