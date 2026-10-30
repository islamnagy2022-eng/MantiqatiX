# MantiqaTix — Catalog Source Convergence Audit
Date: 2026-10-30
Status: DEPLOYED / BROWSER VERIFIED for the catalog convergence scope; full platform Production Gate remains blocked.

## Objective
Converge the uploaded legacy catalog snapshot and RC40 reference package into the current website-first MantiqaTix repository without replacing the deployed catalog UI, duplicating business logic, importing demo data, or weakening backend authorization.

## Authoritative baseline
- Repository: `islamnagy2022-eng/MantiqaTix`
- Baseline commit before this change: `0e8972e7db34b468902ed857d7362b40ea3e6821`
- Primary website: `https://islamnagy2022-eng.github.io/MantiqaTix/`
- Current catalog application: `apps/catalog-frontend`
- Shared backend and live database contracts remain authoritative; archive contents are reference material, not production truth.

## Uploaded source inventory

### A. Owner operating specifications 00–19
All 20 uploaded Markdown instructions are already preserved together in `docs/specifications/OPERATING_SPECIFICATIONS_00_19.md`. Stable keys SPEC-00 through SPEC-19 and cross-register links are in `docs/specifications/SPECIFICATION_TODO_TRACEABILITY.md`.
- These instructions govern administration, engineering, finance, marketing, design, CRM, sectors, identity/RBAC, security, unified platform, analytics, operations, automation, content, monitoring, backup, QA, release, and governance.
- Their presence does not mean each module is implemented or production-verified.
- Keep `TODO_PRODUCTION.md`, `docs/MASTER_PRODUCTION_TODO.md`, and the module acceptance register linked rather than creating competing TODO lists.

### B. RC40 source archive
- Uploaded file: `source_RC40.zip`.
- SHA-256 calculated from the uploaded bytes: `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`, matching the supplied checksum value. The checksum sidecar names the original canonical archive filename; the uploaded copy was renamed.
- RC40 is an Android/Gradle source package plus Supabase migrations, Edge Functions, tests, security matrices, and module UX references.
- Reuse Android domain concepts and workflows through the existing website/backend contracts. Do not copy Android Room persistence, Android-specific UI, or legacy direct-client mutations into the website.
- The existing `docs/RC40_MODULE_REUSE_EXECUTION_MATRIX.md` remains the authoritative module-level reuse map.

### C. Legacy catalog snapshot
- Uploaded file: `bizcatalog-manager (3).zip`, an earlier React/Vite catalog prototype dated 2026-10-26.
- Its source includes an app shell, Navbar, MerchantDashboard, storefront profile/catalog components, AppContext, types, taxonomy directory, business rules/tests, and `seedData.ts`.
- The snapshot is a historical feature/UX reference. It is not the current production baseline and must not replace current main.
- `seedData.ts` and AI Studio temporary media are not production business records. Do not import them into Supabase or the public directory.
- Do not copy browser-side Gemini credentials or direct provider calls. The current server-authorized image proxy, rate limits, audit trail, and storage flow remain the approved path.

## Legacy catalog → current repository mapping

| Legacy snapshot area | Current canonical implementation | Merge decision |
|---|---|---|
| `src/App.tsx` | `apps/catalog-frontend/src/App.tsx` | Keep current role-gated app shell and route handling. |
| `src/components/Navbar.tsx` | `apps/catalog-frontend/src/components/Navbar.tsx` | Keep current navigation and authenticated role guards. |
| `MerchantDashboard.tsx` | `apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx` plus current dashboard modules | Reuse concepts only; current owner/employee permission contracts win. |
| `BusinessProfileHeader.tsx`, `CatalogSection.tsx` | `apps/catalog-frontend/src/components/storefront/` | Keep current public storefront, published catalog, order, and contact boundaries. |
| `AppContext.tsx` | `apps/catalog-frontend/src/context/AppContext.tsx` | Keep one canonical app context and its server-backed loading/mutation contracts. |
| `types/index.ts` | `apps/catalog-frontend/src/types/index.ts` | Current canonical types win; do not fork duplicate business models. |
| `DirectoryView.tsx` | `apps/catalog-frontend/src/components/DirectoryView.tsx`, `DirectoryListingsView.tsx`, `lib/directoryListings` | Current folder taxonomy, geographic search, verified-first ranking, and unified public results win. |
| `utils/rules.ts` and tests | `apps/catalog-frontend/src/utils/rules.ts` and current tests | Port only a missing rule after semantic comparison and tests; do not replace current production rules wholesale. |
| `seedData.ts` | None | Excluded: demo/seed data must never become public production data. |
| AI Studio temporary media / Gemini metadata | Current server-authorized image proxy and media storage | Excluded from direct copy; retain server-side secrets, scope checks, quotas, and audit logging. |

