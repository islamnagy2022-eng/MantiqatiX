# MantiqatiX — UI/module inventory and first-pass gap register

**Snapshot date:** 2026-10-20  
**Source baseline inspected:** `main` at `149a85c7e5c44b61421edc8391cbb82885902fae`  
**Working branch for this UI-first effort:** `feat/ui-first-module-completion-20261020`

## Evidence rules

This is a source-level inventory, not a claim that routes work in a browser or that backend dependencies are deployed. A module is only marked **source found** when its current source registration was inspected. All user journeys, accessibility, responsive behavior, auth, role boundaries, and production runtime remain **NOT VERIFIED** until tested. Never infer a working page from a module card or a tab label.

## Shared web/PWA entrypoints observed

| Path | Purpose inferred from filename/source | First-pass state |
|---|---|---|
| `web/index.html` | Main web application entrypoint | Source found; browser journey not verified |
| `web/app.js` | Main app, auth, workspace, global search, dashboards | Source found; broad UI/E2E audit open |
| `web/home.js` | Public landing page, discovery, sponsored row, add-activity request, MantiGO public routes | Source found; search and request flows require browser tests |
| `web/home.css`, `web/home-mobile-fixes.css`, `web/styles.css`, `web/brand.css` | Shared/home visual system | Responsive/accessibility audit open |
| `web/sector-registry.js`, `web/sector-modules.js` | Canonical sectors and sector workspace support | Source found; route parity audit open |
| `web/module-blueprints.js` | Generic module blueprint cards/tabs | **Not a complete module page**; card action currently only shows a toast saying the section opened |
| `web/operations-modules.js` | Operational module UI/workspaces | Source found; every module/action needs per-contract verification |
| `web/rbac.js` | Client-side role/permission visibility defaults | Source found; server-side authorization remains authoritative |
| `web/provider-onboarding-module.js` | Provider onboarding UI | Source found; complete E2E not verified |
| `web/restaurant-module.js` | Restaurant-specific UI | Source found; full lifecycle not verified |
| `web/reverse-bidding-module.js` | Reverse bidding/offer UI | Source found; lifecycle and role boundaries not verified |
| `web/digital-page.html`, `web/digital-page.js`, `web/digital-page.css` | Public digital page | Source found; publishing and permission E2E not verified |
| `web/digital-page-editor.html`, `web/digital-page-editor.js`, `web/digital-page-editor.css` | Digital page editor | Source found; save/publish behavior requires test |
| `web/smm.html`, `web/smm.js`, `web/smm.css` | SMM storefront/workspace | Exists in source; paid SMM execution stays deferred pre-launch |
| `web/config.js`, `web/sw.js`, `web/location-adapter.js`, `web/android-parity-catalog.js` | Runtime config, PWA cache, location, parity support | Version/cache/deployment and permission tests open |

## Top-level workspace modules found in `web/app.js`

The main workspace currently declares these entries. Presence in this list does not mean the entry has a complete dedicated page or working CRUD flow.

| # | Module | First-pass scope |
|---:|---|---|
| 1 | التحكم الكامل | Platform/operational controls; verify platform-only boundary |
| 2 | الرئيسية | Role-aware dashboard |
| 3 | الموديولات | Module center and feature visibility |
| 4 | المجالات والخدمات | Sector/service discovery and provider catalog |
| 5 | التجارة والأزياء | Fashion catalog/orders |
| 6 | البقالة والسوبر ماركت | Catalog, pricing, stock and orders |
| 7 | المطاعم والمطابخ | Menu, modifiers, orders, tables and kitchen |
| 8 | المنظومة الطبية | Provider discovery and medical appointments |
| 9 | الصيانة | Maintenance requests/providers |
| 10 | الخدمات المهنية | Professional services |
| 11 | MantiGO والمزايدات | Ride/order/offer lifecycle |
| 12 | الزواج | Profiles, requests and privacy controls |
| 13 | الوظائف | Jobs and applications |
| 14 | التعليم | Schools, teachers and requests |
| 15 | المستعمل | Listings and negotiation |
| 16 | التسويق والإعلان | Marketing workspace, leads and campaigns |
| 17 | خدمات التسويق الرقمي SMM | SMM storefront; paid execution deferred |
| 18 | المستخدمون وCRM | Users, providers, leads and follow-up |
| 19 | الطلبات والعمليات | Order/booking lifecycle |
| 20 | العمولات والباقات | Existing finance/plan entry; expanded plans/accounts UI deferred |
| 21 | التقارير والتحليلات | Reporting/analytics |
| 22 | الدعم والحوكمة | Tickets, audit and governance |
| 23 | طلبات التسجيل | Registration request review |
| 24 | الإعدادات | Account/platform preferences |

## Domain-module registry found

The source currently registers domain workspaces for `FASHION`, `GROCERY`, `ACCOUNTING`, `COMPANIES`, `MARKETING`, `FACTORIES`, `TRIPS`, `MAINTENANCE`, `LEGAL`, `ERP`, `MATRIMONY`, `JOBS`, `MEDICAL`, `RESTAURANTS`, `EDUCATION`, and `USED_ITEMS`. The module plan source also includes generic tabs for catalog, pricing, stock, requests, offers, documents, agreements, suppliers, purchase orders, appointments, profiles, applications, and reports. These are inventory clues, not proof of dedicated screens or mutations.

