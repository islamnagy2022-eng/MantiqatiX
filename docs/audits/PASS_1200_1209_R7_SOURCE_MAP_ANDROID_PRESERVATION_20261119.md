# Pass 1200–1209 — R7 source map and Android preservation

**Date:** 2026-11-19  
**Current-main baseline:** `7742ee0ecda91aa8cfe1801e3b995a4aa38306e7`  
**Reference archive:** `bizcatalog-manager (11).zip`  
**Archive size:** 46,114,882 bytes  
**Archive SHA-256:** `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`  
**ZIP integrity:** PASS  
**Production:** BLOCKED / NOT CERTIFIED. No R7 source imported or deployed.

## 1. Unified source map

| Source | Current status | Authority / decision |
|---|---|---|
| GitHub `main`, `apps/catalog-frontend/**` | Current canonical public catalog application | Primary website source. Keep role/session and public directory contracts. |
| GitHub `main`, `supabase/**` | Current canonical SQL migrations, Edge Functions and database contracts | Sole authority for identity, permissions, tenant scope and production data. |
| Supabase project `moyhiluyhjsujhwlyeuu` | Live connected project; 310 migrations through `20261110150618` | Production data source. No schema/data mutation authorized by this pass. |
| R7 AI Studio archive | Separate React 19/Vite/Express candidate | Immutable feature/reference source only. Do not overwrite main or import its server/data model wholesale. |
| R7 Android WebView wrapper | Three-file historical source | Preserve it. It is not a complete buildable/signable Android application and is not the current mobile-web/PWA implementation. |
| Existing R6/R7 mapping docs | Historical and current contract crosswalks | Use `docs/audits/PASS_1090_1099_R7_CONTRACT_MAP_AND_SHARED_AUTHORIZATION_RECHECK_20261119.md` and `docs/integration/R6_TO_SUPABASE_DOMAIN_MAPPING_20261108.md` before porting features. |

The deployed public root remains the legacy catalog; V6 Preview is a separate path. Do not replace either deployment or create a parallel catalog.

## 1A. Current public deployment topology

The current `.github/workflows/pages.yml` builds `apps/catalog-frontend` twice:
- Primary catalog build at the public root `/`.
- A path-adjusted rollback copy at `/legacy/`.

The isolated V6 application is built separately at `/v6-preview/`. The old `web/**` tree is retained and statically validated, but it is not copied into the current Pages artifact. Therefore `web/reverse-bidding-module.js` is not the active production catalog UI; it is retained legacy source. The current React catalog UI gap for R7's MantiGO bidding screen remains real.

## 2. Archive integrity and critical blockers

The exact uploaded ZIP was independently checked with `unzip -t` and SHA-256. ZIP integrity passed and the hash matches the preserved archive record.

Direct inspection of the ZIP contents confirms:

- **Wrong Supabase project reference:** R7 uses `moyhiluyhjsujhwlyweuu` (extra `w`); the connected Production project is `moyhiluyhjsujhwlyeuu`. Do not insert real keys or Production data into the R7-configured endpoint.
- **Browser service-role boundary:** `src/lib/supabaseClient.ts` selects `SUPABASE_SERVICE_ROLE_KEY` before anon-key variables in a browser-importable shared client. The source boundary is unsafe; service-role initialization must be server-only and absent from browser bundles.
- **Fallback secrets:** `server.ts` has hardcoded fallback values for Paymob HMAC, session JWT signing and backup encryption salt. Production must fail closed when strong secrets are missing; rotate any real secret ever exposed.
- **Dual data authority:** `server.ts` uses `.data/production-live-db.json` as a local database alongside Supabase. Supabase must be the only identity, permission, tenant and financial source of truth; local disk may only be a cache/export artifact with integrity and reconciliation rules.
- **Browser-trusted state:** `src/context/AppContext.tsx` persists businesses, products, subscribers, auth session, active business, sales, ads, messages, wallets and bookings in localStorage.
- **Demo role switcher:** `src/App.tsx` exposes customer/subscriber/admin demo credentials and local role switching. This must not be ported into the production app.
- **Build/test evidence gap:** the archive package has no `test` script or included CI workflow. Its claimed test count is not independently reproducible from the supplied package scripts. No fresh R7 build/test pass is claimed.
- **Android wrapper:** only three files are present under `android-webview-wrapper/`. The project lacks a Gradle wrapper/root settings, referenced resources and ProGuard file. Its JavaScript bridge is not protected by a trusted-origin allowlist. Preserve the files; do not call the package a verified native app.

These findings are source-level evidence. They do not assert that the archive's legacy server endpoints are currently deployed.

## 3. R7 feature-to-current-main map

Existing current-main equivalents are canonical and must not be duplicated:

