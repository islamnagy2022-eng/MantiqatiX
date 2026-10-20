# MantiqatiX — Initial UI/module route inventory

Date: 2026-10-20  
Branch: `feat/ui-first-module-completion-20261020`  
Baseline inspected: `main` at `149a85c7e5c44b61421edc8391cbb82885902fae`.

> This is an initial source-grounded inventory, not a claim that all pages are complete. Route names and entrypoints below were confirmed from current repository files; page-by-page browser E2E and production parity are still NOT VERIFIED.

## 1. Current web/PWA entrypoints

| Surface | Current entrypoint(s) | Initial finding | Status |
|---|---|---|---|
| Public home/discovery | `web/index.html`, `web/home.js`, home CSS | Public landing, category taxonomy, search box, location controls and discovery sections are present. Need verify real results, no-results/error states, mobile and keyboard flows. | PARTIAL / E2E NOT VERIFIED |
| Authenticated workspace | `web/app.js` | Main shell owns authentication boot, membership/role state, module navigation and global search. Large monolithic file; audit routes/actions before refactor. | PARTIAL / E2E NOT VERIFIED |
| Authentication/session | `web/app.js`, Supabase Auth | Session restore/refresh/logout and OTP flows are present in the app implementation; exact resend/expiry/recovery behavior and multi-role browser journeys require testing. | PARTIAL / E2E NOT VERIFIED |
| Role and permission presentation | `web/rbac.js`, `web/app.js` | Client RBAC defines UI visibility defaults and aliases. It is only a UI affordance; every sensitive operation must still be enforced by RLS/RPC/Edge Function. | PARTIAL / server verification required |
| Sector/module registry | `web/sector-registry.js`, `web/sector-modules.js`, `web/module-blueprints.js` | Canonical sector mapping and sector workspace definitions exist. Some module-blueprint buttons currently only show a success toast rather than opening a real workflow; this is a concrete UI-integrity gap to fix. | PARTIAL / actionable gap found |
| Operations workspaces | `web/operations-modules.js` | Several operational workspaces and cash/order controls are assembled here. Must map each workspace to its real backend contract and release/deferred state. | PARTIAL / contract audit required |
| Provider onboarding/activity setup | `web/provider-onboarding-module.js` | Authenticated Edge Function-backed onboarding helper exists. Need verify form states, role authorization, activity create/edit lifecycle and failure handling. | PARTIAL / E2E NOT VERIFIED |
| Restaurant operations | `web/restaurant-module.js` | Dedicated module code for restaurant session/membership, menu/orders/tables/inventory. Needs role-boundary and full workflow tests. | PARTIAL / E2E NOT VERIFIED |
| Reverse bidding | `web/reverse-bidding-module.js` | Dedicated requests/bids UI exists. Verify request lifecycle, bid actions, privacy and authorization. | PARTIAL / E2E NOT VERIFIED |
| Digital public pages | `web/digital-page.html`, `web/digital-page.js` | Public slug-based digital page renderer exists. Verify missing/invalid slug, unpublished page, safe rendering and mobile layout. | PARTIAL / E2E NOT VERIFIED |
| Digital page editor | `web/digital-page-editor.html`, `web/digital-page-editor.js` | Separate editing surface exists. Verify owner scope, preview/save/error flows and deployed backend contracts. | PARTIAL / E2E NOT VERIFIED |
| SMM storefront | `web/smm.html`, `web/smm.js`, `web/smm.css` | Standalone SMM service/order/wallet interface exists. Paid execution is deferred for first release and must remain gated in both UI and backend; do not represent it as launch-enabled. | DEFERRED / preserve source |
| PWA/cache | `web/sw.js`, `web/index.html`, `web/config.js` | Service worker and app configuration exist. Cache/version/deployed-site behavior needs exact-head and browser verification. | PARTIAL / E2E NOT VERIFIED |

## 2. Module coverage matrix — initial inventory

