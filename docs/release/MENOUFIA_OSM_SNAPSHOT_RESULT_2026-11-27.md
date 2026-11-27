# Menoufia OSM source snapshot — review result

**Snapshot:** 2026-11-27 03:49:21 UTC  
**Source:** OpenStreetMap via `https://overpass-api.de/api/interpreter`  
**License:** ODbL 1.0  
**Attribution:** © OpenStreetMap contributors  
**Boundary:** relation 3824207 — محافظة المنوفية (admin level 4)

## Reviewed record counts

| Result | Records | Meaning |
|---|---:|---|
| Exact category matches | 185 | Mapped to a current MantiqatiX activity category using known OSM tags |
| Taxonomy review | 42 | Uncertain tags; no accepted category assignment |
| Ignored | 37 | Unnamed, non-commercial, malformed/invalid-coordinate or duplicate elements |
| Unique source objects | 227 | Total unique OSM object references retained for review |

The first generator run placed 206 tag-matched rows in its candidate file, but 21 of those rows were unfamiliar shop types with a provisional general-retail suggestion. The reviewed delivery moves those 21 rows to the taxonomy-review file, so a suggested category is never silently accepted as a final taxonomy assignment.

## Accepted candidate distribution

| Functional group | Accepted candidates |
|---|---:|
| Education and training | 97 |
| Food and grocery | 35 |
| Medical and health | 29 |
| Auto and transport | 7 |
| Agriculture and animals | 3 |
| Fashion and beauty | 3 |
| Home maintenance | 2 |
| Professional services | 9 |
| **Total** | **185** |

The distribution is based on current OSM tag values and is not a census of all businesses in the governorate.

## Integrity and privacy

- 227/227 retained object IDs are unique.
- 227/227 rows have valid coordinates.
- Coordinate extent: 30.220506–30.6846318 latitude, 30.3747265–31.1869698 longitude.
- No phone, email, website, social URL, opening-hours or detailed street-address fields are exported.
- All rows remain `UNVERIFIED`, `DRAFT`, `UNCLAIMED`, `public_enabled=false`, and `publishable=false`.
- No Production database, Supabase, Edge Function, public directory or business registry was written.

## Source artifact and redistribution

The initial extraction artifact is GitHub Actions run [45936233952](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45936233952), artifact ID `15170886614`. The reviewed delivery ZIP contains separate candidate and taxonomy-review CSV/JSON files, a manifest, and attribution README.

The derived OSM candidate database is distributed separately under **ODbL 1.0** with attribution. It must not be silently merged into proprietary MantiqatiX business data. Any later integration or public release requires a specific ODbL architecture/legal review, owner identity and human verification, and contact consent if contact information is later obtained.

OSM coverage depends on community mapping. Missing businesses, outdated tags, duplicate real-world entities, incorrectly tagged objects, or incomplete map coverage remain possible. These records must not be described as verified businesses.
