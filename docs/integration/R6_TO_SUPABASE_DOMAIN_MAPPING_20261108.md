# R6 Domain-to-Supabase Mapping — 2026-11-08

**Status: DESIGN/CONTRACT MAPPING ONLY.** This is based on the extracted R6 TypeScript model and the current-main adapter/Edge source contract. It does not assert that R6 is imported, wired, or runtime-tested.

## Sources examined

### R6 archive
- `src/types/index.ts`
- `src/context/AppContext.tsx`
- `src/data/seedData.ts`
- `src/data/allBusinessesProductsCatalog.ts`
- `src/components/medical/MedicalDirectoryView.tsx`
- `src/components/storefront/CatalogSection.tsx`
- `src/components/storefront/BusinessProfileHeader.tsx`
- `src/components/mobile/MobileAppBottomNav.tsx`
- `src/components/mobile/MobileSponsoredStoriesBar.tsx`
- `package.json`, `vite.config.ts`, `public/manifest.json`, `public/sw.js`

R6 type declarations of particular concern:
- `Business` (lines 87–198)
- `MemberDirectMessage` (218–238)
- `SaleRecord` (298–312)
- `Product` (323–335)
- `Subscriber` (347–368)
- `AdminSettings` (388 onwards)
- `AuthRole/AuthSession` (429 onwards)
- `SubscriptionRequest` (552–583)
- `WalletAccount/WalletTransaction` (608–639)
- `GeneratedMarketingCampaign` (648 onwards)

### Current MantiqaTix main source contract
- `apps/catalog-frontend/src/lib/production.ts` — blob SHA `91569747476959214452e4413e00f655774b83ba`
- `apps/catalog-frontend/src/types/index.ts` — blob SHA `bc34b7f3463ce0783d0019aa28b33098b8235a10`
- `supabase/functions/public-catalog-directory/index.ts` — blob SHA recorded in `R6_SUPABASE_CONTRACT_BASELINE_20261108.md`
- `supabase/functions/public-catalog/index.ts` — blob SHA recorded in that baseline
- `supabase/functions/api/index.ts`, `catalog-admin/index.ts`, `catalog-platform-admin/index.ts` — blob SHAs recorded in that baseline

## 1. Mapping matrix