| Module / domain | Source evidence | First UI work to verify/complete | Release sequencing |
|---|---|---|---|
| Platform administration | `web/app.js`, `web/rbac.js` | Admin routes, users/memberships, role changes, denial states, audit views, safe return to customer context. | In scope; server authorization mandatory |
| Customer discovery and provider profiles/services | `web/index.html`, `web/home.js`, `web/app.js` | Search → result → profile/service → contact/request journeys, privacy and empty/error states. | In scope |
| Sign-in/onboarding | `web/app.js`, `web/provider-onboarding-module.js` | OTP, resend/expiry, session restore, logout, membership/business selection and provider activity onboarding. | In scope |
| Global search | `web/app.js` global search helpers; `web/home.js` public search | Confirm search source list, permission filtering, result links, filters, loading/error/empty states and route integration. | In scope |
| Orders/cash checkout | `web/app.js`, `web/operations-modules.js`, current Draft PR #307 | End-to-end customer order, correct provider view, state changes, cash intent/confirmation, idempotency and truthful collection status. | In scope; cash only; still release-gated |
| CRM/leads/support | `web/app.js`, marketing workspace code | Lead create → list → detail → assign/status; support isolation; no fake success. | In scope |
| Marketing workspace | `web/app.js`, current TODO records | Leads, projects, campaign planning, partner participation and clear backend-unavailable state. | In scope where backend contract is verified |
| Sponsored public placements | `web/home.js`, existing sponsored-ad RPC references in continuity/TODO | Label sponsored content, safe empty state, supported click/impression path, responsive display. | Display UX in scope; billing/paid execution deferred |
| Restaurants | `web/restaurant-module.js`, sector/module registry | Menu, tables, orders, inventory, role-specific controls and state/error flows. | UI in scope; backend migrations must be verified |
| ERP/inventory/purchasing | `web/operations-modules.js`, `web/app.js`, RC461–RC466 work in Draft PR #307 | Suppliers, purchase orders/lines, stock, opening stock and permission/tenant isolation. | UI in scope; exact-head DB tests required |
| Medical | `web/operations-modules.js`, `web/app.js`, RC457/RC467/RC468 in Draft PR #307 | Appointment/booking state machine, idempotency, patient/provider screens and authorization. | UI in scope; exact-head DB tests required |
| Pharmacy | sector taxonomy/registry and operational workspace references | Determine actual routes and APIs; complete catalog/order/stock pages only where registered and supported. | In scope |
| Education | `web/sector-modules.js`, `web/module-blueprints.js` | Schools, teachers, requests, list/detail/create/edit and privacy. | In scope |
| Jobs | `web/sector-modules.js`, `web/module-blueprints.js` | Jobs, applications, candidate/employer views and access boundaries. | In scope |
| MantiGO | `web/operations-modules.js`, `web/app.js` | Ride/request, offer and status views; privacy and role boundaries. | In scope; preserve privacy gates |
| Reverse bidding | `web/reverse-bidding-module.js` | Requests, offers/bids, selection and status transitions. | In scope |
| Digital pages | `web/digital-page.html`, `web/digital-page.js`, editor files | Public page and owner editing/preview/save paths. | In scope; electronic paid checkout deferred |
| Activity management | `web/provider-onboarding-module.js`, `web/app.js`, membership/activity APIs | Inventory existing activity create/edit/activate/deactivate controls; add only contract-backed actions. | High priority |
| Job-function and role management | `web/rbac.js`, `web/app.js`, membership/admin paths | Permission matrix, scoped assignment/revocation, confirmation, audit and negative tests. | High priority; server checks mandatory |
| Subscription packages/accounts | existing app/backend contracts; not fully inventoried in this pass | Preserve existing code/data and display deferred status where relevant. | DEFER until after launch |
| Expanded accounting UI / subscription billing | finance/operations modules and existing financial contracts | No new UI/model before first launch unless required by an already-approved cash/order workflow. Preserve existing financial integrity gates. | DEFER expansion; security gates remain mandatory |
| SMM provider execution | `web/smm.html`, `web/smm.js` | Keep clearly gated and do not trigger paid execution. | DEFER until post-launch |

## 3. Confirmed UI integrity issue to address first

`web/module-blueprints.js` currently binds each `.mnty-blueprint-btn` to a toast that says the selected section was opened, without actually navigating to or opening a real workflow. This is misleading feedback and conflicts with the requirement that visible actions work or state their true limitation. Fix this in a small tested slice: either wire the button to an existing real module route/action after confirming its contract, or replace the false-success behavior with an honest, accessible unavailable/deferred state. Do not invent routes.

## 4. Gaps that remain unverified

- Exact complete list of routes and action handlers inside the large `web/app.js` is not yet fully enumerated.
- No authenticated browser E2E was run as part of this inventory.
- No live production Supabase/Auth setting was changed or tested here.
- Sponsored-ad runtime contracts and current production parity must be revalidated before altering tracking or management behavior.
- Activity creation and job-role management need a permissions/API/RPC matrix before UI implementation.
- Draft PR #307 and PR #308 are open; changes must be integrated by an explicit dependency-aware PR plan, not by assuming they are merged.
- Global production release remains **BLOCKED / NOT CERTIFIED**.

## 5. Next execution batch

1. Inspect exact handlers/routes and the global search source map in `web/app.js`.
2. Inspect `web/module-blueprints.js` consumers and the module runtime contracts; fix the false-success button with a focused test.
3. Map activity and role-management operations to existing Edge Functions/RPCs and add a role/tenant matrix.
4. Implement the first complete module journey without changing production schema.
5. Run exact-head validation and record outcomes in `docs/SESSION_LOG.md`, `docs/PROJECT_CONTINUITY.md`, and `docs/MASTER_PRODUCTION_TODO.md`.
