# MantiqatiX — Frontend Screen Inventory & Completion Register

**Branch:** `feat/marketing-campaign-operations-summary-20261019`  
**Checkpoint:** 2026-10-19  
**Evidence scope:** source inspection of `web/index.html`, `web/app.js`, `web/module-blueprints.js`, `web/operations-modules.js`, `web/sector-modules.js`, and `web/restaurant-module.js`.  
**Important:** this is a source-derived inventory, not a browser/runtime audit. A navigation entry or generic blueprint is not proof that a complete functional screen exists.

## Status definitions

- **ENTRY FOUND** — a navigation/module registry entry exists in source.
- **PARTIAL — SCREEN AUDIT REQUIRED** — a route/workspace or generic section renderer exists, but every child screen and action has not been proven complete.
- **BLOCKED BY DEPENDENCY** — source references a backend/API/schema or authorization contract whose availability must be confirmed before claiming end-to-end functionality.
- **NOT VERIFIED** — source presence alone cannot prove runtime, responsive, accessibility, or live-data behavior.
- **NOT APPLICABLE** — use only when the product scope confirms the screen is not relevant.

## Shared application shell

| Area | Source evidence | Initial status | Remaining frontend work |
|---|---|---|---|
| Public landing / service discovery | `web/index.html`, `web/home.js`, `web/home.css` | PARTIAL — SCREEN AUDIT REQUIRED | Verify all search, discovery, category, provider-card, login, install, error and offline states. |
| Authentication and account entry | `web/app.js`, auth boot in `web/index.html` | PARTIAL — SCREEN AUDIT REQUIRED | Inventory login/OTP/registration/verification/session-expiry/error states and account/workspace switching. |
| Privileged workspace and navigation | `modules`, `selectModule`, shared render flow in `web/app.js` | ENTRY FOUND / NOT VERIFIED | Map every role-visible route, breadcrumbs/back behavior, refresh/deep-link behavior and permission-denied states. |
| Shared module blueprints | `web/module-blueprints.js` | PARTIAL — SCREEN AUDIT REQUIRED | Generic sub-sections exist; each needs explicit real behavior and accurate unavailable states. |
| PWA shell and offline fallback | `web/sw.js`, `web/index.html` | NOT VERIFIED | Confirm asset cache parity, update lifecycle, offline fallback and stale-cache recovery during authorized verification. |

## Primary navigation modules

The following entries are present in the `modules` array in `web/app.js`. This confirms navigation labels only, not full screen completion.

| Module | Source status | Required screen inventory |
|---|---|---|
| التحكم الكامل | ENTRY FOUND / NOT VERIFIED | Activities, branches, services, prices, provider approval, detail/edit/create and access-denied states. |
| الرئيسية | ENTRY FOUND / NOT VERIFIED | Role-specific dashboard, summary cards, empty/error/loading states and drill-down. |
| الموديولات | ENTRY FOUND / NOT VERIFIED | Module catalog, availability/permission states and route to each workspace. |
| المجالات والخدمات | ENTRY FOUND / NOT VERIFIED | Sector directory, provider/service discovery, search/filter/detail and no-results states. |
| التجارة والأزياء | ENTRY FOUND / NOT VERIFIED | Catalog, product detail/options, cart, order creation/history and inventory states. |
| البقالة والسوبر ماركت | ENTRY FOUND / NOT VERIFIED | Catalog, prices/offers, inventory, cart/delivery, order lifecycle and reports. |
| المطاعم والمطابخ | ENTRY FOUND / NOT VERIFIED | Menu/modifiers, orders, tables, kitchen, inventory and reporting states. |
| المنظومة الطبية | ENTRY FOUND / NOT VERIFIED | Provider/specialty discovery, booking, appointments, referral and empty/error states. |
| الصيانة | ENTRY FOUND / NOT VERIFIED | Request intake, provider/bid selection, scheduling, support and status history. |
| الخدمات المهنية | ENTRY FOUND / NOT VERIFIED | Professional service catalog, provider profile, request, offers and project states. |
| MantiGO والمزايدات | ENTRY FOUND / NOT VERIFIED | Ride/request creation, offers/bids, selection, active execution, history and privacy states. |
| الزواج | ENTRY FOUND / NOT VERIFIED | Profile, search/matching, requests, contact unlock, consent/privacy and reports. |
| الوظائف | ENTRY FOUND / NOT VERIFIED | Job list/detail, application, candidates, interviews and employer workspace. |
| التعليم | ENTRY FOUND / NOT VERIFIED | Schools/teachers/courses, education requests, booking and tracking. |
| المستعمل | ENTRY FOUND / NOT VERIFIED | Listings, filters, detail, offers, negotiation, messaging and moderation states. |
| التسويق والإعلان | ENTRY FOUND / NOT VERIFIED | Leads, provider directory, projects, ads, campaigns, partners, filters, exports and reporting. |
| خدمات التسويق الرقمي SMM | ENTRY FOUND / BLOCKED BY DEPENDENCY | Service catalog, provider/order states, wallet/limits, status/reconciliation; preserve deferred launch. |
| المستخدمون وCRM | ENTRY FOUND / NOT VERIFIED | Customers/providers, timeline, follow-up, retention, search and permission-gated actions. |
| الطلبات والعمليات | ENTRY FOUND / NOT VERIFIED | Lists, detail, state transitions, assignments, booking and operational history. |
| العمولات والباقات | ENTRY FOUND / NOT VERIFIED | Plans, subscriptions, commission rules, statements and explicit unavailable/permission states. |
| التقارير والتحليلات | ENTRY FOUND / NOT VERIFIED | Filters, date range, KPI provenance, tables/charts, drill-down and export states. |
| الدعم والحوكمة | ENTRY FOUND / NOT VERIFIED | Tickets, audit views, role/access controls, monitoring and failure states. |
| طلبات التسجيل | ENTRY FOUND / NOT VERIFIED | Application list/detail, review states, required documents and audited decision UX. |
| الإعدادات | ENTRY FOUND / NOT VERIFIED | Account, platform, notification, privacy, preferences and save/error states. |

