# R7 Google Search, Analytics & SEO Release Plan

Date: 2026-11-11  
Scope: `bizcatalog-manager (7).zip` only. `source_RC40.zip` and RC40 content are explicitly excluded.

## Decision and current state

R7 has basic title, description, Open Graph and Twitter metadata. It has no GA4/GTM Measurement ID, Search Console verification, sitemap, robots file or Schema.org structured data. The R7 preview is not production-certified and can contain seed/demo content. A preview-only `noindex,nofollow,noarchive` guard and static test were added; no Google account was connected and no IDs/tokens were fabricated.

The existing 1360px desktop layout lock is retained. Do not alter it until desktop/mobile visual regression tests prove a change is safe.

## P0 — Google Search Console and indexation

- [ ] Confirm final canonical HTTPS domain and DNS owner.
- [ ] Create the Search Console property under the owner's Google account; prefer a Domain property once the final domain is known.
- [ ] Verify with DNS TXT or an official verification artifact/token issued by Google. Do not commit DNS credentials or invent a token.
- [ ] Generate production-only `robots.txt` and `sitemap.xml`.
- [ ] Include only public, approved, canonical pages; exclude authentication, account, admin, merchant dashboard, checkout, API, drafts, unverified entities and duplicate filter/search URLs.
- [ ] Submit sitemap; inspect indexing, crawl errors, canonical selection, manual actions and security reports.
- [ ] Keep Preview and staging noindex. Remove noindex only during an approved Production build after all release gates pass.

## P1 — Technical and content SEO

- [ ] Per-route title, description, canonical, Open Graph and Twitter metadata.
- [ ] SSR or prerender public activity, specialty, profile and catalog routes so HTML and metadata are crawlable before/without client hydration.
- [ ] Stable slugs, normalized URLs, redirect rules and duplicate-content controls.
- [ ] Use hreflang only if distinct translated routes exist.
- [ ] Structured data: Organization/WebSite; eligible verified business type; Product/Offer only for public items with strict `show_price === true` and accurate availability/currency.
- [ ] Never publish rating, address, hours, review count or offer unless verified and authorized.
- [ ] Do not add price fields to JSON-LD when permission is false/missing.
- [ ] Improve image alt text, dimensions, compression, modern formats, lazy loading, internal linking and meaningful public content.
- [ ] Build Activity → Specialty → location landing pages only where enough distinct verified content exists; do not generate doorway pages or empty location pages.
- [ ] Assess the existing fixed-width mobile layout for Google mobile usability; any layout change requires visual regression and accessibility checks.

## P1 — GA4 and privacy-safe analytics

- [ ] Owner creates GA4 property and Web stream, then supplies the real `G-XXXXXXXXXX` Measurement ID.
- [ ] Configure the GA4 ID and canonical URL at deployment time; no private credentials in public config.
- [ ] Choose exactly one tagging route: direct gtag or Google Tag Manager.
- [ ] Implement a consent manager before loading non-essential analytics. Support accept/reject/settings/withdraw; default to denied until consent where required.
- [ ] Document event dictionary: `view_directory`, `search_performed`, `view_activity_profile`, `view_catalog`, `view_catalog_item`, `click_whatsapp`, `click_call`, `request_quote`, `add_to_cart`, `begin_checkout`, `registration_completed`, `business_registration_submitted`, `subscription_checkout_started`, and `payment_success`.
- [ ] Emit `payment_success` only after server-confirmed webhook/reconciliation, never from a client redirect.
- [ ] Never send names, email, phone, message content, auth/session tokens, precise GPS, card details or unredacted query strings to Google.
- [ ] Deduplicate SPA page_view and sanitize page URLs/search parameters.
- [ ] Define GA4 conversions only after their event semantics and server confirmation are verified.

## P1/P2 — Local SEO, reporting and performance

- [ ] Google Business Profile for the platform only if it meets real eligibility criteria. Activity-provider profiles remain provider-owned and require provider consent and verified information.
- [ ] Do not invent offices, branches, addresses, ratings or phone numbers to obtain local search visibility.
- [ ] Admin reporting: Search Console clicks, impressions, CTR, position, index state, crawl errors; GA4 acquisition, engagement, event and conversion metrics.
- [ ] Weekly reports/alerts for indexing drops, sitemap errors, 404/5xx, traffic anomalies and Core Web Vitals regressions.
- [ ] Evaluate CWV at field-data 75th percentile: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.
- [ ] Validate structured data using Google Rich Results Test/Schema Markup Validator and crawl the deployed canonical domain.

## Automated acceptance

- [ ] Preview build remains noindex and has no production GA/GSC IDs.
- [ ] Production build fails closed if canonical domain/required owner-provided configuration is absent.
- [ ] Sitemap URLs are canonical HTTPS URLs that return 200 and correspond to public approved records only.
- [ ] No private records or unauthorized prices leak through JSON-LD.
- [ ] No analytics requests fire before consent; no duplicate page_view; no PII in payloads.
- [ ] Browser tests cover consent accept/reject/withdraw and SPA route tracking.
- [ ] Mobile Lighthouse/PageSpeed, accessibility, deployed Google verification and Search Console sitemap submission all pass.

## Owner inputs required when connecting

1. Final domain and DNS control.
2. Search Console owner/property verification.
3. GA4 Measurement ID and choice of gtag vs GTM.
4. Approved privacy/cookie notice and consent wording.
5. Verified legal business identity/location details if Google Business Profile is intended.

Current status: plan and Preview guard only; GA4 not configured, Search Console not verified, production sitemap/robots/schema not published, indexing not authorized.
