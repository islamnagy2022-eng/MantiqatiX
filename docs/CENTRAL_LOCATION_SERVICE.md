# MantiqatiX Central Location Service

## Purpose

The web/PWA uses `web/location-adapter.js` as its single browser integration boundary for the canonical RC40 location contract. This file preserves the existing `window.MNTYLocationAdapter` global so existing home-page consumers remain compatible; it is not a second GPS engine.

## Current shared contract

- GPS permission and current-position request with a bounded timeout.
- In-memory coordinates only; no continuous location watcher or automatic address persistence.
- Manual coordinate selection through `setManualLocation(latitude, longitude, metadata)`.
- Explicit location reset through `clearLocation()`.
- Coordinate validation for latitude/longitude bounds.
- Distance calculation for straight-line distance only; this is not road distance or ETA.
- Point-in-polygon checks for GeoJSON Polygon geometry or a single ring of `[longitude, latitude]` pairs.
- Existing proximity search integration through the established backend RPCs, with business IDs and computed distances rather than raw branch coordinates.
- Existing range contract: 1 km, 3 km, 5 km and 10 km/all; default 3 km.

## Architecture boundary

The central location adapter owns reusable browser location state and general geospatial utilities. It does not own module-specific eligibility, delivery pricing, opening hours, provider availability, or order acceptance.

Module services must enforce their own rules server-side. In particular, restaurant delivery coverage, fees and order acceptance must be recalculated by a trusted backend at checkout; browser-side coordinates or polygon results are not an authorization decision.

## Provider integrations not yet implemented by this change

This change does not add a map renderer, geocoding provider, reverse geocoding, road routing, ETA, persisted customer address book, or restaurant delivery-zone administration UI. These require a reviewed provider choice, environment configuration, backend authorization, privacy decisions and integration tests. Do not display these capabilities as active until they are implemented and verified.

## Security and privacy

- GPS is requested only when a caller invokes `requestLocation()`.
- Coordinates remain in page memory unless a caller explicitly persists data through a separately authorized workflow.
- Manual coordinates are validated before being accepted.
- Clearing or replacing the location invalidates outstanding GPS requests.
- Provider proximity results are constrained to requested business IDs before being applied.
- The service does not expose raw branch coordinates through the browser-facing proximity result.

## Verification

Run:

```sh
node scripts/validate-location-service.mjs
```

The validator covers coordinate bounds, manual selection, location reset, range compatibility, straight-line distance, polygon inclusion/boundary behavior, malformed geometry, and unsupported-GPS fallback. Passing this contract test does not establish live GPS device behavior, map-provider availability, backend authorization, restaurant delivery-zone enforcement, or production readiness.
