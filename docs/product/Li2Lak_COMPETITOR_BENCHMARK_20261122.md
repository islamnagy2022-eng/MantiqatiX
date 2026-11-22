# Li2Lak Competitor Benchmark — MantiqaTix Feature Gap Review

**Date:** 2026-11-22  
**Baseline:** `main` at `9fb568dd16e48078773c97015722181a1e69a209`  
**Working branch:** `docs/li2lak-benchmark-20261122`  
**Scope:** Compare publicly observable Li2Lak directory patterns with verified MantiqaTix source capabilities. This is a product benchmark, not a request to copy third-party code, branding, content, or business records.

## Executive decision

MantiqaTix already has a stronger underlying product foundation than a simple directory: canonical Activity → Specialty navigation, verified-first business discovery, separate unclaimed public listings, server-backed pagination, owner storefronts, controlled contact disclosure, and role/tenant-aware administration. The benchmark therefore does **not** justify rebuilding the directory or replacing its architecture.

The most valuable gaps to investigate next are:
1. A durable, transparent review-and-rating capability with verified interaction provenance and moderation.
2. A single public offers/promotions discovery surface backed only by approved, currently active records.
3. Rich business media (especially video) with storage, consent, moderation, and performance controls.

Source inspection now confirms Marketplace Home is implemented in `apps/catalog-frontend/src/components/MarketplaceHome.tsx`: it loads verified active businesses, shows active approved ad placements via `get_mnty_targeted_advertisements`, and derives product/service discounts from available public catalog records. Therefore offers and ad discovery are **not a missing feature**; any work here should be limited to validation and polish. Repository code search did not locate a durable customer-review/rating table or workflow, but search-index absence is not proof of absence. Storage uploads exist for AI-generated catalog imagery and Facebook page media; no production video/reels pipeline was established by the inspected sources.

## Feature comparison

| Capability observed on Li2Lak | MantiqaTix evidence on current main | Status | Decision |
|---|---|---|---|
| Country/city/service directory and category navigation | Unified Egypt directory; canonical Activity → Specialty routes; geography filters and server-backed discovery. See `docs/AISTUDIO_V4_WEBSITE_PARITY_20261102.md`, `ActivityModuleView.tsx`, and `DirectoryView.tsx`. | Existing / stronger taxonomy | Keep. Do not add a parallel groups taxonomy. |
| Business profiles with logo/cover, contact and catalog | Dedicated storefront with operational/verified visibility guards, branding, contact/social links, QR/share, catalog filters and cart. See parity map. | Existing | Improve presentation only where needed; retain current access rules. |
| Direct phone / WhatsApp contact | Current directory/profile contracts expose permitted contact routes; directory contact consent and field sanitization are part of the current source release work. | Existing but release-sensitive | Keep consent-scoped. Never restore unrestricted public phone/address output. |
| Location-aware discovery | Manual geographic scope and opt-in GPS/distance behavior are present in current source; V4 parity map records 20-item progressive loading. | Existing | Keep all-Egypt as default; GPS remains explicit opt-in. |
| Search by specialty and geography | Activity module and medical directory support specialty/geographic filters; server pagination exists for directory listings. | Existing | No duplicate search subsystem. |
| Verified business status | Verified-first ranking and separation of verified businesses from unclaimed public-directory listings. | Existing / differentiator | Preserve strict provenance; never invent verification badges. |
| Ratings and customer reviews | Targeted repository code searches found no obvious review/rating table, RPC or UI workflow; no exhaustive schema inventory has yet been completed. | Unverified / likely gap | Perform full migration/schema/function inventory before designing. If absent, implement server-authoritative reviews with verified interaction provenance, moderation, rate limits and anti-self-review. |
| Ads, offers and promotions | `MarketplaceHome.tsx` queries `get_mnty_targeted_advertisements` for `HOME_HERO` and `HOME_SPONSORED`; shows approved active ad creatives; product/service offers derive from available public catalog rows where compare price exceeds current price. `RC206_GEOGRAPHIC_AD_TARGETING.md` documents ACTIVE + APPROVED + date-valid delivery. | Existing | Do not rebuild. Test empty/error states, public pricing disclosure and campaign targeting behavior; geographic ad request currently passes country EG with governorate/center/coordinates null. |
| Photos and video/reels | AI image proxy uploads generated catalog assets to Storage; Facebook Page import mirrors page media. Reviewed source does not establish a public video/reels pipeline. | Image support exists; video unverified | Do not add video UI until bucket policies, ownership, consent, moderation, upload limits, transcoding, retention and bandwidth cost are verified. |
| Professional business accounts and owner management | Merchant dashboard, profile/location, products, CSV import, branding, QR and employee management. | Existing | Preserve; do not replace with a competing account model. |
| App install / QR entry | Install controls and permanent storefront QR are present. | Existing | Retain and improve only if usability testing shows a problem. |

