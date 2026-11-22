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

These are proposed gaps, not claims that the current source has no related partial implementation. Each requires contract and source inspection before implementation.

## Feature comparison

| Capability observed on Li2Lak | MantiqaTix evidence on current main | Status | Decision |
|---|---|---|---|
| Country/city/service directory and category navigation | Unified Egypt directory; canonical Activity → Specialty routes; geography filters and server-backed discovery. See `docs/AISTUDIO_V4_WEBSITE_PARITY_20261102.md`, `ActivityModuleView.tsx`, and `DirectoryView.tsx`. | Existing / stronger taxonomy | Keep. Do not add a parallel groups taxonomy. |
| Business profiles with logo/cover, contact and catalog | Dedicated storefront with operational/verified visibility guards, branding, contact/social links, QR/share, catalog filters and cart. See parity map. | Existing | Improve presentation only where needed; retain current access rules. |
| Direct phone / WhatsApp contact | Current directory/profile contracts expose permitted contact routes; directory contact consent and field sanitization are part of the current source release work. | Existing but release-sensitive | Keep consent-scoped. Never restore unrestricted public phone/address output. |
| Location-aware discovery | Manual geographic scope and opt-in GPS/distance behavior are present in current source; V4 parity map records 20-item progressive loading. | Existing | Keep all-Egypt as default; GPS remains explicit opt-in. |
| Search by specialty and geography | Activity module and medical directory support specialty/geographic filters; server pagination exists for directory listings. | Existing | No duplicate search subsystem. |
| Verified business status | Verified-first ranking and separation of verified businesses from unclaimed public-directory listings. | Existing / differentiator | Preserve strict provenance; never invent verification badges. |
| Ratings and customer reviews | The reviewed parity and directory source excerpts do not establish a complete durable, moderated review workflow. | Needs focused verification; likely gap | Next candidate after checking schema, RPCs, moderation and anti-abuse controls. No client-only ratings. |
| Ads, offers and promotions | Admin ads and activity marketing surfaces exist; the parity map describes a Marketplace Home with active approved ads and actual recorded discounts as an additional opt-in surface. | Partial / integration gap | Verify the current Marketplace implementation and approval/expiry/targeting contracts before adding anything. |
| Photos and video/reels | Business profile imagery and media/import flows exist; reviewed source does not prove a production-ready public video/reels pipeline. | Partial / likely gap | Defer until storage ownership, consent, moderation, upload limits, transcoding and bandwidth costs are defined. |
| Professional business accounts and owner management | Merchant dashboard, profile/location, products, CSV import, branding, QR and employee management. | Existing | Preserve; do not replace with a competing account model. |
| App install / QR entry | Install controls and permanent storefront QR are present. | Existing | Retain and improve only if usability testing shows a problem. |

## Prioritized implementation queue

### P0 — Verify before building
- Inspect the current Marketplace Home route and its actual server data contract. Confirm whether approved ads and effective discounts are already rendered, including expiry, geographic scope and visibility rules.
- Inspect review/rating tables, RPCs and UI references across the repository. If absent, design a server-authoritative review model; do not ship a visual-only star widget.
- Inspect Storage/media policies and existing Facebook/media mirroring before proposing video uploads.

### P1 — Product improvements, subject to contract evidence
- **Trusted reviews:** only authenticated eligible customers; one review per qualifying interaction/order where the product contract supports it; immutable author provenance; edit window; report/moderation workflow; rate limits; no self-review; no fabricated aggregate scores.
- **Offers hub:** filter active, approved and unexpired offers by Activity, Specialty and geography; display real effective prices/discounts only when the public pricing contract permits it; link to the canonical business/storefront.
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
