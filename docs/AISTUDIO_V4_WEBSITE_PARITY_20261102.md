# Google AI Studio v4 → Website Parity Map

**Date:** 2026-11-02  
**Reference archive:** `bizcatalog-manager (4).zip`  
**Archive SHA-256:** `e49e202716c38c5564b8a82db9a74b4fe2c93ebbdecb4a347a7a110b799d6df2`  
**Website baseline:** `main` at `f3cc30c509f937fc6958bca43bb61936f9853cdf` (PR #650 catalog convergence merged; PR #651 evidence-only update merged).  
**Working branch:** `feat/aistudio-v4-website-convergence-20261102` (historical implementation branch; PR #650 merged).  
**Status:** The first scoped V4 visual/convergence release is merged and deployed. Directory remains the default entry. Remaining visual parity and backend-dependent workflows are tracked below; this is not full-platform certification.

## Owner's governing decisions

1. Google AI Studio v4 is the primary visual and functional reference for the website.
2. Existing website-only capabilities must be explicitly listed and retained; do not silently delete, disable, or overwrite them.
3. Genuine activity/business records already in production remain the source of truth. Preserve them unchanged in this parity phase; profile detail corrections are a later phase.
4. Archive seed businesses, invented sample metrics, temporary media, in-memory server state, and localStorage-only business persistence are not production data.
5. The activity taxonomy and specialty paths in the reference can be adopted, but no business record may be fabricated or promoted to verified status.
6. Shared backend/API changes must use current Supabase contracts and authorization. UI similarity does not authorize browser-side writes, new payment flows, or production DDL.
7. Keep all work isolated from `main`; no production deployment until review and separate release approval.

## Reference screen inventory and mapping

| AI Studio v4 screen / component | Reference behavior | Current website baseline | Parity action |
|---|---|---|---|
| Global shell / `Navbar.tsx` | Dark micro-header, brand/navigation row, activity context, login, cart, install actions | `Navbar.tsx` already has a dark announcement/session strip, role-aware Google session state, directory/store links, dashboard entries, install and cart | Re-style toward v4 while retaining role/membership guards and current navigation. |
| Directory / `DirectoryView.tsx` | Business/activity discovery, search, categories, business hero and product preview | Unified Egypt directory, activity → specialty navigation, verified-first ranking, geo consent/manual filters, published unclaimed listings, server keyset pagination and 20-item progressive loading | Keep this as the default V4 homepage/search experience; Marketplace is an additional opt-in screen. |
| Marketplace Home / `MarketplaceHome.tsx` | — | Main directory remains default root | Additional opt-in discovery page with verified business cards, active approved ads and actual recorded product/service discounts; opens the existing directory search and secure public catalog route. |
| Medical directory / `MedicalDirectoryView.tsx` | Dedicated doctors, pharmacies, labs and clinics search | Separate public route `?view=medical_directory` is mounted in `App.tsx`; it reads the existing `directoryBusinesses` feed and canonical medical taxonomy, with type/specialty/geography filters and 20-item progressive batches | Route is implemented on `main`; preserve the unified production data source, verified-first state and current public catalog opening rules. |
| Business storefront / `BusinessProfileHeader.tsx` + `CatalogSection.tsx` | Wide cover, prominent logo, trust badges, contact/location, product/service catalog filters | Current dedicated direct-link storefront with verified/operational visibility guards, owner cover/logo, contact and social links, QR/share, product/service filters and cart | Match the reference's full-width hero/profile composition; keep current direct-link privacy and operational-state rules. |
| Cart / `CartDrawer.tsx` | Quantity controls and merchant-directed checkout | Current website has a cart and guarded catalog/order flow | Match visual details only; preserve current order/checkout contract. |
| Owner dashboard / `MerchantDashboard.tsx` | Product catalogue, cover/logo, activity profile/location, sector engine, finance, QR and custom links | Current tabs: products, CSV import, branding, profile/location, activity profile, permanent QR and employees | Bring v4 layout and add real-source finance/custom-link sections after contract check. Preserve website-only CSV import and employee manager. |
| Enterprise dashboard / `UnifiedEnterpriseDashboard.tsx` | Merchant products/finance/branding/employees/QR; admin businesses, subscription requests, inbox, ads, personal sites, billing, AI Studio | Current main uses separate role-gated merchant, professional and admin dashboards | Map each v4 operation to an existing canonical module or record an uncovered workflow; do not merge a second dashboard/data model. |
| Admin dashboard / `AdminDashboard.tsx` | Businesses/subscribers, billing, commissions, taxonomy, verification, backup/restore, AI Studio development | Current admin tabs include billing, commissions, taxonomy, businesses, subscribers, published directory listings, activity modules, settings, backup and Super Admin Control Center | Reuse visual patterns and workflow labels; current server-authorized actions and release guards take precedence. |
| Super Admin / `SuperAdminControlCenter` concept | People, roles, permissions, subscriptions and global controls | Website has `SuperAdminControlCenter.tsx` with custom roles, role assignments, module/action permission matrix, employees, audit and server RPC calls | Preserve and place within the v4 admin visual hierarchy; do not replace with the older local state implementation. |
| Login / profile | Google login modal and user profile modal | Current Google Auth/session bootstrap, login modal, active-membership resolver and role guards | Preserve real Google Auth and active membership checks. Profile/portal gaps are tracked separately. |
| Subscription request / ad request | Business subscription and ad-request forms | Existing website subscription/registration flow; no current parity confirmation for all v4 ad-request UI | Inspect form contracts and add only through existing server-side request paths. |
| Contact / messages / sitemap | `ContactUsView`, `MemberMessagesView`, `SiteMapView` | Contact and Site Map routes are mounted in `App.tsx`; Member Messages is not mounted | Contact and Site Map are implemented safely. Keep Member Messages deferred until durable server persistence, recipient/tenant authorization, audit and notification delivery are verified. |
| Marketing / sector development | Smart marketing modal, marketing-services modal, sector-development modal and activity promotion UI | Current ActivityModule view provides activity-specific marketing plans and capabilities, explicitly planned where backend execution is not verified | Preserve planning and safe marketing boundaries; no campaign publish, spend, wallet or promotion action without verified API/RPC. |
| Wallet / finance | Wallet modal, ledger and transaction screens | Current website has finance/admin reporting foundations, but no parity proof for a member wallet UX matching v4 | Reconcile against verified finance contracts first; do not port the prototype wallet state or create parallel ledger. |
| QR / install | QR modal and app-install actions | Permanent storefront QR and install controls exist | Match visual treatment while preserving stable public URL and current QR behavior. |
| Image tools | Image library and Gemini image modal | Current server-authorized AI image proxy/default-image flow | Port only through the existing server proxy, quotas, audit and storage; no browser API key. |

## Website-only capabilities to preserve and fold into v4

These are present on current website `main` but are not equivalent capabilities in the uploaded prototype. They must remain in the target website and should be visually integrated into the v4 experience:

1. **Production Google Auth + membership authorization:** guest, authenticated-without-membership, subscriber, platform admin, and active business/branch scopes; no role granted merely because a Google account exists.
2. **Server-backed business and directory data:** current Supabase loading/mutation paths and public directory Edge Function. Do not replace with localStorage as a source of truth.
3. **20-row progressive loading and server keyset pagination:** stable cursor, filters applied before limit, stale-response protection and no duplicate IDs.
4. **Verified-first discovery and unconfirmed-state separation:** real verified businesses remain ahead of unverified and public-directory records. No fabricated trust badges.
5. **Canonical activity → specialty routing:** stable activity IDs, activity-specific pages and specialty filters. Do not reintroduce a public functional-groups/professions navigation layer.
6. **Activity-specific module registry:** per-activity marketing guidance and three planned operating capabilities, with unsupported capabilities labelled as planned rather than active.
7. **Custom Super Admin roles and permission matrix:** server RPC-backed role creation/assignment/revocation and audit trail, with explicit server-side enforcement boundary.
8. **Employee and branch scope controls:** employee manager, branch-aware memberships and permission-based dashboard sections.
9. **Directory listing administration:** management of published unclaimed listings separate from registered businesses and their owner claims.
10. **Commission rules management:** current admin module and its validated rule model.
11. **CSV catalog import:** current owner workflow and validation; keep it as an additional owner-dashboard tab.
12. **Facebook Page import and media mirroring:** current owner-authorized flow through `facebook-page-import`; public media path does not depend on a private Facebook URL at render time.
13. **Category-aware image fallbacks:** current default image resolver for product/service/activity visuals.
14. **Fail-closed route and role guards:** direct public storefront links remain isolated; guests cannot access owner/admin dashboards or generic private store views.

## Ported contact and sitemap screens — safe website behavior

- Added `ContactUsView.tsx` and public route `?view=contact_us`. It collects the user's message in page state, then prepares a WhatsApp deep link to the real configured platform admin number. It explicitly tells the visitor that this page does **not** persist the message inside MantiqatiX. It does not claim inbox delivery or create a hidden local message record.
- Added `SiteMapView.tsx` and public route `?view=site_map`. It lists only actual current website screens and includes owner/admin screens only when the authenticated session has the matching current permission. It does not invent future modules or claim a configured percentage-complete status.
- Added footer navigation links to Contact and Site Map.
- Member-to-member messaging page is intentionally **not** ported yet. The AI Studio prototype stores messages in local AppContext/localStorage; current website needs a durable authorized server API with recipient privacy, inbox, audit, and read/write boundaries before this can be a real messaging feature.

## Prototype-only data, code and claims excluded from production

- `src/data/seedData.ts` includes 32 `INITIAL_BUSINESSES` fixtures and other sample accounts/products. Do not import or publish these records.
- `src/context/AppContext.tsx` persists many business, subscriber, catalog, wallet, marketing and messaging states in browser `localStorage`. This is not the production data layer.
- `server.ts` keeps example notifications in process memory. It is not a durable notification service.
- Temporary AI Studio media under `.aistudio/artifacts/.../.tempmediaStorage/` is not a production media library and has no verified commercial rights metadata.
- Prototype UI contains sample counters, sales, visitor totals, credit, wallet and activity data. Do not surface them as actual production metrics.
- Direct Google Gemini API calls or browser-exposed credentials are excluded. Use the current server-authorized AI image proxy.
- The architecture/capacity/load-test/security/DR markdown files are design artefacts, not proof of 100-million-user readiness, real load testing, security certification or measured RPO/RTO. Any capacity target requires independent reproducible benchmarks and verified infrastructure.

## Owner-dashboard gaps found in v4 prototype logic (not safe to port as-is)

- **Financial tab:** the prototype writes manual sale rows through `addSaleRecord` and local browser state. The UI initializes commission defaults locally (including a fallback 3% rate and sample customer phone). These are not verified finance transactions and do not use the current canonical financial journal/settlement contracts. Port the visual layout only after the live finance API/RPC, authorization, audit, idempotency and reconciliation gates are verified; never port the fallback values or fake sale creation.
- **Custom links tab:** the prototype mutates `currentBusiness.customLinks` through the prototype AppContext/localStorage. The current website's canonical Business type/production mapping does not expose this field as a verified persisted contract. Do not save such links locally and present them as live. Revisit only after a scoped server-side storage/API contract and public-render sanitization are approved.
- **Existing owner-only extras to retain:** website CSV import and employee/branch management are absent from the AI Studio owner tabs but are current useful site features. Keep them as additional tools; they must not replace the three primary v4 tabs (catalog, branding, business/contact details).
- **Brand name:** current project README establishes MantiqatiX as the official public brand. Preserve that identity; the prototype's “كتالوج بلس” screenshot label is not authorization to rename the deployed brand.

## Exact differences requiring implementation or contract review

### Reference features not found as equivalent in current main
- Dedicated public contact page, member-to-member messages page and sitemap route (contact and sitemap have now been ported safely; messages remains deferred pending durable backend contracts).
- Explicit owner-dashboard tabs for **finance** and **custom links** (the website has adjacent reporting/profile features but not proven screen/contract parity).
- Medical directory is now a mounted separate presentation route backed by the same production directory feed; remaining work is visual parity and any owner-approved filter refinements, not a second medical database.
- Reference-specific ad request, wallet, marketing-service, sector-development and AI Studio modal UX (must be reconciled with current secure server contracts, not copied wholesale).
- Reference dashboard's exact visual shell: wide full-bleed cover/profile treatment, dark owner-dashboard hero, tab geometry, typography and spacing.

### Website features absent or materially stronger in the reference
- CSV import and employee management within the owner dashboard.
- Dedicated Super Admin Control Center with custom-role matrix, scoped role assignments and audit.
- Activity module registry/configuration per canonical activity.
- Public directory listings management separated from verified registered business records.
- Server-backed keyset pagination and production filters.
- Facebook page import/media mirroring and category-aware default media.
- Strict Google session, membership, role and branch authorization.
- Backend-backed current production records rather than localStorage/demo fixtures.

## Recommended implementation waves

1. **Wave A — presentation parity:** match global navigation, public directory/storefront and owner dashboard visual composition while preserving all current routes, roles and behavior. (No backend mutation.)
2. **Wave B — owner feature parity:** reconcile finance and custom links, then implement only from verified persisted APIs; retain CSV import, employees, QR and Facebook integration.
3. **Wave C — platform/admin parity:** reorganize existing admin and Super Admin modules into the v4 hierarchy; add missing contact/messages/sitemap/ad-request surfaces only with durable server contracts.
4. **Wave D — marketing, AI and money:** port safe screens first; connect campaigns, image services and finance only when server APIs, RLS/RBAC, audit/idempotency and runtime evidence exist.
5. **Wave E — regression and release:** exact-head build, typecheck, contracts, PostgreSQL/RBAC, security/privacy, Playwright desktop/mobile, live read-only smoke tests, independent review and approved deployment.


## Additional in-flight website developments outside the AI Studio v4 archive

These workstreams are not represented in the AI Studio v4 source archive. They are owner-review candidates to fold into the v4 target while retaining current v4 behavior:

- **PR #647 — Premium Marketplace Home + separate search**: its safe presentation/data flow is ported as optional route `?view=marketplace_home` and a navigation tab. The V4 `DirectoryView` remains the default root and full search screen. Marketplace reads the published public directory and its real catalog product rows, shows only active public verified businesses and recorded discounts, and retrieves only approved targeted ads through the current read RPC. The duplicate location-consent overlay was removed; GPS permission is still requested only by the existing DirectoryView search flow. No fake offers or balances are added. The original PR remains an open historical candidate and is not being merged as-is.
- **PR #648 — Canonical taxonomy + mobile 8-column regression**: closed as superseded after verifying that the canonical pharmacy-precedence and eight-column mobile regression is already present on current `main` in a newer adapted browser scenario, while the taxonomy validator is byte-identical to `main`. No test coverage was removed and no duplicate merge is needed.
- **PR #646 — Subscriber account portal**: adds an authenticated account/subscribe overview. It is still Draft and must not be merged as-is: its current Navbar diff removes existing merchant dashboard, professional dashboard and Super Admin navigation actions. Only the account portal itself is a candidate; if brought into V4, it must retain every existing dashboard entry and keep cross-membership switching disabled until server/backend parity is verified.

PR #650 and PR #651 are merged into current `main`; PR #648 is closed as superseded. PRs #647, #646, #645, #644 and #609 remain open and are not part of the deployed website at this checkpoint. They remain pending candidates, not shipped functionality.

## Visual implementation checkpoint

- Storefront cover is full-width with desktop reference ratio `1440/390`. Its permanent dark gradient is currently deferred because current website's validated UX contract requires the image to remain bright by default and darken only on hover/keyboard focus. This conflict is surfaced for owner decision.
- Merchant dashboard hero uses the reference navy gradient and carries the matching owner-dashboard title, plus working actions for previewing the current business storefront and opening the existing add-item modal.
- The buttons call existing application functions; no new database or persistence logic was introduced.
- PR #650's scoped exact-head build, employee RBAC PostgreSQL, browser E2E and Pages validation passed; its Pages deployment and main validation runs succeeded. Those results apply to the merged release scope only, not to later unreleased PRs or full-platform readiness.


## Owner decision required — storefront cover overlay conflict

- AI Studio v4 screenshot uses a persistent dark gradient overlay over the activity cover.
- Current website validator `scripts/validate-business-social-links.mjs` explicitly requires a bright default cover that darkens only on hover or keyboard focus.
- To avoid silently removing an established website behavior, the permanent overlay was reverted on the parity branch. Full-width/wide cover sizing remains.
- **Pending owner choice:** keep current bright default with hover/focus darkening, or supersede it with the always-darkened cover from AI Studio v4. No further change to this behavior until the decision is recorded.

## Exact-head validation and scoped release result — PR #650

- [x] PR #650 was merged to `main` at `25d486c592d6ed9b057f8ef179fbbeae1fc79ba5`.
- [x] The scoped Pages deployment run `41433049776` and main validation run `41433049782` succeeded for the catalog convergence scope.
- [x] The validated scope included build, employee RBAC PostgreSQL, browser E2E, deployed-origin checks and the scoped catalog journeys recorded in the release evidence.
- [x] PR #651 later merged the read-only Production evidence refresh as `f3cc30c509f937fc6958bca43bb61936f9853cdf`; it made no Production mutation.
- [ ] The storefront dark-overlay choice remains an owner decision: preserve bright-by-default/hover-focus darkening or explicitly adopt the persistent overlay. Do not silently change it.
- [ ] Remaining V4 parity requires its own exact-head tests and scoped release; PR #650's PASS is not inherited by new changes.

## Current execution checkpoint

- Archive integrity and file inventory were inspected.
- Current main and open pull requests were inspected.
- This mapping is an initial source-level comparison; every individual action still requires line-level contract review.
- Implemented on the convergence branch and merged through PR [#650](https://github.com/islamnagy2022-eng/MantiqatiX/pull/650): full-width storefront cover, current approved bright-by-default overlay behavior, dark owner-dashboard hero, and owner preview/add-item actions. Actions reuse existing application routes and the existing add-item modal; no database logic was changed.
- The final PR #650 source head was validated before merge; subsequent scoped Pages deployment and main validation completed successfully. Earlier intermediate branch-head runs below are retained as historical evidence only.
- No production DB/Auth/RLS/GRANT/Edge/payment/finance changes were made by the visual parity slice. PR #650's website deployment was scoped to the merged catalog frontend.
- Next: finish exact-head checks; visually inspect desktop/mobile behavior; then continue Wave A across the directory and top navigation before owner-dashboard functional additions.


## Medical Directory parity checkpoint — implemented on convergence branch

- The AI Studio archive includes a dedicated `MedicalDirectoryView.tsx`. It is now ported as public route `?view=medical_directory`, with Navbar and Site Map entries.
- The screen is mounted on current `main` and reads only the existing `directoryBusinesses` public feed and current canonical `medical_health` taxonomy. It does not introduce a second medical data store.
- Filters: medical activity type, taxonomy specialty, governorate, markaz and village. Results are verified-first and show the actual verified/unverified state.
- Pagination starts at 20 and appends 20 on explicit request. Optional distance sorting starts only after a visitor clicks for GPS; coordinates remain in component memory and are not persisted or sent to the server.
- Opening a medical activity uses the existing public catalog API. WhatsApp appears only for a published valid phone.
- The archive's automatic medical registration code was excluded because it creates a fabricated record with assumed phone, location, paid status and verification status.

## Member Messages — NOT IMPLEMENTED / BACKEND BLOCKER

- The AI Studio `MemberMessagesView` depends on local AppContext state. Current website source contains no verified `member_direct_messages`, `sendMemberDirectMessage`, `replyToMemberDirectMessage` or `openMemberMessagingForTarget` contract.
- It must not be ported as a fake shared inbox. A real feature requires durable server APIs/tables, recipient and tenant privacy, membership-scoped authorization, audit trail, notification delivery and end-to-end verification.


## 2026-11-03 — Wave A continuation: navigation and directory search presentation

- **Branch:** `feat/aistudio-v4-wave-a-shell-directory-20261103`, based on `main` at `36a98b5153b2c911cf59ea7aaa8f7fd8c9469724`.
- **Navigation:** restyled the global shell toward the V4 hierarchy (dark micro-header, clearer brand/context row, rounded high-contrast navigation pills). Added an accessible Arabic nav name and stable test hook. All current routes and role/membership guards remain in place, including the owner, professional, account portal and Super Admin entries.
- **Directory search:** upgraded the search workspace with a clear section heading, accessible labelled search field, clearer geographic action hierarchy and more consistent filter styling. The existing four geographic selectors and the current query state are preserved.
- **Data/behavior boundary:** no new API, database field, storage behavior, activity data, listing status, verification rule, pagination behavior or geographic-consent behavior was changed. Results still come from the existing public data sources and preserve the current verified-first/20-row flow.
- **Regression coverage:** expanded the existing browser journey to assert the primary navigation label/test hook, the directory search field, all four geographic filters, reload restoration, and no horizontal overflow at 390px, 768px and 1440px.
- **Current code/test head:** `5452ef877eb3a3491741222af2565146e6cc65d3`. Exact-head validation is pending; no merge or deployment is claimed.
- **Production:** no data/schema/Auth/RLS/GRANT/Edge/payment/finance change or production deployment.
- **Next:** fix any exact-head build/browser/accessibility failure, inspect the deployed-reference appearance at phone/tablet/desktop sizes, then continue the V4 owner dashboard presentation wave without removing website-only CSV import, employee/branch management, Facebook import, QR, Super Admin permission controls or existing secure data contracts.


## 2026-11-03 — Wave A validation and V4 token foundation

- Exact-head validation passed for f658c66e007301839763c7c5784e9a93128356ff: primary catalog build/TypeScript/contracts, browser Playwright, and isolated PostgreSQL employee RBAC all completed successfully (workflow run 41570424483).
- The branch remains isolated in Draft PR #662; successful CI is not a merge or production deployment.
- Continued the presentation foundation by adding the V4 blue palette, typography, radius and shadow tokens to src/index.css. Tokens are opt-in and do not globally recolor legacy modules.
- Applied the centralized blue-gradient active state to all seven owner-dashboard tabs, preserving the three primary V4 tabs and all website-only tools. Added browser assertions for the active QR tab's computed gradient.
- Current token changes require a new exact-head validation before review/merge. No backend, data, role, authorization or production setting changed.
- Next safe scope: apply the token system screen-by-screen to storefront and public discovery surfaces, comparing against the supplied V4 archive where available. Finance and custom links remain blocked pending verified persisted API contracts.


## 2026-11-03 — Wave A storefront presentation and trust-state continuation

- **Storefront hero:** added a stable browser hook and Arabic accessible label to the full-width cover region; kept the existing 16:9 mobile / wide desktop cover proportions, owner-supplied images, neutral fallback and permanent storefront behavior.
- **Trust-state correction:** the logo indicator now distinguishes verified, unverified and frozen activities. The cover badge explicitly labels an unverified activity as `نشاط غير موثّق`; it no longer presents the generic green check for every non-frozen business. External logo/cover links remain visible only for verified businesses with explicit configured URLs.
- **Motion/accessibility:** cover auto-rotation now respects `prefers-reduced-motion` and runs at a calmer 5-second interval otherwise. Slide controls expose button type and pressed state. The share action now handles clipboard failure and announces success/failure to assistive technology.
- **Regression coverage:** browser E2E now checks the verified and unverified storefront trust states, the labelled cover hero, and no horizontal overflow at 390/768/1440px.
- **Data boundary:** no business profile, verification flag, logo/cover URL, product, or public directory record was changed. This is presentation and accessibility only; no schema/API/Auth/RLS/finance changes.
- **Validation:** exact-head CI for this follow-up is pending. The previous Wave A code head passed all three validation jobs (build/typecheck, Playwright browser E2E, and isolated PostgreSQL employee RBAC). Do not merge until the new exact head passes.
