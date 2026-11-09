# Verified Egypt administrative-boundary metadata — 2026-11-09

**Scope:** public general activity directory only. The standalone medical directory remains excluded.
**Decision:** the current GPS-to-area result must remain visibly approximate. An ADM2 polygon candidate is now identified with a commercial-compatible attribution licence, but its actual geometry has not yet been downloaded and validated; no polygon matching is approved for production yet.

## 1. Current live baseline

The V6 directory uses the pinned Open Admin Data Egypt 2026.09 hierarchy: 27 governorates, 365 districts/sections and 5,716 lower-level shiyakhas. The release supplies coordinates and hierarchy metadata under CC BY 4.0. The coordinates are representative points, not administrative polygons; they cannot prove point-in-polygon containment.

Source: https://openadmindata.org/eg/
Pinned source commit used by the current implementation: `76b47b22872288c0d8b0c757975980e6986945e8`.

## 2. geoBoundaries EGY ADM2 — exact metadata retrieved

Official geoBoundaries API response:
https://www.geoboundaries.org/api/current/gbOpen/EGY/ADM2/

Returned metadata on 2026-11-09:

| Field | Returned value |
|---|---|
| boundaryID | `EGY-ADM2-37247803` |
| boundaryYearRepresented | `2020` |
| boundaryType / canonical | `ADM2` / `marakiz and aqsam` |
| boundarySource | `OCHA ROMENA/HDX, Central Agency for Public Mobilization and Statistics (CAPMAS)` |
| boundaryLicense | `Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)` |
| licenseSource | `data.humdata.org/dataset/egypt-administrative-boundaries-levels-0-3` |
| sourceDataUpdateDate | `2023-01-19` |
| buildDate | `2023-12-12` |
| admUnitCount | `365` |
| meanVertices | `557` |
| min / max vertices | `5 / 19,304` |

The static release is pinned to geoBoundaries repository commit `9469f09592ced973a3448cf66b6100b741b64c0d`. The simplified GeoJSON LFS pointer identifies the exact file as:

- File: `geoBoundaries-EGY-ADM2_simplified.geojson`
- Git LFS object SHA-256: `abd2e419ce95e1cdd46bb18025a4eccfa6f877956494a56da3ebed4bc6a153d9`
- Size: `1,379,010` bytes
- Pinned path: https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/EGY/ADM2/geoBoundaries-EGY-ADM2_simplified.geojson

**License interpretation:** CC BY 3.0 IGO permits sharing and adaptations for commercial or non-commercial purposes when attribution is provided, the licence is linked, and changes are identified. Do not imply CAPMAS, OCHA or geoBoundaries endorses MantiqatiX. Required credit must identify the OCHA ROMENA/HDX and CAPMAS source, geoBoundaries/William & Mary distribution, source year, licence and any simplification or transformations.

Official licence: https://creativecommons.org/licenses/by/3.0/igo/deed.en

**Important age caveat:** this is a 2020 administrative vintage with source data update 2023-01-19 and a 2023 build. It is not proof of the legal administrative layout as of 2026. The 365-unit count matches the current hierarchy count but does not prove that every district identity/code/geometry still matches the 2026.09 Open Admin Data release.

**Retrieval limitation:** the Git LFS pointer and immutable SHA/size were read, but the GeoJSON geometry bytes could not be materialized in this review environment. Therefore feature properties, coordinate reference system, polygon validity, holes/multipolygons, actual feature count and P-code crosswalk have **not** been inspected. The dataset is a viable candidate, not a production-approved asset.

## 3. ADM3 / shiyakha boundary evidence

The OCHA COD-AB Egypt dataset is described as covering ADM0–ADM3 and containing:

- ADM1: 27 governorates
- ADM2: 365 districts/sections
- ADM3: 5,716 shiyakha/sub-district features, with **partial coverage**