- Directory/search: `DirectoryView`, `DirectoryListingsView`, `MarketplaceHome` and the approved directory Edge Function.
- Storefront/catalog: current `BusinessProfileHeader`, `CatalogSection` and catalog pricing adapter.
- Merchant dashboard: current merchant dashboard, employee manager and CSV catalog import.
- Admin/professional dashboard: current Super Admin Control Center and Professional Dashboard with verified membership/permission scopes.
- Site map/geography: current `SiteMapView` and canonical Egypt geo discovery data.
- Cart/orders: current cart and verified order/payment backend contract.
- Auth/profile: Supabase Auth and subscriber account portal; no R7 local password/session model.
- Marketing services: current marketing-services modules; writes remain tenant-scoped and server-authorized.
- Mobile web/PWA: current responsive Navbar/install controls; preserve separately from native Android.

R7-only or incomplete candidates:

| R7 area | Current-main status | Decision |
|---|---|---|
| `MemberMessagesView` | No direct current catalog component or verified durable messaging contract | Gap candidate only. Requires message persistence, recipient privacy, tenant/branch authorization, abuse controls, audit and notifications. |
| `MantyGoBiddingView` | No direct same-named current UI; backend source exists but live migration/auth/privacy parity is not complete | Gap candidate only. Build UI against verified current RPC/Edge contracts after the ordered backend release and privacy checks. |
| `DedicatedSearchExploreView` / smart search | Current directory/Marketplace and approved geo filters exist | Compare presentation only; do not import local search authority or local demo data. |
| Wallet/booking/payment modals | No verified R7-equivalent write contract | Do not port until Paymob, wallet, ledger, idempotency and webhook contracts pass sandbox and live parity. |
| Production phase control, backup screen, security scans | No safe browser equivalent | Keep in restricted operator tooling; never expose production toggles or backup/restore controls to ordinary browser users. |
| AI image completion | Current server-authorized image proxy/default-image resolver exists | Reuse the approved server action only; never expose provider API keys in the browser. |

## 3A. MantiGO reverse-bidding backend contract — historical snapshot

The existing read-only Pass 721–740 contract audit has been preserved in `docs/audits/PASS_681_700_REVERSE_BIDDING_LIVE_CONTRACT_20261118.md`. Its 2026-11-18 snapshot found:

- `marketing_services.id` and `marketing_provider_services.service_id` can provide a stable service relationship; provider-service links must be ACTIVE.
- `indrive_requests` had no `service_id`; `indrive_bids.provider_rating` and `completed_orders_count` were NOT NULL with defaults; allowed bid statuses were `OFFERED`, `ACCEPTED`, `REJECTED`.
- The live bid RPC at that checkpoint supplied NULL rating and `PENDING`, conflicting with those schema constraints.
- A read-only aggregate found 16 active verified provider-service links across active MARKETING services, resolving to one distinct provider. This is historical supply data, not a current guarantee. Do not synthesize providers, offers, ratings or completed-order metrics; re-run the aggregate before enabling the feature.
- The required implementation sequence is: add a service_id reference, derive provider identity from `auth.uid()`, require active verified service links, validate area matching, add append-only negotiation events and single-winner acceptance, then add completion/dispute/review before any commission settlement. Keep commission shadow-only and do not write wallet/ledger/payment records in the UI pass.

These are historical read-only findings from 2026-11-18. Reconcile the live schema and ordered migration source again before implementing the UI. No bid, wallet or settlement write was performed.

## 4. Safe integration order

1. Keep GitHub main and Supabase as the only production source of truth.
2. Do not import R7 `server.ts`, local JSON, browser role switching, demo accounts, fallback secrets or service-role client.
3. Use the existing R7/R6 component maps to select one visual feature at a time; compare against current main before creating a new component.
4. For each candidate, separate presentation from state and data access, then connect only to an existing tested RPC/Edge contract with authenticated actor binding and tenant/business/branch scope.
5. Implement Member Messages only after a durable messaging contract is designed and tested.
6. Implement MantiGO bidding UI only after current backend migration, auth, privacy, idempotency and live-source parity are verified.
7. Keep Android WebView source preserved as a separate native workstream. A complete Gradle project, trusted-origin policy, safe bridge, signing, permissions and device CI are required before native release.
8. Preserve the current root catalog and V6 Preview. No production deployment or mobile cutover is authorized by this source review.

## 5. What was and was not done

Completed:
- Verified archive SHA and ZIP integrity.
- Inspected the R7 App, context, Supabase client, server secrets, package scripts and Android wrapper.
- Reconciled R7 components against current-main canonical modules and the existing R6/R7 mapping docs.
- Preserved the Android and archive audit documents on current main.

Not done:
- No R7 source was imported into the application.
- No application UI, mobile source, Android project or production backend was changed.
- No Production SQL, migration, GRANT, RLS, Auth, Edge, payment, wallet, settlement or user-data mutation occurred.
- No fresh R7 dependency install, build, unit test or Android build was executed; the supplied package does not expose a test script and the native project is incomplete.

**Disposition:** R7 remains a feature reference, not a production candidate. The next safe work is a one-feature-at-a-time UI gap implementation against current-main contracts. P0 backup/restore and Production release gates remain open.
