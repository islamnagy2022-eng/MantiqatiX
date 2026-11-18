# Pass 351–360 — Category-aware imagery and deployed-origin release verification

Date: 2026-11-18  
Source merge: PR #763 → `258da165cced6a72e36b5ea950299e3e6ebb93bd`  
Deployment: GitHub Actions run `44213092913`

## Implemented and merged

- Applied local category-aware default imagery to public directory listings, with distinct profile and cover fallback selection.
- Preserved valid owner-provided HTTPS profile/logo/cover media as first priority.
- Added one-time local category fallback when an uploaded image URL fails.
- Preserved specialist defaults for unclaimed doctors and pharmacies; claimed listings do not present default artwork as owner-uploaded media.
- Added source-contract tests for category mappings, local assets, owner-image precedence, claimed/unclaimed behavior and broken-image recovery.

## Verification

- PR #763 merged to main as `258da165cced6a72e36b5ea950299e3e6ebb93bd`.
- Exact-head CI passed after a browser-test rerun.
- Main Primary Catalog Frontend Validation run `44213092799` passed build/type-check, professional dashboard browser E2E and employee RBAC PostgreSQL tests.
- GitHub Pages run `44213092913` completed successfully:
  - V6 root, legacy rollback path and V6 Preview alias verified.
  - Deployed-origin Playwright checks passed for the public root, dashboard, mobile and QR routes.
- The uploaded `bizcatalog-manager (11).zip` was inspected for `.webp` files; none are present. The separate 16-WebP photographic asset pack remains unavailable and has not been imported.

## Production release boundary

- RC472 and RC473 migrations remain unapplied; live `directory-listings` remains version 16.
- No Production database, Auth, RLS, GRANT, Edge Function, payment or settlement mutation occurred.
- Full Production remains blocked by off-site backup/restore proof, ordered backend rollout, dataset-specific republication rights and the wider P0 security review.

**Status:** category-aware SVG defaults are merged and deployed. Photographic WebP pack is pending. Full Production launch remains **BLOCKED / NOT CERTIFIED**.
