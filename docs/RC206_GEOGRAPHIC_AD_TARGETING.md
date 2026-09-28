# RC206 — Geographic Advertisement Targeting

## Scope
MNTY advertisements support hierarchical targeting by country, governorate, and center. A single advertisement can target multiple geographic areas.

## Delivery precedence
1. Exact center.
2. Governorate.
3. Country-wide.
4. Nearest configured target with coordinates when no higher-priority match exists.

The delivery function deduplicates advertisements that target multiple areas and selects one best match tier before returning results.

## Location privacy
The web homepage reuses the existing on-demand location adapter. It requests browser location only when needed and does not introduce continuous tracking.

## Production implementation
- platform_geo_areas
- advertisement_target_locations
- get_mnty_targeted_advertisements(...)
- HOME_SPONSORED
- HOME_HERO

## Security
- Geographic configuration tables are FORCE RLS.
- Direct anon/authenticated table access is revoked.
- Public advertisement delivery is restricted to the sanitized RPC output.
- Only ACTIVE + APPROVED + date-valid advertisements are eligible.

## Verification status
Implemented in Production and source. Full behavioral verification remains partial because Production currently has no real advertisements and the authoritative Egypt governorate/center master dataset has not yet been loaded. No synthetic Production advertisements were created.