Dataset/source reference: https://data.humdata.org/dataset/cod-ab-egy
The available catalogue metadata identifies CAPMAS as source, OCHA ROMENA/FIS as contributor/processor, and CC BY-IGO 3.0 as the licence family. This is not yet an inspected, immutable polygon-file manifest.

OCHA's COD-AB documentation describes administrative units as boundary polygons and identifies P-codes as the stable administrative join fields. It also recommends retrieving resources (shapefiles/geodatabases/GeoJSON where available) from the dataset's HDX resource list rather than assuming every mirror exposes equivalent files.

References:
- https://humanitarian.atlassian.net/wiki/spaces/imtoolbox/pages/2557378679
- https://knowledge.base.unocha.org/wiki/spaces/imtoolbox/pages/2493153411
- https://creativecommons.org/licenses/by/3.0/igo/deed.en

A third-party catalogue reports that the Egypt ADM3 source was valid from 2017-04-21, last source-edited 2017-08-14, reviewed for accuracy/completeness on 2024-12-19, and is only partially covered. It also warns that English/Arabic names are not one-to-one, there are duplicate English names in 19 ADM2 units, and ADM2 “Zemam Out” units do not appear in ADM3. Treat these as material reconciliation risks, not cosmetic naming issues:
https://orionterrametrics.com/data/egypt/boundaries/egypt-subnational-administrative-boundaries-e0rk

geoBoundaries' current EGY gbOpen listing exposes ADM0, ADM1 and ADM2 directories; an EGY ADM3 geoBoundaries file was not established in this review. The geoBoundaries ADM2 file must not be treated as a complete ADM3 source.

## 4. Acceptance gates before code or production use

1. Obtain the actual OCHA COD-AB/HDX resource manifest and geometry files for ADM1/ADM2/ADM3; record exact resource IDs, hashes, file versions, metadata and licences. Do not rely on a third-party catalogue alone.
2. Materialize and inspect the pinned geoBoundaries ADM2 GeoJSON. Verify 365 valid polygons, CRS/WGS84 coordinates, holes, multipolygons, invalid/self-intersecting rings, island geometry, overlaps, gaps and file size.
3. Inspect properties and map stable P-codes/IDs to the pinned Open Admin Data IDs. Do not join by Arabic/English display names alone.
4. Verify ADM3 feature/geometry coverage against the 5,716 hierarchy entries. Separate missing geometry from missing names and incomplete source coverage. Use P-codes/parent codes; names alone are unsafe.
5. If ADM2 passes, implement local point-in-polygon only for district/section assignment. Keep shiyakha suggestion approximate unless complete, licensed ADM3 polygons pass the same gates.
6. Define deterministic shared-boundary handling and test points inside/outside districts, Nile corridor, desert, islands, holes, overlaps, shared borders, out-of-Egypt coordinates and missing polygons. Fall back to representative points only with explicit “approximate” UI wording.
7. Keep precise GPS in memory only; never send visitor coordinates to HDX, ArcGIS or another third-party geocoding service. Bundle a simplified, attribution-bearing static dataset rather than making runtime location API calls.
8. Run TypeScript/build, deterministic geospatial unit tests, desktop/mobile browser tests and deployed-origin checks. Only then consider a separately reviewed production promotion.

## 5. Current state and non-actions

- Current nearest representative-point matching: **still approximate**.
- geoBoundaries ADM2 metadata/licence/hash/size: **verified**.
- geoBoundaries ADM2 geometry contents and P-code crosswalk: **NOT VERIFIED**.
- OCHA ADM3 source availability/partial coverage: **identified, exact geometry resource NOT VERIFIED**.
- Point-in-polygon implementation: **NOT STARTED**.
- No geometry is bundled in the site; no production database, Supabase schema, Auth/RLS, Edge Function, GPS persistence, payment or finance changes are made by this assessment.
- No medical directory work is authorized. Keep the standalone medical directory excluded from V6 and legacy catalog.
