# R7 Legacy Group Compatibility — 2026-11-19

**Source archive:** `bizcatalog-manager (11).zip`  
**SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**Scope:** frontend read-boundary compatibility only.

## Finding

The R7 archive defines 15 `FunctionalGroupId` values. The current catalog exposes a canonical 10-group taxonomy and already has a legacy group resolver, but seven exact R7 IDs were not present in its compatibility map. Those IDs could fall through to category-name guessing rather than a stable source-ID mapping.

## Explicit mapping added

| R7 source ID | Canonical catalog group |
|---|---|
| dining | food_grocery |
| retail | fashion_beauty |
| services | professional_services |
| healthcare | medical_health |
| crafts_maintenance | home_maintenance |
| education_training | education_training |
| real_estate | real_estate |
| tourism_hotels | food_grocery |
| transport_logistics | auto_transport |
| agriculture_livestock | agriculture_animals |
| technology_software | technology_communications |
| sports_fitness | education_training |
| events_entertainment | food_grocery |
| legal_financial | professional_services |
| industrial_manufacturing | agriculture_animals |

The map preserves source IDs while keeping the public navigation model at ten canonical groups. The mapping follows the existing canonical group descriptions: tourism/events under hospitality, transport under mobility/logistics, and manufacturing/workshops under agriculture/production.

## Tests

Extended `scripts/validate-canonical-activity-taxonomy.mjs` to assert all 15 exact R7 IDs and their expected canonical targets. This validator is already included in the Primary Catalog Frontend Validation and Pages validation workflows.

## Safety

- No database rows, schema, migrations, Auth, RLS, grants, Edge Functions, payments or financial data were changed.
- No R7 component, server route, local JSON store or client-side authorization logic was imported.
- No visible UI changes; only legacy taxonomy resolution at the existing read boundary is extended.
- Existing unknown IDs continue through the existing safe resolver behavior; no source rows are rewritten.

**Status:** source change pending exact-head CI and review.
