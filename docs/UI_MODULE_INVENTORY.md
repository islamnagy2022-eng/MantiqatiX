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
3. **Generic module blueprints:** `web/module-blueprints.js` renders generic tabs/cards and its section button currently toggles an accessible status message explaining that no standalone workflow is wired. Do not count this as a working module flow; replace with real route/action wiring or truthful disabled state.
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

## Latest implementation checkpoint

- [x] Generic blueprint controls disclose when a section is only a blueprint and not connected to a standalone workflow; no fake success is shown.
- [x] Global search distinguishes true zero-results from partial/all-source query failures while preserving role-based source filtering.
- [x] Source-contract validators for both behaviors are wired into Pages CI.
- [ ] Exact-head CI and browser E2E remain pending; this is not production/runtime verification.
- [ ] Next: map every module route/action to verified backend contracts, implement real module pages, and then build scoped activity and job-function/role management.

**Release:** BLOCKED / NOT CERTIFIED. This inventory is not a release approval.


## Verification guard

The blueprint status and global-search failure-state behavior are implemented in source and have source-contract validators wired into the Pages workflow. They are not runtime-verified until the exact-head workflow passes and browser smoke tests confirm the behavior. Do not describe the full module set as complete; each module needs a route/action contract and role-scoped tests.


## Module-page completion status — source inventory snapshot (2026-10-20)

**Counting rule:** no domain module is marked complete/verified solely because source files, tabs, table names, or buttons exist. At this snapshot, there are **0 modules certified complete by browser E2E in this effort**. The labels below describe source coverage only.

| Module/page family | Source state observed | Work completed in this branch | Remaining TODO | Status |
|---|---|---|---|---|
| Shared app shell, module navigation | `web/app.js`, registries | Inventory started; global search empty/error messaging improved | Full route/modal/action inventory; keyboard/mobile/a11y and browser journeys | PARTIAL / NOT VERIFIED |
| Generic domain blueprints (16 keys) | `web/module-blueprints.js` | Honest blueprint-only action status; removed unsupported RLS/RBAC ENFORCED badges | Replace each blueprint with actual route/subview only after backend contract and role tests are known | BLUEPRINT ONLY |
| Fashion | `web/sector-modules.js`, `web/operations-modules.js` | Source entry and views exist | Verify list/detail, scope filters, data schema assumptions, actions and complete E2E | PARTIAL / NOT VERIFIED |
| Education | `web/sector-modules.js`, `web/operations-modules.js` | Schools/teachers/request views and request action source exist | Check escaping, validation, requester/target permissions, privacy, failure/retry, RLS and browser E2E | PARTIAL / NOT VERIFIED |
| Jobs | `web/sector-modules.js`, `web/operations-modules.js` | Job/application views and apply action source exist | Verify employer/candidate ownership, duplicate applications, private fields, transitions and E2E | PARTIAL / NOT VERIFIED |
| Used items | `web/sector-modules.js`, `web/operations-modules.js` | Listing view and sold-status action source exist | Verify seller ownership, update contract, concurrency, visibility and E2E | PARTIAL / NOT VERIFIED |
| Restaurants | `web/restaurant-module.js`, operations definitions | Dedicated module source exists | Menu → order → kitchen/status → table/inventory; role boundaries and migrations | PARTIAL / NOT VERIFIED |
| MantiGO / rides | `web/operations-modules.js`, `web/app.js` | Request/bids/rides definitions and UI source exist | Request → bids → select → ride state; customer/driver privacy and lifecycle E2E | PARTIAL / NOT VERIFIED |
| Reverse bidding / maintenance / professional services | `web/reverse-bidding-module.js`, operations definitions | Request/offer surfaces exist | Full request/bid/selection/cancel flow, idempotency and role/tenant E2E | PARTIAL / NOT VERIFIED |
| Marketing / CRM / leads | `web/app.js`, operations definitions | Source entries and some source mappings exist | Lead/project/participant lifecycle, assignments, filters, no-result/source-error states | PARTIAL / NOT VERIFIED |
| Grocery / catalog / stock | operations definitions | Catalog/price/inventory/order source mapping exists | Verify real queries, business/branch scope, stock mutation contracts and end-to-end order | PARTIAL / NOT VERIFIED |
| Medical / appointments | operations definitions | Provider/appointment source mapping exists | Patient/provider views, booking state machine, duplicate booking, authorization and E2E | PARTIAL / NOT VERIFIED |
| ERP / purchasing / inventory | operations definitions | UI/source definitions exist; some tables are explicitly backend-only | Supplier → purchase order → receipt → stock; confirm deployed migrations and server-only writes | PARTIAL / NOT VERIFIED |
| Legal | operations definitions | Document/requirements/agreement source mapping exists | Document privacy, contract-backed actions, lifecycle and E2E | PARTIAL / NOT VERIFIED |
| Companies / factories / trips | operations definitions and generic blueprint | Source mappings/blueprints exist | Verify actual page route, tenant scope, list/detail/workflow and backend contracts | PARTIAL / NOT VERIFIED |
| Matrimony | generic blueprint/registry | Generic blueprint exists | Private profile visibility, match/contact consent and all privacy tests | BLUEPRINT ONLY / NOT VERIFIED |
| Accounting / commissions / packages | app and operations references | Existing source references preserved | Keep expanded finance/subscription UI deferred; preserve mandatory cash/order integrity | DEFERRED EXPANSION |
| SMM paid execution | `web/smm.html`, `web/smm.js` | Existing storefront source preserved | Keep paid execution fail-closed; later validate provider credentials, spending limits, callbacks and idempotency | DEFERRED |
| Digital public page / editor | `web/digital-page*` | Dedicated public/editor source exists | Owner scope, unpublished/missing slug, safe rendering, save/preview/publish and E2E | PARTIAL / NOT VERIFIED |
| Provider onboarding / activity management | `web/provider-onboarding-module.js`, `web/app.js` | Onboarding source exists | Activity create/edit/approve/suspend/close mapped to verified Edge Function/RPC and role tests | PARTIAL / NOT VERIFIED |
| Platform admin / user-role management | `web/app.js`, `web/rbac.js` | Role-aware shell and membership context source exists | Dedicated scoped assign/revoke, confirmation, audit, denial and non-admin negative tests | PARTIAL / NOT VERIFIED |
| Public discovery / search / sponsored display | `web/home.js`, `web/app.js` | Search failure and zero-source states improved | Result-to-detail journeys, filters/pagination, sponsored label/empty/error, responsive/browser E2E | PARTIAL / NOT VERIFIED |

### Per-module definition of done

- [ ] Route is reachable from intended navigation and supports back/deep-link behavior.
- [ ] Loading, true-empty, partial-error, full-error and retry states are distinguishable.
- [ ] List/detail/forms/validation/filter/pagination exist where relevant; no inert or fake-success actions.
- [ ] Each read/write is mapped to a deployed table/RPC/Edge Function; sensitive writes are server-authorized and idempotent where needed.
- [ ] Tenant/business/branch and role boundaries are tested with both allow and deny cases.
- [ ] Mobile, keyboard/accessibility and authenticated browser E2E pass on exact head.
- [ ] Results are recorded in TODO/session/continuity; only then can status move to VERIFIED.