| R6 model / feature | Existing MantiqaTix contract | Mapping status | Required treatment |
|---|---|---|---|
| Public home and directory cards | `public-catalog-directory` GET | DIRECT READ ADAPTER EXISTS; R6 mapping still required | Call the public directory adapter only. Render only published businesses, active provider profile/branch and approved public projection. |
| Business public profile | `public-catalog` GET by validated businessId and optional branchId | DIRECT READ ADAPTER EXISTS; R6 mapping still required | Normalize profile/provider/branch into R6 view model. Use approved logo/cover/contact/location fields only. |
| R6 Business name/slug/category/bio/location/workingHours | Current public projection exposes business/provider/profile/branch reduced fields | ADAPTER REQUIRED | Map only fields actually returned by the two public Edge Functions. Do not rely on R6 seed/defaults when a field is absent. |
| R6 verificationStatus/isVerified | `marketing_provider_profiles` provider verification flag in current public contract | ADAPTER REQUIRED | Derive the public verification display only from the server-returned provider verified property. Never promote an unverified business because R6 seed says `isVerified=true`. |
| R6 ownerWhatsApp/phone/email/social/custom links | Reduced public profile projection | PARTIAL / FIELD-BY-FIELD REVIEW | Only show fields explicitly returned and permitted by the public contract and consent/publication rules. Do not serialize private owner/contact data from local state. |
| R6 geography (country/governorate/markaz/village/lat/lng/mapsLink) | Public profile and active branch location fields are present in the reduced projection | ADAPTER REQUIRED | Normalize branch selection and coordinate validity. No proof here of a dedicated route for distance ranking; client distance is display/search calculation only and cannot establish stored location truth. |
| R6 `FunctionalGroupId` and `ActivityCategory` | Main canonical activity-group/category codes and mapping helpers | ADAPTER REQUIRED | R6 has 15 IDs (`dining`, `retail`, `services`, etc.); main has 18 canonical IDs (`food_grocery`, `medical_health`, etc.). Never cast R6 group ID directly into the main union. Build explicit reviewed bidirectional mapping plus a safe unknown/unmapped state. Preserve the platform's Activity → Specialty navigation model. |
| R6 MedicalSpecialty / medicalType / doctorTitle / consultationFee | Public catalog exposes provider kind, activity/category/classification/specialty metadata, and reduced profile data; current baseline does not confirm a specialty lookup table or complete medical field contract | NOT FULLY MAPPED | First reconcile exact codes and public data authority. Medical specialty/title/consultation fee stay hidden unless explicitly returned by an approved read projection. Do not invent table names or re-publish private medical directories. |
| R6 `Product` identity/name/category/type/description/unit/image | `catalog_items` in `public-catalog-directory` and `public-catalog` | ADAPTER REQUIRED | Normalize item name/type/description and public metadata. Do not trust client item status; rely on the already-filtered server projection and reject explicit non-ACTIVE rows. |
| R6 Product.price / comparePrice | `catalog_item_prices` effective ACTIVE rows | ADAPTER REQUIRED | Choose only matching item and selected branch (or permitted business-wide price); honor effective_from/effective_to; numeric price only if `metadata.catalog_public.show_price === true`. Add a `requiresQuote` UI state for hidden-price services; never turn hidden price into zero-price sale. |
| R6 Product.isAvailable | Item public metadata `catalog_public.is_available`, plus active stock calculation where stock is tracked | ADAPTER REQUIRED | Public edge response is the authority. Do not default missing local values to available. |
| R6 CartItem / WhatsApp cart | No confirmed order/checkout write contract in the pre-import baseline | NOT MAPPED / WRITE BLOCKED | Preserve as UI only until a validated order API exists. No order creation, reservation, or payment should be simulated as a production success. |
| R6 `Subscriber` identity/contact | Supabase Auth user plus `user_memberships`; `api GET /api/v1/me` returns active membership scopes | ADAPTER REQUIRED | Subscriber in R6 must become a presentation model built from Auth identity and active membership. Keep membership id distinct from Auth user id; preserve tenant/business/branch/organization scope. |
| R6 Subscriber.username/password/authMethod | Supabase Auth | PROHIBITED AS-IS | Discard R6 password and local username credential authority. Do not import, display, or write passwords. Use Supabase Auth sign-in/invite/reset flows only. Email is a label/login identifier, not proof of identity. |
| R6 AuthRole / AuthSession (`super_admin`, `regional_manager`, `medical_staff`, etc.) | Supabase Auth + server-returned `user_memberships` + `catalog-admin` / `catalog-platform-admin` checks | PROHIBITED AS-IS; ADAPTER REQUIRED | R6 role enums cannot authorize anything. Derive broad UI mode from verified session; keep exact role, permission and resource scope from active membership and server enforcement. Platform admin requires `SUPER_ADMIN`, no business/branch scope, `permissions.scope=PLATFORM`, `full_control=true`. |
| R6 `AdminSettings.adminPassword` | Main production adapter initializes `adminPassword: ''`; Google/Supabase Auth and platform-admin Edge function | PROHIBITED | Never transfer client-side admin password. Remove this field from the production model. |
| R6 `AdminSettings.aiStudioApiKey` / provider keys | Existing server-side `ai-gemini-proxy` Edge Function for approved image generation | PROHIBITED IN CLIENT | No AI provider key in browser storage, app config, archive environment, or static bundle. Route only approved actions through a server proxy with quotas and authorization. |
| R6 Business employees array | `user_memberships` / `catalog-admin` scope model | ADAPTER REQUIRED; MUTATIONS BLOCKED | Employees must be real Auth identities with active membership/branch scope. R6 nested employee objects cannot be treated as accounts or permissions. |
| R6 `SaleRecord` | No confirmed sales/orders ledger contract in the pre-import baseline | NOT MAPPED / FINANCE BLOCKED | Never create financial truth from client state. Require verified order, payment, commission, ledger and audit contracts before exposing transaction actions. |
| R6 billing/subscription requests and plan tiers | Main baseline identifies business membership and finance/payment contracts as separate; current frontend contract records subscription state as server-backed but does not certify billing lifecycle | PARTIAL / MUTATIONS BLOCKED | Read only fields explicitly authorized by current server action. No local billing sweep, due-date freeze, renewal, or plan payment. Confirm exact live schema/Edge versions and permissions first. |
| R6 PaymobConfig / CustomerOrderData payment fields | No payment write contract approved by the R6 pre-import baseline | BLOCKED | Do not import R6 Paymob API keys or process direct browser payment fields. Verify provider signature against actual callback contract, idempotency, amount/currency/order binding, ledger and reconciliation in sandbox before production. |
| R6 WalletAccount / WalletTransaction / creditLimit / commission | Finance/wallet contract remains unreconciled and global finance gate blocked | BLOCKED | No read/write of balances or financial history until authoritative schema, ACL, server RPC/Edge contracts and audit trail are verified. Local values must not be presented as balances. |
| R6 MemberDirectMessage / CRM | No matching approved messaging table/Edge contract found in the current R6 backend baseline | NOT MAPPED | Keep sending/reading/replying disabled as production operations until data model, recipient scope, privacy, abuse controls and RLS/Edge authorization are established. |
| R6 GeneratedMarketingCampaign / ads requests | Current public directory exposes selected marketing provider metadata; no complete campaign/ads write contract established here | PARTIAL READ / WRITE NOT MAPPED | Campaign generation may remain draft-only; ad spend, placement, publish, targeting and ROI must be server-backed with budget approval and audit before activation. Never invent reach, spend or conversion. |
| R6 AI image generation | Current main `production.ts` invokes `ai-gemini-proxy` using an approved action | EXISTING SERVER PROXY FOR A NARROW ACTION | Adapt only the supported `generate_catalog_image` action and test membership, quotas and output validation. This does not map the archive's general AI autopilot. |
| R6 mobile web UI | `src/components/mobile/` in R6 plus the same public/admin adapters as desktop | PRESERVE | Retain the two mobile components and responsive layouts. Run separate mobile viewport/PWA tests. Do not conflate with native Android. |
| Native Android/Kotlin | Separate historical Android preservation register | SEPARATE WORKSTREAM | Keep archived Android source intact. R6 archive does not include native Gradle project. |

