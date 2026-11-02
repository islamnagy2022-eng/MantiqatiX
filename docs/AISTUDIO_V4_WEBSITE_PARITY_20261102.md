# Google AI Studio v4 → Website Parity Map

**Date:** 2026-11-02  
**Reference archive:** `bizcatalog-manager (4).zip`  
**Archive SHA-256:** `e49e202716c38c5564b8a82db9a74b4fe2c93ebbdecb4a347a7a110b799d6df2`  
**Website baseline:** `main` at `e408f8137b6e6e62ab50f8629a17af59cf6c38e2`  
**Working branch:** `feat/aistudio-v4-website-convergence-20261102`  
**Status:** Initial source comparison complete; first visual parity slice is in Draft PR #650; exact-head CI and browser checks are running. No production deployment or data mutation.

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
| Directory / `DirectoryView.tsx` | Business/activity discovery, search, categories, business hero and product preview | Unified Egypt directory, activity → specialty navigation, verified-first ranking, geo consent/manual filters, published unclaimed listings, server keyset pagination and 20-item progressive loading | Preserve the current authoritative directory/query model; adapt v4 layout without introducing seed businesses. |
| Medical directory / `MedicalDirectoryView.tsx` | Dedicated doctors, pharmacies, labs and clinics search | Healthcare is already represented in the unified activity directory and specialty navigation; no separate medical route is mounted in current `App.tsx` | Reconcile the medical page's useful filters and presentation into the unified healthcare activity route; avoid a parallel medical data source. |
| Business storefront / `BusinessProfileHeader.tsx` + `CatalogSection.tsx` | Wide cover, prominent logo, trust badges, contact/location, product/service catalog filters | Current dedicated direct-link storefront with verified/operational visibility guards, owner cover/logo, contact and social links, QR/share, product/service filters and cart | Match the reference's full-width hero/profile composition; keep current direct-link privacy and operational-state rules. |
| Cart / `CartDrawer.tsx` | Quantity controls and merchant-directed checkout | Current website has a cart and guarded catalog/order flow | Match visual details only; preserve current order/checkout contract. |
| Owner dashboard / `MerchantDashboard.tsx` | Product catalogue, cover/logo, activity profile/location, sector engine, finance, QR and custom links | Current tabs: products, CSV import, branding, profile/location, activity profile, permanent QR and employees | Bring v4 layout and add real-source finance/custom-link sections after contract check. Preserve website-only CSV import and employee manager. |
| Enterprise dashboard / `UnifiedEnterpriseDashboard.tsx` | Merchant products/finance/branding/employees/QR; admin businesses, subscription requests, inbox, ads, personal sites, billing, AI Studio | Current main uses separate role-gated merchant, professional and admin dashboards | Map each v4 operation to an existing canonical module or record an uncovered workflow; do not merge a second dashboard/data model. |
| Admin dashboard / `AdminDashboard.tsx` | Businesses/subscribers, billing, commissions, taxonomy, verification, backup/restore, AI Studio development | Current admin tabs include billing, commissions, taxonomy, businesses, subscribers, published directory listings, activity modules, settings, backup and Super Admin Control Center | Reuse visual patterns and workflow labels; current server-authorized actions and release guards take precedence. |
| Super Admin / `SuperAdminControlCenter` concept | People, roles, permissions, subscriptions and global controls | Website has `SuperAdminControlCenter.tsx` with custom roles, role assignments, module/action permission matrix, employees, audit and server RPC calls | Preserve and place within the v4 admin visual hierarchy; do not replace with the older local state implementation. |
| Login / profile | Google login modal and user profile modal | Current Google Auth/session bootstrap, login modal, active-membership resolver and role guards | Preserve real Google Auth and active membership checks. Profile/portal gaps are tracked separately. |
| Subscription request / ad request | Business subscription and ad-request forms | Existing website subscription/registration flow; no current parity confirmation for all v4 ad-request UI | Inspect form contracts and add only through existing server-side request paths. |
| Contact / messages / sitemap | `ContactUsView`, `MemberMessagesView`, `SiteMapView` | These dedicated routes/components are not mounted in current `App.tsx` | Candidate reference-only pages to restore using authenticated/persisted contracts; must not use local-only message storage. |
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
- Reference-specific medical directory screen (its domain is present in the unified directory; its separate page is not mounted).
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

