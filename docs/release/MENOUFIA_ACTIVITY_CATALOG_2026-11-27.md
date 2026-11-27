# Menoufia activity catalog — 27 November 2026

## Scope shipped in this change

- Reuse the canonical MantiqatiX taxonomy: 10 functional groups, 50 activity categories, and their existing specialty folders.
- Add a shareable governorate scope using the canonical Egypt geographic dataset. The Menoufia deep link is:
  `https://islamnagy2022-eng.github.io/MantiqatiX/?governorate=%D8%A7%D9%84%D9%85%D9%86%D9%88%D9%81%D9%8A%D8%A9`
- Keep the published-business read path and its existing activity/category filters. The governorate selection does not create business records or infer that an activity exists in every town.
- Add governorate-aware canonical URLs, page titles and descriptions for the Menoufia landing page and its activity/specialty routes.

## Data source and rights decision

The following Menoufia directories are retained as **discovery references only**:

- https://www.mnfdaleel.com/
- https://menoufia24.com/

Their published terms do not grant MantiqatiX a blanket right to copy their business records, text, photos, phone numbers or other listing content for commercial republication. The Menoufia Directory terms expressly prohibit copying or transferring information and reserve listing content to the directory and activity owners. Menoufia24 terms limit service use to personal purposes unless separately authorized and protect site content under copyright.

Therefore this release does **not** scrape or copy either site's entries, descriptions, images or contact details. Obtaining written permission or an explicit reusable-data license is required before importing their listing records. Generic activity taxonomy remains the platform's own canonical structure; directory category labels are not imported as a database of businesses.

## Unverified records and publication boundary

- No business record is fabricated or inferred from a category name.
- Any future record imported from a source with a verified reuse license, submitted by an owner, or otherwise lawfully obtained must default to `غير موثق` until its identity and details are reviewed.
- An external directory listing being visible online is not proof that the business is active, that its phone number is current, or that the platform may republish it.
- Public unclaimed directory listings remain disabled. Do not flip `PUBLIC_UNCLAIMED_DIRECTORY_LISTINGS_ENABLED`, enable the server flag, deploy the directory Edge bundle, or write to Production data until the source-rights, contact-consent, schema/RPC/ACL/RLS, privacy and matching Edge release gates have passed together.
- Registered businesses continue to appear only through the existing public publication and active-status checks.

## Verification

The Pages validation workflow runs:

- `scripts/validate-menoufia-activity-catalog.mjs`
- The dashboard browser E2E also opens the Menoufia deep link over a saved different governorate, verifies API filtering, excludes out-of-province results, checks the canonical URL, and returns to all Egypt.
- The existing 50-category / 10-group canonical activity taxonomy validation.
- TypeScript lint and production build.
- Existing privacy, authorization, browser and deployed-origin checks.

This release adds a Menoufia discovery scope and SEO routes. It does not claim that a comprehensive set of local business records has been imported or that all businesses in the governorate are listed.