## Verified source-level gaps / risks to address first

1. **Authentication UI:** `authView` in the inspected main baseline offers Google OAuth for login/registration. Email OTP, resend/expiry, recovery, and alternative methods must not be assumed implemented in this UI. Validate current product/auth contract before adding a method.
2. **Global search:** `GLOBAL_SEARCH_SOURCES` currently lists 10 source groups (businesses, providers, orders, services, catalog, leads, projects, support tickets, advertisements, jobs). It is role-filtered client-side and each source error is logged then converted to an empty result list. UI must distinguish “no results” from partial source failures, and source visibility must remain protected by server/RLS contracts.
3. **Generic module blueprints:** `web/module-blueprints.js` renders generic tabs/cards and its “open section” button currently displays a success toast without navigating to a real section. Do not count this as a working module flow; replace with real route/action wiring or truthful disabled state.
4. **Role management:** `web/rbac.js` provides client-side visibility defaults and `app.js` has an active-membership role/context switcher. This is not equivalent to a complete UI for assigning/revoking job functions/roles. A dedicated management flow must use existing server-side contracts and never rely on UI-only enforcement.
5. **Activity management:** public home provides an “add activity” request modal that stores a pending draft and routes through auth; this is not the same as a complete owner/admin activity lifecycle for create/edit/approve/suspend/close. Inventory the existing server contracts before extending it.
6. **Sponsored display:** public home calls `get_mnty_targeted_advertisements` for the home sponsored row. The display can be improved against this contract, but no billing, ad-budget charging, paid campaign execution, or external publication is authorized in this pre-launch scope.
7. **Accounting/subscriptions:** legacy module labels and tables exist. Do not expand paid subscription/accounting workflows in the UI-first phase; keep existing launch-critical order/cash/security behavior intact.
8. **Generic module cards:** do not add CRUD controls for a table just because a table name is listed. Verify each action against existing RPC/Edge Function/RLS and live deployment parity first.

## Route-by-route implementation matrix

Use this table as the durable checklist; add one row per real route/page or subview as discovery proceeds.

| Area | Current evidence | Next required work | Status |
|---|---|---|---|
| Public home/discovery | `web/home.js`, `web/index.html` | Search, filters, cards, sponsored slot, add-activity modal; mobile/a11y/browser E2E | PARTIAL / NOT VERIFIED |
| Login/registration/session | Google OAuth UI in `web/app.js`; session bootstrap and logout code present | OAuth callback, expiry, restore, logout, role onboarding, wrong-role/tenant tests | PARTIAL / NOT VERIFIED |
| Global search | 10 sources in `GLOBAL_SEARCH_SOURCES` | Failure-aware results, filters/pagination/deep links, query contract tests, source visibility review | PARTIAL / NOT VERIFIED |
| Sponsored placements | Home RPC-backed sponsored row | loading/empty/error states, sponsored label, safe click behavior, fallback and responsive checks | PARTIAL / NOT VERIFIED |
| Module center / blueprints | `domainModules`, `module-blueprints.js` | Inventory actual pages; remove fake success action; connect tabs to real subviews | IN PROGRESS |
| Sector workspaces | `sector-registry.js`, `sector-modules.js` | Canonical public/backend mapping and per-sector route/action parity | PARTIAL / NOT VERIFIED |
| Orders/operations | `orders`, `operations-modules.js`, specialized module files | List/detail/create/update/state transitions, duplicate/retry and role/tenant E2E | PARTIAL / NOT VERIFIED |
| CRM/support/marketing | workspace entries and source tables/RPCs | Leads/tickets/projects/participants flows and explicit source-failure UX | PARTIAL / NOT VERIFIED |
| ERP/inventory/purchasing | operational module definitions | Verify backend-only mutation gateway and actual migration availability before wiring actions | PARTIAL / NOT VERIFIED |
| Medical/restaurant/education/jobs/matrimony/used items | domain registry + specialized modules | Per-module route/action matrix and browser tests | PARTIAL / NOT VERIFIED |
| Activity management | public request modal + existing admin surfaces | Add/manage/approve/suspend/close using verified server contracts | TODO / NOT VERIFIED |
| Job-function/role management | RBAC defaults + membership switcher | Dedicated scoped assign/revoke UI + server authorization/audit tests | TODO / NOT VERIFIED |
| Subscription packages/accounts | legacy module exists | Defer expanded package/billing/account UI until post-launch | DEFERRED |
| Expanded accounting UI | legacy accounting module/data references | Defer new finance UI; preserve mandatory cash/order integrity | DEFERRED |
| SMM paid execution/electronic payments | source exists, launch gate is cash-only | Keep server-side gates closed; no real execution pre-launch | DEFERRED |

## Immediate next execution batch

1. Implement the first safe UI contract fix: generic blueprint controls must never report success when no real navigation occurred; replace them with real navigation or an honest unavailable state.
2. Add contract tests for that fix and for global-search partial failures without changing authorization.
3. Map each module route and action to the current backend contract before adding write controls.
4. Continue updating this matrix and the Master TODO after every implementation batch.

**Release:** BLOCKED / NOT CERTIFIED. This inventory is not a release approval.