## Domain workspace registry

The `domainModules` registry and `web/module-blueprints.js` describe these domain workspaces. Their section labels are a planning aid and must not be interpreted as complete CRUD screens.

| Domain key | Sections listed in source | Initial status |
|---|---|---|
| FASHION | Catalog/products, sizes/options, cart/orders, inventory, pricing/offers, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| GROCERY | Catalog, prices/offers, inventory/warehouses, cart/delivery, orders, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| ACCOUNTING | Chart of accounts, accounting requests, offers/negotiation, journal entries, settlements, finance reports | BLOCKED BY DEPENDENCY / NOT VERIFIED |
| COMPANIES | Company profile, services, business requests, suppliers, contracts, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| MARKETING | Marketing services, leads, projects, campaigns, partner agencies, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| FACTORIES | Factories, supply requests, warehouses, purchasing, transfers, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| TRIPS | Trips, bids, offer selection, execution, drivers, ratings/reports | PARTIAL — SCREEN AUDIT REQUIRED |
| MAINTENANCE | Maintenance requests, bids, providers, scheduling, spare parts, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| LEGAL | Legal services, customer requests, documents, agreements, appointments | PARTIAL — SCREEN AUDIT REQUIRED |
| ERP | Purchase orders, receipts, warehouses, transfers, suppliers, reports | BLOCKED BY DEPENDENCY / NOT VERIFIED |
| MATRIMONY | Profiles, search/matching, requests, contact unlock, privacy/reports | PARTIAL — SCREEN AUDIT REQUIRED |
| JOBS | Jobs, applications, candidates, interviews, employers, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| MEDICAL | Doctors/clinics, specialties/services, booking, appointments, referrals, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| RESTAURANTS | Menu, modifiers, orders, tables, kitchen, inventory/reports | PARTIAL — SCREEN AUDIT REQUIRED |
| EDUCATION | Schools, teachers, courses, education requests, bookings, reports | PARTIAL — SCREEN AUDIT REQUIRED |
| USED_ITEMS | Listings, search/filter, offers, negotiation, messages, reports | PARTIAL — SCREEN AUDIT REQUIRED |

## First frontend implementation batch — 2026-10-19

- Updated the generic module blueprint interaction so selecting a tab or “فتح القسم” changes the active section and reveals a section context panel rather than only showing a success toast.
- The context panel reports only the current module key and observed source count/status; it does not fabricate records or claim that backend actions are complete.
- Refreshed the blueprint script URL and service-worker shell cache key to `mnty-web-v131`.
- Implementation status: **SOURCE UPDATED / NOT VERIFIED**. No browser execution, automated test, build, or CI was run in this batch.
- Next: continue the source-level screen-by-screen audit, starting with shared workspace routing and dashboard, then complete the first module's child screens and interactions before moving to its backend.


## Shared global search — frontend state correction (2026-10-19)

- The global search renderer now distinguishes a genuinely empty result set from failed data sources.
- When all permitted search sources fail, the UI shows an unavailable state and a retry action rather than claiming there are no results. Partial source failures are disclosed even when some results are available.
- This is a frontend state-handling improvement; it does not change search permissions, data sources, or backend contracts.
- Status: SOURCE UPDATED / NOT VERIFIED; no test, browser, build or CI was run.


