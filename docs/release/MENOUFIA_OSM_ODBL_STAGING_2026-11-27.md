# Menoufia OpenStreetMap ODbL staging pipeline

## Purpose

Prepare a separate, source-attributed candidate dataset from OpenStreetMap for the Menoufia governorate. This is an optional source-backed discovery dataset, not a list of verified businesses and not a replacement for the canonical MantiqatiX business registry.

## Source and boundary

- Source data: OpenStreetMap, queried once through a documented public Overpass instance. The workflow tries the FOSSGIS primary instance, the Africa regional instance at dresel.systems, then the Private.coffee public instance; the actual successful endpoint is recorded in the manifest.
- Geofabrik's Egypt extract is an alternate downloadable raw-data source; its public Egypt extract is refreshed frequently and includes PBF, GeoPackage and Shapefile formats.
- Boundary: OpenStreetMap administrative relation 3824207 for Monufia Governorate; the pipeline checks the relation ID, boundary=administrative and a Monufia name tag before processing candidate features.
- Source license: Open Database License 1.0 (ODbL).
- Attribution: © OpenStreetMap contributors.
- The extraction is limited to named objects tagged as shops, selected amenities, offices, crafts, healthcare providers, hotels/guest houses and sports facilities. Any class marked for taxonomy review is kept out of the mapped-candidate file; a provisional group/category suggestion is stored separately for human review.
- Generic `office=company` and `office=estate_agent` elements are not guessed into business-consulting or development categories; they are placed in the taxonomy-review queue.

## ODbL separation

The output is a derived OSM candidate database and is therefore distributed as ODbL 1.0 with attribution. It is not merged into proprietary businesses, public directory, catalog or CRM tables. If a later architecture intentionally combines it with other sources, that must first be reviewed against ODbL's collective-database and derivative-database guidance.

Official references:

- Geofabrik Egypt extract: https://download.geofabrik.de/africa/egypt/
- Geofabrik download data license notice: https://www.geofabrik.de/en/data/download.html
- OpenStreetMap copyright and license: https://www.openstreetmap.org/copyright
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- OpenStreetMap Foundation license FAQ: https://osmfoundation.org/wiki/License/Licence_and_Legal_FAQ
- OpenStreetMap Foundation attribution guideline: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines

## Candidate data rules

Every generated record:

- Is explicitly UNVERIFIED, DRAFT and UNCLAIMED.
- Has public_enabled=false, publishable=false and requires owner confirmation.
- Includes an external OSM object reference, a source URL, source attribution, license, source snapshot timestamp, coordinates, governorate and optional canonical taxonomy mapping.
- Excludes phone numbers, email addresses, websites, social profile URLs, opening hours and detailed street-address fields.
- Uses only canonical MantiqatiX category IDs; uncommon shop classes may map to the general-retail category but stay flagged for human specialty review. Unknown commercial tags go to a separate taxonomy-review file instead of being forced into an inaccurate category.

The extractor deduplicates repeated OSM object type/ID pairs. It does not claim that the resulting list is exhaustive: OSM coverage depends on community mapping completeness, and unmapped tags or unnamed objects are not treated as publishable businesses.

## Execution and safety

The workflow validates the mapping and privacy contract whenever the PR is opened, synchronized or reopened. The data-fetch job runs only on the initial open or an explicit reopen from a same-repository PR; ordinary synchronize events do not repeat the external extraction. It makes at most one bounded query per listed Overpass instance (primary plus two public fallbacks), records the responding endpoint in the manifest, and uploads an artifact with 14-day retention. If Overpass is unavailable, the workflow uploads an explicit UNAVAILABLE manifest with empty arrays; it does not invent records or scrape an unlicensed directory.

The workflow does not write to Supabase, Production, public directory, Edge Functions, Storage, Auth, RLS/GRANT, payments, wallets or settlements. Public unclaimed listings remain disabled. The artifact is a review source, not a deployment.

## Future publication gate

Before any OSM-derived candidate becomes visible to public visitors, it must pass:

1. Data validation and duplicate review.
2. Business identity and owner-claim workflow.
3. Human verification of activity and status.
4. Contact disclosure consent checks if contact information is later obtained from the owner.
5. ODbL attribution and accessible share-alike distribution for the derived candidate database.
6. A reviewed separate ODbL data storage/publication design and all required database/Edge/privacy CI gates.

No production publication or import is enabled by this pipeline.


## First source snapshot result — 2026-11-27

- Snapshot time: `2026-11-27T03:49:21Z`.
- Verified boundary relation: `3824207`, displayed name `محافظة المنوفية`, administrative level 4.
- Successful source endpoint recorded in the source manifest: `https://overpass-api.de/api/interpreter`.
- Initial extraction yielded 227 unique OSM object references after duplicate filtering: 206 rows with a tag-based category suggestion, 21 unclassified rows for taxonomy review, and 37 ignored elements (unnamed, non-commercial, malformed/invalid-coordinate or duplicate).
- **Reviewed package distribution:** 185 exact category matches are in `candidates.json`; 42 uncertain rows are in `needs-taxonomy-review.json`. This re-buckets the 21 uncommon shop classes previously carrying `taxonomy_review_required=true` into the review queue rather than treating their provisional `general_retail` category as approved. The 21 additional rows have no reliable canonical category and remain unassigned.
- Accepted candidate counts by functional group: food/grocery 35; fashion/beauty 3; medical/health 29; education/training 97; auto/transport 7; agriculture/animals 3; home/maintenance 2; professional services 9.
- Spatial integrity: 227/227 rows have unique OSM object IDs and valid coordinates; coordinate extent is latitude 30.220506–30.6846318 and longitude 30.3747265–31.1869698.
- Privacy/publication checks: no phone, email, website, social URL, opening-hours or street-address field in any exported row; every row is `UNVERIFIED`, `DRAFT`, `UNCLAIMED`, `public_enabled=false`, and `publishable=false`.
- Source artifact: GitHub Actions run [45936233952](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45936233952), artifact ID `15170886614`, retained until 2026-12-11 03:49 UTC. It contains the initial generated JSON. The reviewed ZIP distributed separately applies the explicit taxonomy-review re-bucketing above, with CSV and JSON files.
- This is an OSM discovery snapshot, not an exhaustive registry, not verification, and not authorization to publish. Public directory and Production database remain unchanged.
