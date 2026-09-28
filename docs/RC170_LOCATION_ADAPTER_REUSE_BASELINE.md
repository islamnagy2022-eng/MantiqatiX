# RC170 — Canonical Location Adapter Reuse

## Result
The existing `web/location-adapter.js` is the Web/PWA integration layer for the canonical RC40 location contract. No second GPS/radius adapter is retained.

## Existing contract reused
- GPS/browser permission state through the existing adapter.
- Search ranges: 1 km, 3 km, 5 km, and 10 km/all.
- Default range: 3 km.
- Provider proximity is based on real branch coordinates when available.

## Security integration
Direct public reads of `branches.latitude/longitude` are not used because the current RLS policy is authenticated-member scoped. Instead, the existing adapter calls `public.find_mnty_nearby_provider_businesses(...)`, a SECURITY DEFINER backend search function that returns only `business_id` and computed `distance_km` for active provider businesses. Raw branch coordinates are not returned to the browser.

## Duplicate work removed
- Removed the temporary `web/location-contract.js` introduced during RC167/168.
- Removed its loader from `web/index.html`.
- Existing `web/location-adapter.js` remains the single Web/PWA location adapter.

## Verification
- `MNTYLocationContract` no longer exists in repository search.
- Nearby-search RPC EXECUTE is granted to `anon` and `authenticated`; raw branch coordinate access remains protected by existing RLS.
- Production browser/mobile E2E and permission UX remain OPEN for final release verification.
