# Menoufia OpenStreetMap ODbL staging pipeline

## Purpose

Prepare a separate, source-attributed candidate dataset from OpenStreetMap for the Menoufia governorate. This is an optional source-backed discovery dataset, not a list of verified businesses and not a replacement for the canonical MantiqatiX business registry.

## Source and boundary

- Source data: OpenStreetMap, queried once through the public Overpass API.
- Geofabrik's Egypt extract is an alternate downloadable raw-data source; its public Egypt extract is refreshed frequently and includes PBF, GeoPackage and Shapefile formats.
- Boundary: OpenStreetMap administrative relation 3824207 for Monufia Governorate; the pipeline checks the relation ID, boundary=administrative and a Monufia name tag before processing candidate features.
- Source license: Open Database License 1.0 (ODbL).
- Attribution: © OpenStreetMap contributors.
- The extraction is limited to named objects tagged as shops, selected amenities, offices, crafts, healthcare providers, hotels/guest houses and sports facilities.
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

The workflow validates the mapping and privacy contract whenever the PR is opened, synchronized or reopened. The data-fetch job runs only on the initial open or an explicit reopen from a same-repository PR; ordinary synchronize events do not repeat the external extraction. It makes one bounded Overpass request and uploads an artifact with 14-day retention. If Overpass is unavailable, the workflow uploads an explicit UNAVAILABLE manifest with empty arrays; it does not invent records or scrape an unlicensed directory.

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