## Prioritized implementation queue

### P0 — Verify before building
- [x] Inspect Marketplace Home and its current data path: verified active businesses; approved ad placements from the public RPC; actual catalog discounts from public catalog rows.
- [ ] Test Marketplace edge cases: RPC failure, empty inventory, invalid creative/target URLs, missing compare price, expired campaign and geo-targeting specificity.
- Inspect review/rating tables, RPCs and UI references across the repository. If absent, design a server-authoritative review model; do not ship a visual-only star widget.
- Inspect Storage/media policies and existing Facebook/media mirroring before proposing video uploads.

### P1 — Product improvements, subject to contract evidence
- **Trusted reviews:** only authenticated eligible customers; one review per qualifying interaction/order where the product contract supports it; immutable author provenance; edit window; report/moderation workflow; rate limits; no self-review; no fabricated aggregate scores.
- **Offers hub:** already exists in Marketplace Home. Improve only after tests confirm active/effective price selection, explicit public price permission, and geographic filters.
- **Business media gallery:** owner-authorized uploads, safe MIME/size validation, signed or public paths according to policy, moderation state, lazy loading and responsive image/video delivery.

### P2 — Later enhancements
- Short-form video discovery only after media pipeline and moderation are production-ready.
- Saved businesses / followed providers only after consent, retention and notification preferences are specified.
- Comparison and recommendation features only when based on transparent, explainable, current data.

## Non-negotiable constraints

- Do not copy Li2Lak source, visual identity, text, images, business listings or user-generated content.
- Do not scrape/import third-party business data without a lawful source and verification workflow.
- Preserve genuine existing business records and unclaimed/claimed separation.
- Preserve the main directory as the primary entry point; Marketplace remains an additional surface, not a replacement homepage.
- Preserve the Activity → Specialty taxonomy, 20-item progressive loading, server-side authorization and tenant boundaries.
- No browser-side database writes, client-trusted verification, or exposure of contact fields without explicit scope consent.
- No Production DB, Auth/RLS/GRANT, Storage, Edge, payment or customer-data mutation as part of this benchmark.

## Evidence and limits

This review is grounded in current-main source and documentation:
- `docs/AISTUDIO_V4_WEBSITE_PARITY_20261102.md`
- `apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx`
- `apps/catalog-frontend/src/components/DirectoryView.tsx`
- `apps/catalog-frontend/src/components/DirectoryListingsView.tsx`
- `docs/MASTER_PRODUCTION_TODO.md` (Pass 1691–1700 release state)

Li2Lak is used as a public product-pattern reference only. Feature availability can change; this document does not claim an exhaustive technical audit of Li2Lak internals.

**Release state:** This benchmark is documentation/source planning only. MantiqaTix remains **PRODUCTION BLOCKED / NOT CERTIFIED** until the independent backup/restore, coordinated migration/Edge, privacy and live authorization gates are satisfied.


## Pass 1701–1710 source inspection addendum

- `MarketplaceHome.tsx` is present on main. It filters public-enabled/official-showcase businesses to ACTIVE, not-frozen, verified businesses for homepage cards.
- Public ads are loaded from `get_mnty_targeted_advertisements` for `HOME_HERO` and `HOME_SPONSORED`; creative and target URLs are restricted to HTTP(S). The RPC contract is documented as ACTIVE + APPROVED + date-valid and returns sanitized ad data.
- Product and service offers are sourced from available products associated with verified businesses and require compare price greater than current price. The public catalog contract requires explicit `catalog_public.show_price === true` before numeric prices are disclosed.
- The homepage ad query is country-wide (`EG`) because governorate, center and coordinates are passed as null. More granular ad placement is a possible improvement, but it must use explicit visitor location consent and existing targeting contracts.
- Storage image uploads are present in the AI image proxy and Facebook Page import. No public video/reels pipeline was confirmed.
- Repository code search did not surface a customer reviews/rating implementation. This is a likely gap only; complete migration/schema/RPC inventory is required before claiming absence.
- No application code or Production state was changed during this inspection.
