# RC168 — Web Location Adapter Baseline

## Source contract reviewed
The RC40 source archive was reviewed before implementation. The canonical Android location contract includes:
- `LocationEngine`
- `LocationSelectorModal`
- `SmartLocationCategoriesSection`
- `HomeScreenDisplaySystem`
- `AdCampaignEngine` radius targeting

The existing range selector in `HomeScreenDisplaySystem` is 1 km, 3 km, 5 km and all.

## Implementation
Added `web/location-adapter.js` as a web/PWA integration adapter only.

It:
- requests browser location once on initial home load when the browser supports it;
- keeps coordinates in page memory only;
- uses the existing 1/3/5/10-km range semantics;
- resolves nearest branch distance through the existing `branches` relationship by `business_id` when coordinates are available;
- sorts providers by distance and filters to the selected range;
- leaves records without usable coordinates as unverified-distance results rather than inventing proximity;
- does not create a new GPS engine, database table, radius model, or continuous location watcher.

Home integration:
- location status and range selector are shown in the nearby section;
- featured provider results use the same filtered/ranked provider set;
- search and feature-flag behavior remain unchanged.

## Verification
- Source/archive contract review: COMPLETE.
- GitHub source integration: COMPLETE.
- CI for latest RC168 commit: NOT VERIFIED; no workflow run was returned for the commit checked.
- Browser GPS permission test: NOT VERIFIED.
- Mobile accuracy/permission UX: NOT VERIFIED.
- Public `branches` RLS/coordinate exposure: NOT VERIFIED in this step.
- Production end-to-end nearest-results test: NOT VERIFIED.
