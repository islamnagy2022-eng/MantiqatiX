# Pass 1260–1264 — MantiqatiX official activity branding fallback

Date: 2026-11-20

## Evidence

- The canonical production activity record is named `MantiqatiX` and is ACTIVE with the official platform showcase source.
- Its `catalog_profile.logo_url` and `catalog_profile.cover_url` currently point to Facebook CDN URLs rather than stable first-party assets.
- The canonical catalog frontend already contains first-party assets at `apps/catalog-frontend/public/mantiqatix-brand-logo.svg` and `apps/catalog-frontend/public/mantiqatix-brand-cover.svg`.
- `resolveDefaultImage()` already maps an exact MantiqatiX activity name to those assets, but `BusinessProfileHeader` preferred any non-empty persisted `logoUrl` / `coverUrl` first. Therefore a non-empty but expired or inaccessible social-CDN URL could suppress the intended first-party fallback.

## Source change

- The official MantiqatiX activity now prefers the bundled first-party logo and cover even when legacy social-CDN URLs remain in profile metadata.
- Owner-selected cover gallery images remain first priority and are not removed or overwritten.
- Other business profiles retain their existing custom logo/cover precedence and category-aware fallback behavior.
- Added a source regression validator and wired it into the primary catalog frontend CI workflow.

## Safety and verification

- Read-only Production lookup only; no database, Storage, Auth, RLS, Edge Function, or customer-data mutation.
- No migration was created because this is a frontend fallback correction and does not require a schema change.
- CI/build/browser verification is pending the pull request workflow. Do not treat this source fix as deployed until the PR passes and the release workflow actually deploys.
