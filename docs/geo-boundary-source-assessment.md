# Egypt administrative boundary source assessment

**Assessment date:** 2026-11-09  
**Scope:** Public general activity directory only. The standalone medical directory remains excluded.  
**Decision:** Do not replace nearest-representative-point matching with polygon claims until a redistributable, versioned dataset and its lineage are verified.

## Existing production-safe baseline

The current V6 discovery uses the pinned Open Admin Data Egypt 2026.09 administrative hierarchy (27 governorates, 365 districts/sections, with lower-level locality records loaded lazily). Its published source metadata identifies OCHA COD-AB / HDX and CC BY 4.0. Its coordinates are representative points, not polygons. The UI must continue to disclose that matches are approximate.

## Candidate A — geoBoundaries Egypt ADM2

- Publisher: geoBoundaries / William & Mary geoLab.
- Egypt ADM2 listing: 365 features; external dataset index describes 2020 vintage and identifies OCHA ROMENA/HDX and CAPMAS as sources.
- The dataset index reports CC BY 3.0; geoBoundaries' general open-country dataset page describes CC BY 4.0. The exact downloaded file's metadata/license must control; do not assume the general page overrides per-file metadata.
- This is a plausible ADM2 candidate, not yet an approved production dependency.
- ADM3 availability for Egypt was not established in this review.

References:
- https://www.geoboundaries.org/data/geoBoundaries-2_0_0/EGY/ADM2/
- https://orionterrametrics.com/data/egypt/boundaries/egypt-administrative-boundaries-adm2-s6os
- https://www.geoboundaries.org/countryDownloads.html

## Candidate B — ArcGIS FeatureServer

A public ArcGIS REST service titled `Administrative_Boundaries` exposes polygon layers:
- `egy_Admin_BND_1` (ADM1)
- `egy_Admin_BND_2` (ADM2)
- `egy_Admin_BND_3` (ADM3)

The ADM3 layer exposes Arabic/English village fields and district/governorate codes. Metadata reports last data edits in November/December 2021. The service and layer metadata viewed on 2026-11-09 do not state a clear license or copyright holder. Therefore this service is a discovery lead only; do not scrape, bundle, cache, or redistribute its geometry in production until written reuse rights and provenance are established.

References:
- https://services3.arcgis.com/t6lYS2Pmd8iVx1fy/ArcGIS/rest/services/Administrative_Boundaries/FeatureServer
- https://services3.arcgis.com/t6lYS2Pmd8iVx1fy/ArcGIS/rest/services/Administrative_Boundaries/FeatureServer/1
- https://services3.arcgis.com/t6lYS2Pmd8iVx1fy/ArcGIS/rest/services/Administrative_Boundaries/FeatureServer/2

## Acceptance gates before implementation

1. Obtain exact dataset files and their embedded metadata; record immutable version/hash, publisher, attribution, license, reference year, and redistribution rights.
2. Verify administrative hierarchy and codes against the pinned Open Admin Data release: 27 ADM1 governorates and 365 ADM2 districts/sections; identify ADM3 coverage and gaps rather than assuming it is complete.
3. Validate CRS and transform to WGS84; check invalid/self-intersecting rings, holes, multipolygons, overlaps, gaps, and boundary edge cases.
4. Map dataset P-codes/IDs to the existing administrative IDs with an explicit audited crosswalk; do not join by fuzzy Arabic names alone.
5. Add point-in-polygon with deterministic boundary handling and nearest-point fallback only when geometry is absent or invalid. Keep the UI's approximate disclosure until an actual polygon containment result is established.
6. Test points well inside/outside polygons, shared borders, islands, holes, overlapping features, and out-of-Egypt coordinates. Ensure precise GPS remains memory-only and is never sent to a third-party boundary service.
7. Bundle only a size-appropriate simplified dataset with source attribution; do not make runtime geospatial calls that expose visitor coordinates.

## Current status

- Nearest representative-point suggestion: existing behavior; approximate only.
- Official/legal boundary accuracy: **NOT VERIFIED**.
- ADM2 candidate: **RESEARCHED, NOT APPROVED**.
- ADM3 candidate: **RESEARCHED, LICENSE UNVERIFIED**.
- Production polygon implementation: **NOT STARTED** pending the gates above.
- No database, authentication, RLS, payment, or production data changes are authorized by this assessment.
