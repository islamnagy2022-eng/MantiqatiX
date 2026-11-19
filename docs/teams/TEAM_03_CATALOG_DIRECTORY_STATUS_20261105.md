# Team 03 — Catalog & Business Directory Status
**Date:** 2026-11-05  
**Reviewed repository baseline:** `218d4c768021fbc94d21ffd442b3fcdacd16e4f8`  
**Scope:** Read-only source and CI evidence review. No production database, Auth, RLS, GRANT, Edge Function, business record, product record, or deployment mutation.

## Verified implementation in the current application

- The production website remains the existing `apps/catalog-frontend`; the standalone root-level AI Studio V6 candidate is not integrated and is not a replacement baseline.
- `DirectoryView.tsx` implements the activity directory using registered businesses plus public directory listings. It filters both streams by query, activity/taxonomy, specialty, and Egyptian administrative location.
- Registered businesses are filtered to public-enabled/official-showcase, ACTIVE, and not frozen. Within registered businesses, `isVerified` sorts ahead of unverified records; distance and configured image completeness are secondary ranking signals.
- Public directory listings are restricted to `PUBLISHED` and not `CLAIMED`, and are rendered after registered businesses. This keeps unclaimed/source-derived pages from being represented as verified activities.
- Initial rendering is capped at 20 combined entries. “رؤية المزيد” increments the visible count by 20 and requests the next public-listing page using the server cursor. Duplicate listing IDs are merged client-side.
- The public listing client uses the existing `directory-listings` Edge Function and keyset cursor contract; no new table or API was introduced in this review.
- Public catalog bootstrap hydrates `directoryBusinesses` and `directoryProducts` through the existing `fetchPublicDirectory()` path in `AppContext.tsx`.
- Existing claim and owner-update flows use authenticated calls to the existing directory Edge Function. The code distinguishes a claim request from ownership/verification and does not grant ownership merely because a listing exists.
- Doctor-source permission evidence and doctor batch import have explicit server action contracts in `directoryListings.ts`; doctor import/publication remains a separately gated workflow and is not being enabled by this audit.

## Relevant code paths inspected

- `apps/catalog-frontend/src/components/DirectoryView.tsx`
- `apps/catalog-frontend/src/components/DirectoryListingsView.tsx`
- `apps/catalog-frontend/src/context/AppContext.tsx`
- `apps/catalog-frontend/src/lib/directoryListings.ts`

## CI and deployment evidence inspected

The repository's release reconciliation records the scoped Catalog Pilot as deployed, separate from the full-platform gate. Workflow job records were queried directly:

- Primary validation run [41916803905](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41916803905): build/TypeScript/taxonomy/geography/OAuth/catalog contracts, Playwright browser E2E, and isolated PostgreSQL employee/RBAC jobs all completed successfully.
- Pages deployment run [41916804007](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41916804007): validation and deploy jobs completed successfully; deployed-origin browser checks and live directory keyset pagination smoke test completed successfully.
- Health monitor run [41916803979](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/41916803979): Pages, Supabase health, read-only database probe, and catalog root/assets checks completed successfully.
- Product rendering/price-boundary correction is present in commit `fe9e9f57b780b01c49940349dccf3bbac67efaae`; preserve this correction.

These are evidence for the scoped catalog pilot and the recorded release commit(s), not a claim that every later documentation-only main commit received a fresh full CI run.

## Remaining Team 03 work

1. Obtain the actual `bizcatalog-manager (5).zip` source archive and verify its SHA-256 against the supplied baseline before attempting V6 parity work. The archive was not available in the current continuation; reports and `index.html` alone are insufficient to integrate its source.
2. Build a read/write capability matrix mapping candidate activity, specialty, business, product, service, media, price, geographic, claim, and verification fields to the exact current Supabase schema and authorized server contracts.
3. Compare candidate functionality with the deployed directory and owner/admin screens; implement only additive parity gaps on an isolated branch, preserving current UI and existing server contracts.
4. Add or extend adversarial E2E for verified/unverified ordering, 20-item initial window, cursor continuation without duplicates, query/filter changes invalidating stale pages, claim/owner authorization, and public product rendering/pricing boundaries.
5. Reconcile any candidate snapshot only in a dry-run report with duplicate/reference/PII checks. Never publish private snapshots or write them to Production during reconciliation.
6. Keep doctor publication, payments, finance, inventory/order mutations, and any new shared write path blocked until their separate authorization, audit, and production deployment gates are proven.

## Status

- `IMPLEMENTED`: core directory read, taxonomy/specialty filtering, Egyptian geography, verified-first registered-business ordering, unclaimed listing separation, 20-item progressive rendering, keyset pagination, public catalog bootstrap, and existing claim/owner flows.
- `VERIFIED`: scoped pilot CI, isolated RBAC PostgreSQL tests, deployed-origin directory pagination smoke test, Pages deployment, and health monitor for the recorded runs above.
- `WAIT`: V6 source archive acquisition and exact candidate-to-production schema/contract mapping.
- `BLOCKED`: V6 cutover; new production writes or schema changes; doctor republication; full-platform Production Ready declaration.

**Release labels:** `CATALOG_PILOT_GATE=PASS`; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.
