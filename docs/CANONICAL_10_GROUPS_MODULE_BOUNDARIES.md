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
| 2 | الأغذية والضيافة | restaurants, cafes, bakeries, sweets, food retail |
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