## Current unified catalog behavior

1. Registered businesses enter public results only when `publicEnabled` or `isOfficialShowcase` is true, operational status is `ACTIVE`, and the business is not frozen.
2. Registered business results are sorted with `isVerified=true` first. Completeness, trusted distance, and geographic preference are secondary tie-breakers; none can outrank a verified record with an unverified one.
3. Published unclaimed public-directory listings are fetched through the read-only public directory path and remain in the same visible result grid after verified registered businesses.
4. Unclaimed directory listings and registered-but-unverified businesses remain visibly marked as unconfirmed. Their records are not silently converted into verified business accounts.
5. Group/category/specialty folder navigation and governorate/markaz/village/area filters remain intact.
6. Existing mobile three-column card layout and current visual identity are preserved.

### Minimal UI improvement in this change
- Added a compact result summary above the existing unified grid: verified count in the existing green trust treatment and unverified count in the existing red warning treatment.
- The unverified count includes both registered businesses without verification and published unclaimed directory listings.
- Existing card badges, category counters, filters, card geometry, homepage, covers, routes, and storefront behavior are not redesigned.

## Validation contract
- PR [#531](https://github.com/islamnagy2022-eng/MantiqatiX/pull/531) merged as `907e2448584015095de47432ee62ff61b9c1edf7`.
- Exact-PR Primary Catalog Frontend Validation [run 41013793105](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41013793105) passed build/typecheck, employee RBAC PostgreSQL, and browser E2E, including the new verified/unverified count summary.
- Exact-PR supporting validation passed: RC425/MantiGO atomicity [41013793056], MantiGO privacy [41013792960], Backend-only/RC450/approval audit [41013793069], Module Professionalization [41013792970], Flexible Commission [41013793079], SMM deferred contract [41013792979].
- Main Primary Catalog Frontend Validation [run 41013924236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41013924236) passed build, employee RBAC PostgreSQL, and browser E2E.
- Main Pages deployment [run 41013924305](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/41013924305) passed validation, deployed the catalog to GitHub Pages, verified the primary catalog root, and passed the deployed-origin browser checks for dashboard routes, mobile layout, membership scopes, and permanent QR links.
- Main supporting checks also passed: Backend-only/RC450/approval audit [41013924357], Module Professionalization [41013924285], MantiGO privacy [41013924219], SMM deferred contract [41013924296], and Production Health Monitor [41013924400].
- The current deployed site is `https://islamnagy2022-eng.github.io/MantiqaTix/`. The verified-first summary is included in the built and deployed artifact.
- No Production database, migration, Auth/RLS/grant, Edge Function, secret, payment, wallet, or financial data mutation is authorized by this convergence task.

## Remaining integration and release gates
- Authenticated real-user activity creation/publication/edit/readback and owner assignment.
- Duplicate submission/idempotency and owner/tenant/branch isolation E2E.
- Permanent public links and QR generation/scan on real devices.
- Social profile editing and click-through under owner scope.
- Real authenticated AI image generation and storage/fallback verification.
- Paymob, subscriptions, finance/settlement, deployed Edge semantic parity, and migration reconciliation.
- Backup/restore, rollback, alert delivery, RPO/RTO, accessibility, and real-device checks.

**Overall Production Gate remains BLOCKED / NOT CERTIFIED.** This audit records source convergence and a narrow catalog UI enhancement; it does not certify the whole platform.