## 2. Existing backend endpoints/functions that can be reused

1. **Public directory:** `public-catalog-directory` — GET-only public reduced projection.
2. **Public activity catalogue:** `public-catalog` — GET-only validated business/branch projection.
3. **Authenticated identity bootstrap:** Supabase Auth plus `api GET /api/v1/me` — verified bearer token and ACTIVE `user_memberships`.
4. **Business catalogue management:** `catalog-admin` — token, membership, tenant/business/branch, role and permission checks; use only actions already implemented and tested server-side.
5. **Platform administration:** `catalog-platform-admin` — explicit platform SUPER_ADMIN scope and full_control permission.
6. **AI image proxy:** `ai-gemini-proxy` — only for action(s) actually supported by current source; no browser provider secret.

These function contracts are based on the checked-in `main` source and the pre-import contract baseline. Live deployed version/hash parity, current schema/grants and end-to-end authorization behavior require a fresh independent read before production enablement.

## 3. Required adapter layers

Implement R6 behind explicit ports/adapters; do not make components call Supabase tables directly:

- `PublicDirectoryPort`: fetch directory and map published business records.
- `PublicBusinessCatalogPort`: fetch business and branch-specific catalogue.
- `AuthPort`: Supabase Auth identity lifecycle; no R6 password state.
- `MembershipPort`: load server-verified `user_memberships`, preserve tenant/business/branch/organization scope.
- `CatalogAdminPort`: invoke existing catalog-admin actions only, with UI capability gates driven by server permissions.
- `PlatformAdminPort`: invoke platform-admin function only after server-side platform scope check.
- `AIImagePort`: only supported ai-gemini-proxy action.
- Separate future ports for Orders, Bookings, Wallet, Finance, Messages, Campaigns and Notifications; leave disabled until approved contracts and tests exist.

