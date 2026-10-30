# MantiqatiX — Taxonomy Reorganization Audit (2026-10-30)

## Objective
Adopt a customer-readable hierarchy: **Main domain → Activity → Specialty/service**. Preserve existing functional-group IDs and all business records to avoid breaking existing links and integrations.

## Implemented source changes
- Renamed the directory folder language from administrative labels (groups/classifications) to customer language (domains/activities).
- Added canonical activity categories `sanitary_ware` under `construction_decor`, `medical_centers` under `medical_health`, `animal_feed` under `agriculture_animals`, and `government_services` under `public_community`.
- Production business mapping now reads `settings.activity_category_code` and resolves the canonical category ID `cat_<group>_<code>` when the name-based legacy mapping is unavailable.
- The public directory and storefront Edge Functions return the explicit category code (and the existing group/type/specialty fields) as a narrow public contract; they do not expose the full business settings JSON.
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

## Public directory listing redistribution
- Read-only inventory found **358 PUBLISHED / UNCLAIMED** public directory listings. After canonical seed additions and corrections, the full set has **0 unmapped category IDs and 0 unknown functional group IDs**.
- Eight rows with stale/incorrect taxonomy IDs were reclassified and audited:
  - `محمد شديد للألومنيوم` → `construction_decor / aluminum_glass`.
  - `احذية ابو شادي` and `محلات قنديل للأحذية` → `fashion_beauty / shoes_bags`.
  - `لمسات للستائر والشيش` → `home_maintenance / home_textiles`.
  - `Royal Center`, `مركز الطوارئ الطبي — جنزور`, and `مستوصف ومسجد الإسراء` → `medical_health / medical_centers` (kept distinct from hospitals).
  - `الماجيك للفضة` → `fashion_beauty / jewelry_stores`.
- `نورتوك للأعلاف Nortok Feed` was already on the correct group/category code; the missing canonical seed `animal_feed` was added. `الإدارة الزراعية ببركة السبع` was already on the correct group/category code; the missing canonical seed `government_services` was added.
- Each of the eight changed rows received an `audit_logs` record with action `PLATFORM_DIRECTORY_LISTING_TAXONOMY_RECLASSIFIED` and result `SUCCESS`. Listing publication and claim states, names, phone numbers, source URLs, addresses and metadata were not changed.

## Not yet completed
- Build/typecheck, browser E2E and deployed-origin verification are still required for the source changes.
- No verification, subscription, owner, publication or contact fields were changed.
- Overall platform production gate remains governed by the existing release TODO and is not certified by this scoped work.
