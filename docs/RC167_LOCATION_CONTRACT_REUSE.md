# RC167 — Location/GPS Contract Reuse

Reviewed the existing MantiqatiX source archive before changing public home location behavior.

Existing canonical location components identified in the source archive:
- `LocationEngine.kt`: centralized GPS/location state, manual location fallback, geographic hierarchy, activated district control, and current-location access.
- `LocationSelectorModal.kt`: GPS/manual selector, activated-only filtering and geographic search.
- `SmartLocationCategoriesSection.kt`: location-aware smart categories including nearest, district trending and local offers.
- `HomeScreenDisplaySystem.kt`: existing distance range controls of 1 km, 3 km, 5 km and 10 km/all.
- `AdCampaignEngine.kt`: advertising radius is already represented by `radiusKm`.

Action taken:
- removed the duplicate browser-only distance/GPS ranking code introduced in RC166;
- preserved the dynamic home feature-flag behavior from RC165;
- no second GPS engine or second radius model is to be introduced.

Integration rule for the next implementation:
The website/PWA should consume/adapt the existing location contract and existing range semantics rather than create a parallel location architecture. Where the current web layer lacks a shared adapter, that adapter should be introduced as an integration layer only.

Verification status:
Source contract reviewed. Web integration of the canonical GPS/range contract remains OPEN until the existing app/web integration surface is identified and tested.
