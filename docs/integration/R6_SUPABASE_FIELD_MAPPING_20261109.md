# R6 → Supabase Field and API Mapping — 2026-11-09

**Status:** integration contract review; NOT a source import, live schema attestation, or deployment approval.

## Source identity and verification
- User-approved archive: `bizcatalog-manager (6).zip`, SHA-256 `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`.
- Current locally hardened review package: `MantiqaTix-R6-taxonomy-verified.zip`, SHA-256 `1f6af9c715de661447dea79457e3c0d543075a05ff6cd2637cb1b01a90443054`.
- ZIP integrity: PASS; no `.data/`, `.aistudio/`, local `server.ts`, populated `.env`, or `node_modules`; mobile web components retained.
- R6 tests: **83/83 PASS** across 13 test files.
- Security boundary script: PASS.
- TypeScript/TSX syntax transpilation: **84 files, 0 syntax errors**.
- Semantic TypeScript / Vite production build: NOT VERIFIED; dependency install did not complete and `vite/client` type declarations are absent.
- This package remains local; it is not imported into this repository and not deployed.

## Public directory contract
R6 source adapter: `src/services/publicDirectory.ts`, exercised by `src/services/publicDirectory.test.ts`.

Existing current-main API:
- Edge Function `public-catalog-directory`, GET only plus CORS OPTIONS.
- Browser path: `{SUPABASE_URL}/functions/v1/public-catalog-directory`.
- Requires public anon/authenticated key; never service-role key in browser.
- Required payload marker: `accessMode = PUBLIC_DIRECTORY_READ_ONLY`.
- The server returns only active/published/approved public businesses, active provider profiles, active branches, active public items and visible current prices. It excludes inactive/test/unpublished data and suppresses hidden numeric prices.

### R6 business projection
| R6 field | Existing response | Mapping rule |
|---|---|---|
| `id` | `business.id` | Required; skip empty IDs. |
| `name`, `slug`, `category` | response business fields | Display identity only. |
| `functionalGroupId` | `activityGroupCode` | Use the explicit mapping below. |
| `isVerified` | `provider.verified` | Explicit boolean only; never infer from presence/publication. |
| `bio` | `profile.bio` / `provider.description` | Public profile. |
| `logoUrl`, `coverUrl` | `profile.logoUrl`, `profile.coverUrl` | Public image fields only. |
| `governorate`, `markaz`, `village` | matching profile fields | Public location labels. |
| `phone`, `ownerWhatsApp` | `profile.whatsappPhone`, `contactPhone`, selected active `branch.phone` | Public contact values only. |
| `address` | selected active `branch.address` | Branch-scoped value. |
| `googleMapsUrl` | `profile.google_maps_url` | URL does not attest exact GPS coordinates. |
| financial, wallet and Paymob fields | no public source | Neutral/disabled; never map from fixture data. |

## Taxonomy reconciliation
The current backend exposes 18 group codes; R6 uses 15 UI groups. The 18 mappings below are now covered by a table-driven test in the local cleanroom.

| Current platform code | R6 group |
|---|---|
| `medical_health` | `healthcare` |
| `food_grocery` | `dining` |
| `fashion_beauty` | `retail` |
| `home_maintenance` | `crafts_maintenance` |
| `construction_decor` | `crafts_maintenance` |
| `auto_transport` | `transport_logistics` |
| `real_estate` | `real_estate` |
| `education_training` | `education_training` |
| `technology_communications` | `technology_software` |
| `professional_services` | `legal_financial` |
| `marketing_media` | `services` |
| `trade_ecommerce` | `retail` |
| `agriculture_animals` | `agriculture_livestock` |
| `sports_fitness` | `sports_fitness` |
| `tourism_events` | `tourism_hotels` |
| `finance_insurance` | `legal_financial` |
| `industry_workshops` | `industrial_manufacturing` |
| `public_community` | `services` |

This is a many-to-one visual-group mapping. Preserve each activity/category/specialty code and label; R6's activity→specialty UX must not be replaced with group terminology. In particular, events and tourism share the current `tourism_events` source code and need a more specific category/specialty if the UI separates them.

## Public catalog and prices
Existing current-main API:
- Edge Function `public-catalog`, GET only, with `businessId` and optional `branchId`.
- Requires active published business, active provider and active branch.
- Returns active items and current effective active prices for selected branch/global scope only.
- Numeric price is emitted only when `metadata.catalog_public.show_price === true`.
- An item is publicly available only when `metadata.catalog_public.is_available === true`.

R6 fields:
- `Product.id`: item ID.
- `businessId`: parent public business; never client-provided tenant scope.
- `name`: `name_ar`, then `name_en`.
- `type`: `item_type` SERVICE→service, other supported type→product.
- `category/unit/imageUrl`: public `metadata.catalog_public` only.
- `price`: active effective price; selected-branch row first, global row fallback only.
- `requiresQuote`: `show_price !== true`; do not represent hidden price as free.
- `isAvailable`: public availability plus explicitly published price for priced items.
- Effective-date/status filtering and tenant scope remain server responsibilities.

## Identity and membership contract
Current main already has Supabase Auth and:
- active rows in `user_memberships` for the authenticated user;
- Edge Function `api`, GET `/api/v1/me`, with Bearer token verification using server-side `auth.getUser(token)`;
- membership projection: `id, tenant_id, organization_id, business_id, branch_id, role, permissions, status`;
- scoped catalogue administration through `catalog-admin`;
- platform scope through `catalog-platform-admin` with a verified platform-level SUPER_ADMIN membership.

R6 deliberately blocks production login today. Keep that fail-closed boundary until a real Supabase Auth session lifecycle, token refresh/logout, server-verified `/api/v1/me`, active membership selection and scoped action adapters are implemented. The current R6 package manifest does not yet contain `@supabase/supabase-js`; lockfile/install/build must be updated and verified before enabling login. Do not enable the demo login handlers or trust client role strings.

## Known read limitations
- The current public directory Edge Function caps its result at 100 businesses and has no cursor/keyset input in the current R6 adapter. A full all-Egypt directory needs stable backend pagination; a UI “show more” control cannot fetch beyond the server cap.
- The current public projection does not return precise branch latitude/longitude. Do not claim exact nearby sorting from map URLs or fallback city coordinates.
- The separate `public-catalog` single-business read adapter still needs an R6 detail-page integration test.

## Write domains blocked pending contracts
Orders/checkout, bookings, wallet/ledger, sales, subscription/billing, Paymob, commissions, customer/member messages, notifications, ad requests/spend, sponsored placements, promotional signage, uploads, WhatsApp dispatch, AI autopilot, backup/restore and realtime writes remain disabled/unmapped until each has server-side authorization, tenant/branch scope, idempotency where needed, audit coverage and adversarial tests.

## Next release gates
1. Import exact sanitized R6 source into `apps/aistudio-v6` on a dedicated branch; preserve mobile web UI and keep native Android separate.
2. Reconcile field mapping against live deployed Edge versions and actual schema.
3. Implement Supabase Auth + `/api/v1/me` + membership-backed roles and scope.
4. Implement server pagination and precise public coordinate contract.
5. Integrate approved catalog-admin actions only, then full E2E/a11y/PWA/mobile validation in Preview.
6. Keep the existing V6 root and `/legacy/` rollback until an explicitly reviewed R6 cutover.

**Release status:** R6 integration in progress; `FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED`. No Production Supabase writes or R6 deployment are approved by this file.