## Generic fallback workspaces — status honesty and section selection (2026-10-19)

- Replaced the generic fallback's misleading “الواجهة مكتملة / UI READY” claims with an explicit partial/unverified status.
- Added a “عرض نطاق القسم” action that changes the workspace panel to show the selected section's source-provided scope and its remaining acceptance requirements. It does not pretend to execute a backend action.
- This makes incomplete fallback work visible and interactive, but does not close those module screens. The specific screen-by-screen implementation remains TODO.
- Source updated only; tests/browser/build/CI were not run.


## Dashboard quick access — keyboard and empty-state handling (2026-10-19)

- Converted quick-access module cards from clickable `article` elements to semantic `button` elements, wired through a dedicated binder, with accessible labels and visible keyboard focus styling.
- Added an explicit empty state when the current module filter produces no quick-access cards. This is a UI state only and does not fabricate available modules or data.
- Responsive/browser behavior remains NOT VERIFIED; no tests, browser, build, or CI were run.


## Module catalog — keyboard-accessible navigation (2026-10-19)

- Converted module catalog tiles in `modulePage()` to semantic buttons, reusing the dashboard quick-access event binder and adding accessible names.
- Existing module visibility and RBAC checks in `selectModule` remain the enforcement path; the UI is not treated as a security boundary.
- Source-only; no browser/test/build/CI was run. Runtime and accessibility remain NOT VERIFIED.


## Role-specific dashboard navigation — 2026-10-19

- Converted quick-access module tiles in the customer dashboard, provider dashboard, and role-scoped workspace dashboard from click-only `article` elements to semantic `button` elements.
- Both surfaces now use the shared `data-dashboard-module` binder and escaped accessible names. Existing module visibility/RBAC filtering and `selectModule` enforcement remain unchanged.
- Updated the app asset version and service-worker shell cache to `mnty-web-v137` so clients do not intentionally reuse the previous cached script.
- Status: SOURCE UPDATED / NOT VERIFIED. No browser, tests, build, CI, review, or deployment was run. Role-specific dashboards remain PARTIAL until interaction, responsive, and accessibility behavior is verified.


## Shared role binder source correction — 2026-10-19

- Source inspection found a stray standalone `async` token separated by a newline from `function bindRoleAfterRender`. Removed the token while preserving the synchronous binder body; this avoids evaluating an unintended identifier before the declaration.
- Refreshed app asset key to `role-dashboard-binder-fix-20261019` and shell cache to `mnty-web-v138`.
- This is a source-level correction only. No JavaScript parser, browser, automated test, build, or CI was run; syntax/runtime must still be verified when permitted.


## Notification unread-list consistency — 2026-10-19

- The notifications workspace now selects up to 12 unread notifications from the complete locally loaded notification list, independently of the separate 12 most-recent notification list. Previously, an older unread notification could be omitted from the unread panel whenever it fell outside the most-recent 12, even though the unread KPI counted it.
- Refreshed app asset version to `notifications-unread-list-20261019` and PWA cache to `mnty-web-v139`.
- Source-only correction; no tests, browser, build, or CI were run. Data completeness still depends on the rows loaded from the backend; this does not guarantee that all historical notifications are fetched.


## Notification batch action and CSV export hardening — 2026-10-19

- Added a manager-independent, per-notification backend-RPC batch action to mark the newest 12 loaded unread notifications as read. It processes records sequentially, prevents concurrent clicks in the same page, reports partial failures accurately, and refreshes the view after the attempt.
- The UI labels the operation as limited to the newest 12 loaded unread records; it does not imply that all historical unread notifications were fetched or processed.
- Hardened both campaign and partnership CSV exporters against formula-like cells preceded by whitespace/control characters, in addition to the direct formula prefixes already guarded.
- Refreshed `web/index.html` asset key to `notification-batch-csv-guard-20261019`; service-worker shell cache is `mnty-web-v140`.
- Status: SOURCE UPDATED / NOT VERIFIED. No JavaScript parser, browser, tests, build, CI, review, merge, or deployment was run. Backend behavior and CSV behavior require tests before release.


## Marketing filter empty states — 2026-10-19

- Added explicit, initially hidden no-match states for campaign and partner search/status filters. They appear only when records exist but the current filters hide every card; the original empty-dataset state remains authoritative when no cards are loaded.
- Both filter counts remain `aria-live="polite"`; the empty state is toggled with the same filtering pass so search and status controls stay synchronized.
- Asset key is now `marketing-filter-empty-state-20261019`; PWA shell cache is `mnty-web-v141`.
- Source-only change. Browser behavior, keyboard/screen-reader announcements, and responsive layout remain NOT VERIFIED.


