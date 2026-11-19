# Pass 1090–1099 — R7 UI/API contract map and shared authorization boundary recheck

**Date:** 2026-11-19  
**Main baseline:** `75b2e1060c3b1c71a3837d139a5c875927af2467`  
**R7 archive:** `bizcatalog-manager (11).zip`  
**Archive SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`

## 1. R7 screen/component map

The uploaded archive contains these principal user-facing areas. The current-main counterpart is listed where an equivalent exists.

| R7 component / area | Current-main counterpart | Disposition |
|---|---|---|
| `DirectoryView` | `DirectoryView.tsx`, `DirectoryListingsView.tsx`, `lib/directoryListings.ts` | Existing current implementation is canonical; compare visual-only differences, do not import R7 data access. |
| `CatalogSection`, `BusinessProfileHeader` | `storefront/CatalogSection.tsx`, `storefront/BusinessProfileHeader.tsx`, `lib/catalogPricing.ts` | Existing current implementation is canonical; retain current persisted catalog/pricing contract. |
| `DedicatedSearchExploreView`, `SmartPlatformSearchBar` | `MarketplaceHome.tsx`, `DirectoryView.tsx`, `lib/directoryListings.ts` | Keep current Egypt-wide discovery and approved geo filters; no R7 local fallback. |
| `UnifiedEnterpriseDashboard`, `AdminDashboard` | `admin/SuperAdminControlCenter.tsx`, `modules/dashboard/ProfessionalDashboard.tsx` | Existing current RBAC/tenant-scoped surfaces; reject R7 role-switching/demo account code. |
| `MerchantDashboard`, merchant tools | `merchant/MerchantDashboard.tsx`, `modules/dashboard/ProfessionalDashboard.tsx`, `BusinessEmployeeManager.tsx`, `CatalogImportPanel.tsx` | Use current employee/tenant/branch access contract. |
| `MobileAppBottomNav`, install controls | Current `Navbar.tsx`, `FloatingAppInstallButton.tsx` and preserved Android wrapper | Preserve native Android sources; compare presentation only. |
| `SiteMapView`, `InteractiveGovernoratesMap` | `SiteMapView.tsx`, `data/egyptGeoDiscovery.ts` | Current geographic source is canonical; do not use R7 local/demo coordinates as authority. |
| `CartDrawer` | `cart/CartDrawer.tsx` | Existing current cart UI; orders must use current order/RPC contract. |
| `CommissionRulesManager`, `AdminCommissionRulesScreen` | `admin/CommissionRulesManager.tsx` | Existing commission UI; finance RPCs remain subject to tenant scope and production parity gates. |
| `LoginModal`, `UserProfileModal` | `auth/LoginModal.tsx`, `modules/account/SubscriberAccountPortal.tsx` | Use Supabase Auth only; reject R7 password/local session model. |
| `MemberMessagesView` | No direct same-named component in current catalog tree | Gap candidate only; requires product and secure messaging contract review before UI port. |
| `MantyGoBiddingView`, progression workflow | No direct same-named current catalog component | Backend source exists in Supabase; UI is a separate gap candidate and remains gated by live MantiGO auth/privacy parity. |
| `UnifiedBookingPaymentModal` | Current activity modules and booking/payment backend contracts | Do not import R7 payment orchestration; current Paymob source/live drift is a P0 blocker. |
| `WalletModal`, billing/Paymob panels | No direct same-named current catalog component | No port until wallet/payment/webhook and ledger contracts are proven live and tested. |
| `MarketingServicesModal`, `SmartMarketingModal`, ad request | `common/MarketingServicesModal.tsx` and current marketing services | Only presentation can be compared; all campaign/ad/lead writes must use current tenant-scoped backend. |
| `AdminSupabaseBackupScreen`, `ProductionPhasesControlPanel`, live operations control | No safe direct browser equivalent | Do not port. Backup, restore, security scans, production toggles and phase control belong in restricted operator tooling. |

## 2. R7 client trust-boundary findings re-confirmed

Direct source inspection of `src/App.tsx`, `src/context/AppContext.tsx`, `src/lib/supabaseClient.ts`, and selected components confirms:

- The App renders a role switcher with direct customer/subscriber/admin demo credentials.
- `AppContext` stores businesses, products, subscribers, sales, auth session, active business, settings, messages and orders in browser `localStorage`.
- Login state is locally assigned before/alongside `/api/auth/login` requests; role permissions are derived from the local session role.
- Client code calls legacy `/api/*` endpoints for customers, sales, business/product CRUD, MantiGo, Paymob billing, wallet, AI operations, production phases, backup/restore, security scans, and monitoring.
- `supabaseClient.ts` contains an unsafe service-role-key fallback in the browser key-selection chain and an archive Supabase URL typo. This archive must not be built or deployed.

These are source-level findings, not claims that the legacy endpoints are currently deployed. The archive remains reference-only.

## 3. Safe integration boundary

1. Current `main` and its Supabase-backed services remain the only production source of truth.
2. Existing current components are preferred over duplicating R7 equivalents.
3. A visually useful R7-only element may be prototyped in isolated Preview only after it is separated from local state, demo credentials, legacy API calls, payment code and privileged controls.
4. Any new writes must call an existing verified Supabase RPC/Edge contract with authenticated actor binding, tenant/business/branch scope, validation, idempotency where relevant, and tests.
5. No current public root or mobile wrapper is replaced by this pass.

## 4. Additional read-only Production SECURITY DEFINER audit

Live `pg_proc` inspection found that `mnty_can_platform_admin()` still delegates to `mnty_can('admin',NULL,NULL,NULL)`, is SECURITY DEFINER, and is executable by authenticated (not anon). Its `search_path` remains `public, pg_temp`.

Four additional authenticated-executable SECURITY DEFINER callers directly invoke this helper:
- `admin_create_global_ad(...)`
- `fulfill_digital_page_publish(uuid,uuid,uuid)`
- `review_mantigo_captain_application(...)`
- `set_mantigo_financial_config_backend(uuid,numeric,text)`

The previously identified four MantiGO global RPCs remain separately role-gated without registry membership in live definitions, and five RLS policies call the same helper. This confirms the shared helper is a broader platform authority boundary than the four MantiGO endpoints alone.

A further targeted review found:
- `preview_commission_backend(...)` calls `assert_financial_membership(p_tenant_id)`, which binds the caller to `auth.uid()`, requires active membership in that tenant, and checks a finance role.
- `upsert_catalog_item_and_price_backend(...)` delegates to item/price functions that independently bind `auth.uid()` and enforce tenant/business/branch membership and object scope.
These two functions were not classified as platform-admin bypasses from the reviewed definitions.

No live function was invoked. No Production DDL/DML, ACL, RLS, Auth, Edge, payment, wallet, settlement or data write was performed.

Tracking: [Issue #852 — P0 shared platform-admin helper authorization gap](https://github.com/islamnagy2022-eng/MantiqatiX/issues/852).

## 5. Post-merge state at checkpoint

- PR #851 merged to main as `75b2e1060c3b1c71a3837d139a5c875927af2467`.
- Exact PR head CI: 32 success, 2 expected skipped, 0 failures.
- Post-merge check checkpoint: 18 success, 2 in progress, 0 failures.
- GitHub Pages deployment job had completed its deploy and root/legacy/Preview checks successfully; pinned Playwright installation and deployed-origin browser checks were still running.
- Primary catalog build and employee RBAC PostgreSQL checks passed; professional dashboard browser E2E was still running.
- Do not claim the post-merge deployment/browser gate complete until those two workflows conclude successfully.

**Release status:** full platform remains **BLOCKED / NOT CERTIFIED**. The R7 archive is not deployable and no R7 code was imported.
