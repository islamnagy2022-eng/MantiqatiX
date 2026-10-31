# MantiqatiX — Standalone Subscriber Account & Control Portal

## Product correction / authoritative requirement

The requested professional dashboard is **not** a tab, panel, or embedded workspace inside the public home/directory page. It is a separate authenticated account destination reached from **حسابي / اشتراكي**. It has its own page shell, navigation, route, and responsive layout.

The public directory remains the visitor-facing home. Subscriber management is a separate experience. Do not remove, hide, replace, or disable any existing control screen while the new portal is being built and verified.

## User journeys

1. A signed-in subscriber opens **حسابي** from the public site's account menu.
2. The app navigates to the standalone subscriber portal (proposed stable route: `?view=account_portal`, with a future clean `/account` route only if compatible with the current Pages/base-path deployment).
3. The portal loads the authenticated identity, active membership(s), subscription/billing status, assigned businesses/branches, roles, and effective permissions from authoritative server-backed session/bootstrap data.
4. The subscriber can choose **لوحة التحكم** or **وضع الزائر**:
   - Dashboard mode opens the standalone portal and exposes only authorized actions.
   - Visitor mode returns to the public directory/catalog experience. It changes presentation/navigation only; it does not grant, revoke, or widen server permissions.
5. The account menu provides a clear return path from visitor mode to the account portal.

## Portal information architecture

- **الرئيسية:** account identity, subscription summary, status, renewal/payment dates where authoritative data exists, and quick links.
- **اشتراكاتي:** each subscription/package, status (active/pending/expired/suspended), billing history/receipts when supported, renewal/upgrade/request actions only when backed by a real workflow.
- **صلاحياتي:** effective role, tenant/business/branch scope, read/write capabilities, and an explanation of unavailable capabilities. Display only; never trust client-side permission claims.
- **أنشطتي:** all businesses/listings linked to the signed-in user, verification/publication state, and links to manage or preview each authorized activity.
- **إدارة النشاط:** reuse existing safe functions for catalog, products/services, profile, images, contact channels, and public page preview. Do not duplicate business logic.
- **الفروع والفريق:** show/manage only when the membership role and current backend contracts authorize it.
- **الطلبات والخدمات والتقارير:** expose only capabilities that already have verified backend authorization and tenant scoping. Missing capabilities stay explicitly marked as future work; do not simulate them.
- **الإعدادات والأمان:** account identity, sign-out, and supported security/session actions.

The portal must be role-aware and subscription-aware. A Google-authenticated account with no active membership sees account status and a safe path to request/review subscription; it must not receive owner controls by default. Multiple memberships/businesses must be represented without silently selecting an unrelated business.

## Separation and navigation

- Public directory/home remains the visitor surface.
- Subscriber portal is a distinct top-level route and full-page shell, not rendered as a section inside DirectoryView or AdminDashboard.
- The account entry point is **حسابي** (or **اشتراكي ولوحة التحكم**); the old home-page dashboard tabs are not the destination.
- Dashboard/visitor toggle is always visible in the portal and has an accessible label and current-state indicator.
- Deep links, refresh, browser back/forward, and direct access must preserve route intent while re-running authorization.
- Public catalog share links continue to open the public storefront; portal routing must not hijack `?store=` links.

## Security invariants

- The mode toggle is UI navigation only, never an authorization mechanism.
- Resolve effective permissions from verified session/membership data and enforce every mutation at Edge Function/RPC/database boundary.
- Enforce tenant, business, and branch ownership for every read/write; fail closed for missing or ambiguous membership.
- Never trust local storage, URL parameters, hidden buttons, or client-side role values as authorization.
- Prevent cross-account stale bootstrap responses and cross-business leakage when switching identity/membership.
- Treat the Account Portal as a role-aware gateway, not a privilege union. The platform-admin mode exposes global control-center tools only when the authenticated bootstrap proves an active platform-admin membership; owner/employee modes never inherit those controls.
- Show business modes only from exact active memberships mapped to a business in the same tenant. Switch by membership ID + business ID, reload catalog data under that membership's branch scope, clear cart state, and keep server/RLS authorization authoritative.
- A platform administrator selecting a business retains the distinct platform-admin identity; never copy or impersonate the trader's membership role. A real business mode is available only when the same account also has an actual active business membership.
- Audit sensitive subscription, role, ownership, and billing actions. No direct production DDL/DML, grants, RLS changes, or Edge deployment as part of UI-only work.

## Safe migration plan (strictly staged)

### Phase A — Inventory and contract
- Map existing routes, account entry points, membership bootstrap, subscription/billing fields, dashboard components, and each action's server authorization.
- Classify each existing control as subscriber-owned, employee/branch-scoped, or platform-admin-only.
- Define a single portal capability registry from authoritative permission contracts; do not infer capabilities from labels or UI presence.

### Phase B — Add standalone portal (additive)
- Add a separate portal route and shell.
- Add the **حسابي / اشتراكي** navigation entry.
- Implement dashboard/visitor navigation toggle.
- Reuse existing tested components/actions behind the new shell; do not fork business logic.
- Keep all existing dashboard/control screens and links operational.

### Phase C — Functional and security verification
- E2E: guest, Google account without membership, active subscriber, expired/suspended subscriber, employee, branch owner, multiple businesses, and platform SUPER_ADMIN.
- Verify subscription and permissions shown match authoritative bootstrap data.
- Verify dashboard-to-visitor-to-dashboard navigation, refresh, deep links, back/forward, and direct unauthorized portal access.
- Verify no unauthorized API/RPC calls are triggered by hidden or disabled controls.
- Verify cross-tenant/business/branch isolation, stale-response handling, mobile layout, accessibility, and no regression in public catalog/store links.
- Require exact-head CI and deployed-origin role-scoped E2E before considering migration.

### Phase D — Controlled transition of old controls
Only after Phase C is complete and approved:
- Move each subscriber-owned control to the portal's appropriate section.
- Keep platform-admin controls in a separate platform administration destination; never move them into a subscriber portal.
- Remove old dashboard/control tabs and embedded subscriber controls from the public home navigation/screen.
- Retain compatibility redirects for old deep links where safe.
- Remove old components only after usage/reference audit and regression tests prove they are no longer needed.
- Do not delete data, backend functions, permissions, or unrelated screens as a side effect.

## Acceptance criteria

- A distinct portal page opens from **حسابي**; it is not part of the main directory/home screen.
- Subscriber sees subscriptions, billing state, activities, effective permissions, and available management capabilities accurately.
- Visitor/dashboard switch works in both directions without changing authorization.
- Existing control system remains fully available until new portal acceptance is signed off.
- After acceptance, subscriber control tabs are removed from the main home screen and the portal becomes the sole subscriber control destination.
- Platform SUPER_ADMIN control center remains separate and protected.
- No production launch claim until exact-head CI, security checks, and role-scoped deployed-origin E2E pass.

## Current status

**PARTIALLY IMPLEMENTED ON FEATURE BRANCH / NOT VERIFIED OR DEPLOYED.** Added the standalone `account_portal` route, authenticated `حسابي / اشتراكي` entry point, independent account shell, subscription summary, membership permission display, activity summary, visitor-mode switch, and reuse of existing merchant/professional tools inside the portal. Existing main-navigation dashboard controls remain untouched. Browser coverage was added; exact-head CI and deployed-origin checks are pending. This implementation is additive and does not modify database, RLS, grants, or production services.