## CI-driven correction — provider dashboard handler escaping — 2026-10-19

- GitHub Actions exposed a JavaScript parse failure in `providerDashboard()` at the two hero buttons: nested single-quote escaping produced an invalid source string. Corrected the two handlers while retaining their existing navigation behavior and semantic dashboard module buttons.
- Updated `web/index.html` asset key to `provider-dashboard-syntax-fix-20261019` and service-worker cache to `mnty-web-v142`.
- The campaign backend source-contract workflow also exposed an overly narrow regex window for the valid `REMOVED` idempotent JSON response; widened the assertion window to cover the actual response object without changing the SQL migration.
- The source fixes have been pushed to the PR branch. Their CI re-run must pass before merge; no production deployment is authorized by this correction.


## CI cache-contract follow-up — 2026-10-19

- The PWA cache rotation exposed stale validator assumptions in the sector-rendering and marketing UI contracts. Validators now check the current versioned asset references instead of fixed historical versions.
- The source checks have been updated; fresh CI on the latest PR head remains the evidence gate. This is not a production certification.


## Related CI correction — 2026-10-19

- SMM service-role validation exposed a source-test mismatch rather than a gateway size-limit defect: the reusable parser defaults to 64 KiB and the gateway passes a 32 KiB override. The validator now checks both facts independently. Fresh workflow evidence remains required; no release certification is implied.

## Backend integrity follow-up — RC454 allocation guard (2026-10-19)

- During cross-layer review of the marketing workspace backend, identified and corrected a migration trigger event gap: participant `status` updates were not included in the allocation guard trigger's update column list.
- The trigger now runs for status-only transitions, and the marketing backend source contract asserts the trigger event includes `status`.
- This is a backend correctness fix noted here for cross-layer traceability; no frontend behavior or production database was changed. Fresh CI and disposable PostgreSQL behavioral verification remain required.


## Related backend correction — RC454 allocation status changes

- The allocation integrity trigger now covers participant `status` updates as well as allocation/scope fields. This prevents reactivation from bypassing the aggregate allocation check.
- Source-level fix only; fresh CI/PostgreSQL evidence remains required. This does not establish frontend runtime completion.

## Backend release-gate traceability — RC454–RC456 (2026-10-19)

- Review found the marketing PostgreSQL workflow was applying RC453 only while source assertions inspected RC454–RC456.
- The workflow now applies all four migrations in chronological order and runs terminal-campaign/partner-closure lifecycle assertions, including audit, notification, and idempotent replay behavior.
- RC454's allocation guard trigger includes `status`, so entering/leaving active assignment states is guarded.
- This is backend test coverage, not a frontend runtime certification. Fresh exact-head CI is required; production remains **BLOCKED / NOT CERTIFIED**.

- Follow-up: corrected the separate `pull_request` path filter as well as the `push` filter, and added source validation to prevent these backend migration tests from being silently skipped on PRs.


## Backend concurrency gate traceability — RC454 (2026-10-19)

- Added a CI-only PostgreSQL race test for two concurrent 60% active partner allocations on one campaign.
- The test asserts campaign-lock serialization, the expected allocation-limit rejection, and persisted aggregate integrity after both transactions finish.
- This strengthens backend regression evidence only; it does not establish browser/runtime completion. Exact-head CI remains required, and production remains **BLOCKED / NOT CERTIFIED**.


## Campaign partner allocation precheck — 2026-10-19

- Corrected the client-side invitation precheck to count only `INVITED`, `ACCEPTED`, and `ACTIVE` assignments, matching the RC454 server-side aggregate guard and avoiding false over-allocation warnings from completed assignments.
- Added a source validator assertion and refreshed the app/PWA asset versions.
- Source updated; browser/runtime verification remains NOT VERIFIED. Production remains **BLOCKED / NOT CERTIFIED**.


## Marketing invitation eligibility and CSV safety — 2026-10-19

- Partner invite choices and submit-time checks now match the backend's eligible campaign states: `DRAFT`, `PLANNED`, and `IN_REVIEW`.
- CSV formula-prefix guards now include a leading BOM as well as existing leading control/space characters.
- Source-contract assertions and PWA asset/cache versions were updated. Browser/runtime behavior remains NOT VERIFIED; production remains **BLOCKED / NOT CERTIFIED**.


## Validator follow-up — 2026-10-19

- Aligned the CSV source assertion with the BOM-aware guard and strengthened the RC454 concurrency contract's distinct-provider checks.
- These are test-contract changes only; browser runtime remains NOT VERIFIED and production remains **BLOCKED / NOT CERTIFIED**.