## 4. Non-negotiable mapping tests

- Directory omits inactive businesses, test/isolation tenants, inactive provider profiles, unpublished catalogues and items not marked publicly available.
- Hidden/quote-only prices never leak numeric amounts; current-branch price cannot fall back to a different branch's price.
- Unverified provider status remains unverified even when R6 fixture says verified.
- Unmapped taxonomy codes never silently become a different live activity group.
- Authenticated user with no active membership receives no merchant/admin access.
- User-supplied R6 `role`, `businessId`, `tenantId`, `branchId`, URL params and browser storage cannot widen authority.
- Employee/member reads and writes are denied when tenant/business/branch differs.
- R6 passwords, admin password, API keys and local session tokens never appear in app bundle, storage, logs or exports.
- Sale, booking, wallet, subscription, payment, commission and ad-spend actions fail closed until a dedicated API contract and idempotency/security tests exist.
- Mobile layout preserves access to public directory and sign-in while retaining the selected R6 responsive interaction model.

## 5. Priority sequence

1. **P0 source sanitation:** keep `.data/`, backups, `.aistudio/`, populated environment files and unsafe `server.ts` out of app import and all public artifacts.
2. **P0 frontend auth removal:** replace R6 local admin/customer login and local role authority with Supabase Auth; role/scope only from verified active memberships.
3. **P1 public adapter:** wire directory and public activity catalogue to the two read-only public Edge functions, with field mapping tests.
4. **P1 taxonomy/medical adapter:** reconcile R6 15-group taxonomy and healthcare specialty identifiers to canonical activity/specialty codes.
5. **P1 catalogue UI:** add quote-aware pricing, correct branch-specific price handling, public-only contact/media/availability.
6. **P2 merchant/admin adapter:** connect each screen action to existing catalog-admin/platform-admin server action after permission and scope review.
7. **P2/P3 integrations:** separate design/review gates for messages, booking, CRM, ads and notifications.
8. **Finance/payment:** last, in sandbox first, after exact live schema/ACL, Edge parity, webhook authenticity, idempotency and ledger E2E.

## 6. Gate summary

| Gate | Status |
|---|---|
| R6 source archive integrity | PASS |
| R6 unit tests (existing tests only) | PASS 78/78 |
| Existing public directory/catalog backend contracts | FOUND IN MAIN SOURCE |
| R6 public field map | PARTIAL; needs implementation and mapping tests |
| Auth/membership backend contract | FOUND IN MAIN SOURCE |
| R6 auth replacement | NOT IMPLEMENTED |
| R6 roles and local state sanitization | BLOCKED |
| R6 merchant/admin action mapping | NOT MAPPED |
| Medical specialty / provider detail contract | NOT FULLY VERIFIED |
| Orders/bookings/messages/CRM/marketing writes | NOT MAPPED |
| Wallet/finance/Paymob | BLOCKED |
| Mobile web source preservation | PASS in archive inventory |
| TypeScript/build/E2E/PWA | NOT VERIFIED due dependency availability |
| Production Pages cutover | NOT AUTHORIZED |
| Overall platform | BLOCKED / NOT CERTIFIED |

No inference in this document authorizes production writes, schema changes, Edge Function deployment, payment execution, or website cutover.
