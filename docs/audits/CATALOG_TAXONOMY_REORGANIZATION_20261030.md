# MantiqatiX — Taxonomy Reorganization Audit (2026-10-30)

## Objective
Adopt a customer-readable hierarchy: **Main domain → Activity → Specialty/service**. Preserve existing functional-group IDs and all business records to avoid breaking existing links and integrations.

## Implemented source changes
- Renamed the directory folder language from administrative labels (groups/classifications) to customer language (domains/activities).
- Added canonical activity category `sanitary_ware` under `construction_decor` for sanitary ware, water filters and purification systems.
- Production business mapping now reads `settings.activity_category_code` and resolves the canonical category ID `cat_<group>_<code>` when the name-based legacy mapping is unavailable.
- Directory category matching now prefers the explicit canonical `categoryId`, with the legacy name matcher retained as fallback.

## Production data redistribution
The following 10 current `public.businesses` records were reclassified using exact business IDs. Each update changed only `settings.activity_group_code`, `settings.activity_category_code`, `settings.activity_classification_type` and `updated_at`; existing `settings.activity_specialty` was preserved. Every changed row received an atomic `audit_logs` record with action `PLATFORM_BUSINESS_TAXONOMY_RECLASSIFIED` and result `SUCCESS`.

| Business | Main domain code | Activity code |
|---|---|---|
| AMMAN COFFEE | food_grocery | cafes |
| MantiqatiX | marketing_media | marketing_agencies |
| Sameh Market سامح ماركت | food_grocery | supermarkets |
| Tolga Egy Plastik | industry_workshops | plastic_factories |
| Vision للانشطة المعمارية والديكورات | construction_decor | interior_design |
| الصالح مول | fashion_beauty | beauty_products |
| برجر فاخر Burger Fakher | food_grocery | restaurants |
| شعير للادوات الصحية | construction_decor | sanitary_ware |
| كشري ومشويات الزعيم - El ZAEIM | food_grocery | restaurants |
| متجر قدم السعد | home_maintenance | homewares |

## Verification
A read-back query confirmed all 10 records have the intended domain and activity codes, `activity_classification_type=activity`, and their previous `activity_specialty` values remain unchanged. Audit records were created for all 10 changes.

## Not yet completed
- Public unclaimed directory listings are a separate data source and were not changed. They need an audited mapping by their existing taxonomy IDs and source metadata.
- Build/typecheck, browser E2E and deployed-origin verification are still required for the source changes.
- No verification, subscription, owner, publication or contact fields were changed.
- Overall platform production gate remains governed by the existing release TODO and is not certified by this scoped work.
