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
| Ratings and customer reviews | MantiGO has a ride-rating table/RPC for completed customer-owned rides; this is a separate domain and is not a general directory-business/product review workflow. A general business-review model was not found in targeted searches; full schema confirmation remains pending. | MantiGO ratings exist; general business reviews unverified/not found in inspected paths | Preserve MantiGO rating boundaries. Confirm whether a separate business-review contract exists before designing; never reuse ride ratings or fabricate aggregate scores. |
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


## Pass 1711–1720 — review/rating schema inventory correction

- The repository-wide Git tree contains 238 Supabase migration files. Filename scan found a rating-related migration: `20261006121810_mantigo_rating_immutability_v1.sql`.
- That migration defines `public.mantigo_rate_ride(text, integer, text)`: it requires an authenticated customer, a completed ride owned by that customer, a rating from 1–5, and the accepted captain; it permits exact-request idempotent replay and rejects a changed second rating. It writes an audit record and grants execution to authenticated only.
- The live-schema policy inventory also identifies `public.mantigo_ride_ratings`, with authenticated-session restrictive policies and MantiGO-specific rating policies. This is a real ratings implementation for the MantiGO ride domain.
- This does **not** establish a general customer review/rating system for directory businesses, storefronts, products or services. Targeted searches for `business_reviews`, `review_rating`, `rating_count` and frontend review/rating component filenames found no matching general-business workflow. Search-index results are not a complete proof of absence, so that domain remains **not found in inspected source / pending schema confirmation**, not a claim that all ratings are absent.
- Corrected product decision: retain MantiGO ride ratings; do not duplicate or repurpose that table. If business reviews are later approved, they need their own business/order/booking provenance and moderation contract, not a UI-only star average.
- Marketplace source inspection remains source-only: no executable app regression test was run in this pass. PR #963 remains documentation-only, open and unmerged; no CI statuses or reviews were returned for its latest head.
- No Production mutation or deployment. **PRODUCTION BLOCKED / NOT CERTIFIED.**


### Pass 1711–1720 follow-up — MantiGO rating lifecycle detail

- The migration sequence contains more than one definition of `public.mantigo_rate_ride`. `20261006121810_mantigo_rating_immutability_v1.sql` rejects changed second submissions, but the later timestamped `20261006171000_mantigo_notification_lifecycle_v1.sql` replaces the function with an `ON CONFLICT (ride_id, customer_id) DO UPDATE` path. Therefore the earlier “immutable” implementation is not the final source definition on current main; the later migration permits rating/comment changes for the same ride/customer.
- `20261006180000_mantigo_customer_tracking_and_finance_indexes_v1.sql` returns the current customer's own ride rating in the customer-rides payload. This is a customer-specific read path, not evidence of public business-review aggregation.
- The MantiGO rating creation table is referenced by migration and fixture contracts, and the live policy matrix confirms its presence and policies. Its complete originating DDL/constraints and all trigger/aggregate behavior still require a focused pass.
- Follow-up priority: verify whether editable ratings are intentional product policy; if immutability is required, reconcile the later migration with the intended contract and add PostgreSQL regression tests before proposing a migration. No production change is authorized or made here.


## Pass 1731–1750 — live Production confirmation and implementation decisions

### Reviews and ratings
- Read-only live Production table inventory confirms no general business/storefront/product/service review or rating table. The only review/rating-named application table is `public.mantigo_ride_ratings`, with `ride_id`, `customer_id`, `captain_id`, integer `rating`, `comment` and `created_at`. Keep this exclusive to completed MantiGO ride/captain reviews; do not repurpose it.
- Candidate interaction sources exist but have different identity/eligibility contracts: `public.orders` includes nullable `customer_id` and `business_id`; `public.medical_appointments` includes `patient_id` and `business_id`; `public.restaurant_orders` has no customer Auth user ID column. A universal “verified customer” review cannot safely treat these as equivalent. A separate design specification now defines the proposed business-level-only contract and disposable acceptance matrix: `docs/product/BUSINESS_REVIEWS_VERIFIED_INTERACTION_SPEC_20261122.md`. Before implementation, the product owner must approve moderation, edit-window, retention and dispute policy.
- Proposed first release should be business-level only, one review per verified completed interaction, no anonymous or self-reviews, server-derived reviewer identity, no client-supplied business/owner authority, moderated publication, abuse reporting, owner reply scoped to active business membership, and aggregate ratings calculated from published eligible reviews only. Product/service-level reviews should wait until canonical order-line identity and provenance are confirmed.

### Media
- Live Storage has only two 5 MiB image buckets: private `mantiqatix-media` (JPEG/PNG/WebP) and public-read `mantiqatix-profile-media` (JPEG/PNG/WebP/SVG). No video MIME type, transcoding path, duration policy or public video pipeline is configured.
- Do not ship video/reels controls. A later media release requires separate upload authorization, private staging, MIME/content validation, byte/duration quotas, moderation, publication policy, signed delivery, retention/deletion, and measured bandwidth/storage costs.

### Marketplace verification
- The primary Marketplace loader now isolates HOME_HERO and HOME_SPONSORED RPC failures; one failed placement no longer suppresses the other. It validates creative/target URLs, rejects credential-bearing URLs and deduplicates ads. Six regression cases are in PR #969; the earlier four-case subset passed exact-head TypeScript/focused tests, while the two additional cases require the new PR's full CI.
- The primary Marketplace request remains Egypt-wide (`EG`) with governorate/center/coordinates null. Do not introduce GPS targeting without explicit location consent; all-Egypt remains the default discovery scope.
- The live public ad RPC remains a deliberate anonymous read for approved, active, date-valid ads with empty search_path and a bounded result limit. Preserve its read-only allowlisted contract.

**Disposition:** review and video features remain design-gated; Marketplace reliability work is source/test-only and awaiting exact-head CI. No Production state was mutated.


## Uploaded R7 archive — source reconciliation

The uploaded 2026-11-10 R7 snapshot is a historical UX/feature reference, not the authoritative runtime. It declares local JSON authoritative and contains multiple release-blocking patterns (browser service-role key reference, deterministic server secret fallbacks, localStorage role state, and fail-open verified/paid defaults). Do not merge it wholesale. See `docs/audits/PASS_1761_1770_AI_STUDIO_R7_ARCHIVE_RECONCILIATION_20261122.md`.
