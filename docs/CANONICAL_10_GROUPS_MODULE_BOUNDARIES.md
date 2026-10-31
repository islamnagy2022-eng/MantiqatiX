# MantiqatiX — Canonical Functional Groups & Future Module Boundaries

## Classification contract

- Exactly 10 top-level functional groups are presented in the directory.
- Each group exposes no more than 5 primary activity categories.
- Specialties are child attributes of an activity category; they are not peer categories or additional groups.
- A person/professional and a facility/business are represented by the same relevant activity family with a profile subtype/specialty where appropriate. For example, "doctor" is not a separate top-level category beside "clinics"; the medical practice category owns the specialty.
- Historical group IDs and backend sector codes resolve through an explicit compatibility map.
- Historical business/category rows are not deleted by frontend taxonomy normalization.
- Custom categories are retained as custom records but constrained to the remaining visible slots in their mapped group.

## Canonical groups

| # | Group | Scope |
|---|---|---|
| 1 | الطب والصحة | medical practices, pharmacies, diagnostics, hospitals, rehabilitation |
| 2 | الأغذية والضيافة | restaurants, cafes, bakeries and sweets, food retail, hospitality/events/travel |
| 3 | التجارة والتجزئة والعناية الشخصية | general retail, clothing, footwear, beauty products, salons |
| 4 | المنزل والبناء والصيانة | furniture, contracting, finishing, building supplies, home services |
| 5 | السيارات والنقل واللوجستيات | vehicle sales, maintenance, parts, shipping, delivery |
| 6 | العقارات وإدارة الأملاك | residential, rental, commercial, land, development |
| 7 | التعليم والتدريب والرياضة | schools, nurseries, tutoring, training, sports |
| 8 | التكنولوجيا والتسويق الرقمي | software, web, apps, IT/network, digital marketing |
| 9 | الخدمات المهنية والمالية | legal, accounting, consulting, financial/insurance, office services |
| 10 | الزراعة والإنتاج والورش | agriculture, veterinary, animal production, factories, workshops |

## Future module contract (not activated by taxonomy)

Each group may later become an independently deployable/enableable module. A module must define:

1. Stable module key and version.
2. Own route and navigation registration.
3. Role/permission matrix and tenant/business/branch scope.
4. Owned data entities and authoritative write boundary (Edge Function/RPC).
5. Workflows and state transitions.
6. Domain events and notification contracts.
7. Module settings and feature flags.
8. Reporting/read models and audit events.
9. Migration ownership, rollback plan and backward compatibility.
10. Module-specific tests, monitoring and release gate.

Taxonomy classification alone must never grant a role, enable a workflow, create a subscription, or expose an operational dashboard.

## Safe rollout

- Frontend taxonomy change only; no production schema/data mutation.
- Preserve legacy IDs and map old sector codes into the canonical ten.
- Before merge, run build/typecheck and tests for mapping, per-group cap, no duplicate profession/activity concepts, existing activity lookup, admin editing, search and detail pages.
- Any later persistent data migration must be forward-only, additive where possible, rehearsed against a restorable isolated database, and must not rewrite historical migrations or fabricate migration-ledger rows.
- Do not claim production readiness until deployed-origin and authenticated role-scoped E2E pass.

## Existing-record compatibility audit (2026-10-31)

- Read-only inventory of `public.public_directory_listings` found 454 existing rows across 156 distinct legacy group/category/type/specialty combinations. No rows were updated or deleted.
- Added client read-boundary normalization for public listings, detail pages, and admin bundles: legacy group IDs resolve to the canonical 10, and every currently inventoried legacy category ID maps to one of the new category IDs. A read-only SQL reconciliation returned zero unmapped category IDs.
- Medical legacy IDs for doctors, dentists, dental centers, and clinics converge on the single `medical_practices` activity; the individual listing type and specialty remain intact as profile data.
- Legacy tourism/event entries map to the new hospitality/events activity; bakeries and sweets are consolidated to preserve the five-category ceiling in the food group.
- Read-only inventory of business settings found legacy group/category codes including `construction_decor`, `marketing_media`, `industry_workshops`, `interior_design`, `sanitary_ware`, `homewares`, and `plastic_factories`. The business mapper now resolves these codes to canonical group/category IDs.
- New directory writes on the feature branch accept only the canonical 10 group IDs. Existing database rows and the database's legacy-compatible check constraint are intentionally left unchanged until a separate, rehearsed migration is approved.
- Validation still required on the latest commit: run CI, exercise group/category/specialty filtering for each mapped legacy ID, verify admin edit-save round trips, and inspect unmapped IDs after the next read-only production inventory.


### Read-only record reconciliation

| Canonical group | Existing records mapped |
|---|---:|
| الطب والصحة | 134 |
| الأغذية والضيافة | 69 |
| التجارة والتجزئة والعناية الشخصية | 49 |
| المنزل والبناء والصيانة | 37 |
| السيارات والنقل واللوجستيات | 21 |
| العقارات وإدارة الأملاك | 3 |
| التعليم والتدريب والرياضة | 16 |
| التكنولوجيا والتسويق الرقمي | 45 |
| الخدمات المهنية والمالية | 52 |
| الزراعة والإنتاج والورش | 28 |
| **الإجمالي** | **454** |

The 454 rows are grouped from the 18 former group IDs into the ten canonical groups. The distinct legacy category IDs observed in the inventory are all covered by the compatibility map (zero unmapped IDs). These are calculated display mappings only; the source rows remain unchanged.