- **PR #647 — Premium Marketplace Home + separate search**: adds an extra homepage containing real verified business cards, real catalog products/offers, targeted ad slots via the current RPC, and a separate full directory search view. The component explicitly filters to live active public businesses and then to verified businesses for its current recommendations. Its exact-head build, browser E2E, employee RBAC PostgreSQL, and supporting contracts passed on head `576a47f8e261b722328c50d70155f66b41ddb11b`; it remains open/unmerged and has not been deployed. It needs owner review as an additional home experience, plus a UX check of its first-visit geo prompt against the existing DirectoryView consent/filter flow.
- **PR #648 — Canonical taxonomy + mobile 8-column regression**: adds a test proving canonical activity codes override conflicting legacy category labels and that activity cards remain eight columns at the mobile viewport. This is a quality/safety guard, not a new user-facing module. Keep the regression coverage in the V4 branch/target.
- **PR #646 — Subscriber account portal**: adds an authenticated account/subscribe overview. It is still Draft and must not be merged as-is: its current Navbar diff removes existing merchant dashboard, professional dashboard and Super Admin navigation actions. Only the account portal itself is a candidate; if brought into V4, it must retain every existing dashboard entry and keep cross-membership switching disabled until server/backend parity is verified.

None of these open PRs is part of current `main` or the deployed website at this checkpoint. They are tracked as pending work, not reported as shipped. No PR is merged by this parity task.

## Visual implementation checkpoint

- Storefront cover is full-width with desktop reference ratio `1440/390`. Its permanent dark gradient is currently deferred because current website's validated UX contract requires the image to remain bright by default and darken only on hover/keyboard focus. This conflict is surfaced for owner decision.
- Merchant dashboard hero uses the reference navy gradient and carries the matching owner-dashboard title, plus working actions for previewing the current business storefront and opening the existing add-item modal.
- The buttons call existing application functions; no new database or persistence logic was introduced.
- Exact-head build/RBAC/Pages validation is still required for the latest branch head.


## Owner decision required — storefront cover overlay conflict

- AI Studio v4 screenshot uses a persistent dark gradient overlay over the activity cover.
- Current website validator `scripts/validate-business-social-links.mjs` explicitly requires a bright default cover that darkens only on hover or keyboard focus.
- To avoid silently removing an established website behavior, the permanent overlay was reverted on the parity branch. Full-width/wide cover sizing remains.
- **Pending owner choice:** keep current bright default with hover/focus darkening, or supersede it with the always-darkened cover from AI Studio v4. No further change to this behavior until the decision is recorded.

## Exact-head validation result — PR #650 head `4e4b25fdecd02bf18f8587d014c01ed1f601ec34`

- [x] 20/20 non-skipped check runs passed, zero failures: primary catalog build, owner dashboard Playwright E2E, employee RBAC PostgreSQL, Pages source validation, TypeScript/build/security contract, and supporting finance/privacy/atomicity checks.
- [x] The initial overlay assertion failure was resolved by restoring the current bright-by-default/hover-focus darkening contract; it is now a documented owner decision conflict rather than a silent behavior change.
- [x] Both Pages deployment-related jobs were skipped for the PR event by design. No website production deployment occurred.
- [ ] Independent review, owner decision on the cover overlay and the website-only candidate features, then approved merge/deployment remain open.
- [ ] The new documentation checkpoint after this result will trigger fresh CI; do not transfer the above PASS to any later head until rechecked.

## Current execution checkpoint

- Archive integrity and file inventory were inspected.
- Current main and open pull requests were inspected.
- This mapping is an initial source-level comparison; every individual action still requires line-level contract review.
- Implemented on the isolated branch and opened Draft PR [#650](https://github.com/islamnagy2022-eng/MantiqatiX/pull/650): full-width storefront cover, persistent dark image overlay, dark owner-dashboard hero, and owner preview/add-item actions. The actions reuse existing storefront routing and add-item modal; no database logic changed.
- Latest source head is `824aa33048667c2aa073a3f1e99e4ba9dc2f8b95`. Exact-head CI has restarted after the UI changes; build, RBAC PostgreSQL, browser E2E and supporting workflows are pending/in progress. Earlier source head `5e85ac34626401e0becf03fa0055cba86a2b056e` had Build PASS, employee RBAC PostgreSQL PASS and Pages validation PASS; browser E2E was still running when superseded.
- No production DB/Auth/RLS/GRANT/Edge/payment/finance changes and no production deployment occurred.
- Next: finish exact-head checks; visually inspect desktop/mobile behavior; then continue Wave A across the directory and top navigation before owner-dashboard functional additions.
