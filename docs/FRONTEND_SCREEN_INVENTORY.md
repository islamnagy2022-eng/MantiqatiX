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
