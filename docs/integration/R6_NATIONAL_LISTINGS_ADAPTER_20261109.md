# R6 National Listings Adapter — 2026-11-09

## Purpose
Keep the national public listings feed separate from the public business/catalog cards feed.

## Local implementation
- `src/services/nationalListings.ts` calls the existing `directory-listings` Edge Function.
- Uses keyset pagination: `limit` (1–100), opaque `cursor`, `nextCursor`, `hasMore`, `pageSize`.
- Supports `type`, `governorate`, `district`, `village`, `address`, `specialty`, `functionalGroupId`, `taxonomyCategoryId`, `taxonomySpecialty`, and `q`.
- Sends only the public anon key in the `apikey` header.
- Accepts PUBLISHED rows only. Publication is not proof of identity verification; `isVerified` remains false.
- Preserves listing type, functional group, taxonomy category and specialty separately. No location coordinates are fabricated.
- Unit tests cover mapping, filtering, cursor validation, request construction and public-key-only behavior.

## Validation evidence
- 88/88 R6 tests PASS across 14 test files.
- Security boundary PASS.
- GitHub Pages base/PWA contract PASS (72 TS/TSX files scanned).
- Service-worker scope/cache isolation PASS.
- TypeScript/TSX syntax transpilation PASS (86 files, 0 syntax errors).
- ZIP integrity PASS.

## Package
- `MantiqaTix-R6-national-listings-adapter.zip`
- SHA-256: `e788794893db5c395a836e3d66e5805c620eb895c857f9b104a35d1386983cfa`
- 123 files total; 87 under `src/`; 14 tests; 2 mobile web UI files.

## Release boundary
This is local cleanroom source only. The adapter is not yet connected to a visible R6 screen, and the source tree is not imported into GitHub. Semantic TypeScript, dependency install, Vite build, browser E2E, accessibility, PWA install/update and deployed-origin Preview are not verified. No Production Supabase writes, V6 root replacement, or Android source deletion occurred.

## Next
Wire the adapter to the national directory view with server cursor continuation, deduplication, stale-request protection, and filter-reset behavior. Keep business/catalog cards separate. Then perform full build and browser validation in isolated Preview.

## Medical directory screen wiring (local cleanroom)

- `MedicalDirectoryView.tsx` now consumes the national listings adapter with 20-row keyset pages, healthcare/type/geography/specialty/search filters, debounced search, stale-request protection and ID deduplication.
- National directory rows use a `directory:` identity prefix and cannot be mistaken for business/catalog records. They remain unverified, have no inferred coordinates and do not open storefronts.
- Removed search-triggered fake provider creation/verification and fabricated booking prices from the medical directory.
- Static safety guard: `scripts/verify-r6-medical-directory.mjs` PASS.
- Repeated verification: 88/88 tests PASS; security boundary, Pages/PWA, service-worker isolation and TS/TSX syntax (86 files, zero errors) PASS.
- This wiring is local-only. Semantic TypeScript, Vite build, browser E2E/a11y and deployed Preview remain NOT VERIFIED.

## Latest package
- `MantiqaTix-R6-medical-directory-integrated.zip`
- SHA-256: `babba30693c0a1b7bd44b568bd283b6d04a16f643662cb06c6721e3b24c63b71`
- 124 files total; 87 under `src/`; 14 tests; 2 mobile web UI files.
