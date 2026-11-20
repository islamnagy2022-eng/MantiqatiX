# Pass 1265–1269 — MantiqatiX branding consistency across catalog surfaces

Date: 2026-11-20

## Completed prior change
- PR #893 merged to main as `472964f5f58f58f961f3619d06c9d6c3487f4853`.
- PR validation confirmed the first-party branding regression test, TypeScript/build, primary catalog browser E2E, isolated employee RBAC PostgreSQL tests, and associated integration/contract workflows.
- GitHub Pages PR validation completed, but its deploy job was skipped by the production release gate. This does not prove a live deployment.

## Additional issue discovered
- The profile header was not the only public surface that used saved `logoUrl` / `coverUrl` directly.
- Homepage business cards and featured imagery, plus Activity module directory cards, could still render the legacy Facebook CDN URLs.
- This follow-up centralizes exact official-brand name detection (including whitespace normalization) in `defaultImages.ts` and uses first-party logo/cover assets on those surfaces while preserving normal merchant media for all other activities.
- Regression validator expanded to assert the profile header, homepage card/featured cover, Activity directory logo/cover and local SVG assets.

## Safety
- Source-only correction; no Production data, Storage, Auth, RLS, Edge, payments or customer records modified.
- Awaiting CI and release-gate verification before merge/deployment.
