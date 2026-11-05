# V6 → MantiqaTix Canonical Integration Map
**Date:** 2026-11-05  
**Candidate archive:** bizcatalog-manager (5)(1).zip  
**SHA-256:** ff5dae607ea876888068c7b66131bf12a1f1be0fd8a749f7690d311ce9cfe965  
**Repository baseline:** main @ 218d4c768021fbc94d21ffd442b3fcdacd16e4f8  
**Implementation branch:** feat/v6-canonical-integration-phase1-20261105

## 1. Decision

V6 is the selected target UI/application source. It is not yet an executable production replacement. The only deployed frontend remains apps/catalog-frontend. V6 must be integrated into that deployment path in vertical slices while retaining the current root, backend contracts and rollback target until release gates pass.

## 2. Candidate source findings

| Area | Observed candidate implementation | Integration decision |
|---|---|---|
| UI/runtime | React 19, TypeScript, Vite 8, Tailwind 4 | Preserve V6 presentation and component behavior; use the existing catalog app's build/deployment root. |
| Main state | AppContext hydrates and persists businesses, products, subscribers, sales, settings, session, wallets, messages and campaigns through localStorage | localStorage may hold presentation preferences/drafts only; never canonical shared state, authentication, ownership, financial balances or cross-device records. |
| Demo content | seedData.ts exports initial businesses, subscribers, products, ad requests, contact messages and subscription requests | Keep fixtures only in tests/story/demo contexts; do not import seed arrays into production hydration. Never promote seed rows to real records. |
| Express snapshot API | server.ts exposes GET/POST /api/production-state plus in-memory notifications | Do not expose this as shared persistence. Keep Express development-only or remove after import/reference review; production writes must use existing authenticated backend contracts. |
| Auth | Candidate types include password-oriented subscriber/admin fields and local AuthSession | Replace with existing Supabase Auth session and selected active user_memberships; never store passwords in Subscriber or localStorage. |
| Business model | V6 Business combines identity, public profile, location, verification, billing, Paymob, commission, employee, subscription, wallet and telemetry fields | Split into server-owned entities and read models; do not persist this interface as a single row or trust client-supplied verification/billing/commission/wallet fields. |
| Product model | V6 Product combines product/service, price, image and availability | Map to catalog_items + catalog_item_prices + catalog_item_options only after exact field mapping; price authority remains server-side. |
| SaleRecord | V6 sale object contains customer details, total, commission and net revenue | No direct client insert. Reconcile with orders, payment_intents, commission_transactions and finance journal only through approved backend flows. |
| Wallet | V6 WalletAccount/WalletTransaction carries balances and transaction types | Do not hydrate or mutate client-side balances. Requires authoritative finance/ledger contracts; current finance release gate is blocked. |
| Campaigns | GeneratedMarketingCampaign contains generated copy, estimated reach and ad cost | Separate generated draft content from persisted campaign/ad spend; no estimated reach/cost may be displayed as actual metrics. |
| Messaging | MemberDirectMessage and privacy configuration | Map only after exact current messaging table/RPC/retention/consent contract is confirmed. |
| Geography | Country/governorate/markaz/village and coordinates on Business | Use current canonical activity/location fields and branch scope; do not duplicate location authority. |
| Load simulator | loadTestingEngine.ts generates simulated telemetry/results | Test/simulator-only; never expose its outputs as production performance metrics. |

## 3. Existing backend contracts to reuse

| V6 domain | Existing repository foundation | Required boundary |
|---|---|---|
| Public business directory | public-catalog-directory Edge Function; browser adapter in apps/catalog-frontend/src/lib/production.ts | Public read only; explicit display-safe projection and publication/status gates. No direct anon SELECT from businesses. |
| Public storefront | public-catalog Edge Function | Public read for published catalog; branch-aware item/price projection. |
| Business/catalog administration | catalog-admin Edge Function | Existing server-side authorization and catalog mutation path; do not add a second catalog API. |
| Platform administration/subscribers | catalog-platform-admin Edge Function; existing user_memberships and platform permission resolver | Platform-scoped server checks and audit; do not infer role from UI or candidate local session. |
| Catalog entities | catalog_items, catalog_item_prices, catalog_item_options, catalog_business_settings | Exact tenant_id, business_id and optional branch_id mapping; effective active price/version required. |
| Business/branch ownership | businesses, branches, user_memberships | Tenant/business/branch scope is mandatory; V6 nested employees arrays are not an authoritative employee model. |
| Employee management | RC113–RC115 role/position/employee and guarded RPC foundations | Reuse current scoped permission resolver and membership synchronization; no client-side permission assignment. |
| Orders | orders and order-create / order-status-update backend contracts | Server derives customer, tenant, business, branch, item availability and price; use idempotency and status transitions. |
| Payments | payment_intents, payment-intent, paymob-webhook and create_payment_intent_backend | Keep V6 Paymob UI disabled until sandbox and webhook/idempotency/finance E2E are verified. Secrets remain server-only. |
| Subscriptions | business_subscriptions, subscription_tier_prices, subscription_payment_intents | Reuse after exact lifecycle and authorization mapping; no client-side paid/active state. |
| Commissions | commission_rules and commission_transactions | Current schema does not expose every V6 commission dimension; calculation activation remains gated on complete event/effective-date/reversal support. |
| Financial posting | RC449A/RC450 candidate journal schema/RPC | Production prerequisites remain unresolved; no wallet/ledger UI writes until schema/ACL and finance tests are closed. |
| AI images | ai-gemini-proxy action generate_catalog_image | Server-side authentication, permission, rate limit and storage persistence; no browser Gemini key. |

## 4. Hard mismatches and non-equivalences

1. V6 Business.paymentStatus, paymentDueDate, commission rates, isVerified, isFrozen, walletId and telemetry fields are not client-authoritative.
2. V6 Subscriber.password must never be mapped to a persisted production subscriber record. Supabase Auth owns credentials.
3. V6 Sales and wallet records are not interchangeable with orders, payment intents or journal entries.
4. A business profile is not a tenant, membership or branch. Keep each identifier distinct.
5. A local seed row that resembles a real business is still a fixture unless independently sourced and approved.
6. The private .data/production-live-db.json archive member is not an approved import source. Its contents were not read. It must never enter Git, public assets, build artifacts, logs or CI artifacts.
7. The V6 server snapshot route and in-memory notification store do not satisfy shared backend persistence, authorization, audit or multi-instance runtime requirements.

## 5. Candidate validation results

| Check | Result | Evidence / reason |
|---|---|---|
| ZIP integrity and SHA-256 | PASS | Exact digest matches the supplied authority. |
| Archive inventory | PASS | 131 files; React/TS/Vite source tree confirmed. |
| Private-data boundary validator | PASS | Executed against extracted candidate; snapshot detected as local-only and absent from public/build outputs. |
| npm install | NOT VERIFIED | Local install exceeded the 120-second tool execution window on two attempts; no node_modules created. |
| Bun install | BLOCKED | Bun is not installed in the execution environment. |
| TypeScript | BLOCKED | Global tsc cannot resolve vite/client because dependencies are not installed. |
| Node test invocation | FAIL / RUNNER MISMATCH | Five node:test files invoked with Node's type stripping fail resolving extensionless TS imports. Candidate package has no test script; its declared tsx dependency may provide the intended runner but was not installed. |
| TypeScript/TSX syntax transpilation | PASS (syntax only) | Global TypeScript 5.8.3 transpiled 53 source files with zero syntax diagnostics; this is not semantic type-checking. |
| Vite build | NOT RUN | Vite dependency unavailable. |
| Browser/PWA E2E | NOT RUN | Dependencies and runnable candidate build unavailable. |

## 6. Required next implementation order

1. Pin and install dependencies deterministically from the committed bun.lock (or produce a reviewed npm lockfile); add an explicit test script using the chosen supported runner and run all five existing tests.
2. Reconcile package versions and scripts with the production app build and CI; avoid silently updating dependencies during migration.
3. Complete a field-level mapping document for Business, Product, Subscriber, Order, SubscriptionRequest, SaleRecord, Wallet, Campaign, Message and AdminSettings.
4. Port the V6 visual shell and public directory view first, retaining the existing public-catalog-directory adapter and current search/pagination/verified-first contracts.
5. Port merchant/admin screens behind the current Auth/membership/permission resolver and catalog-admin/catalog-platform-admin contracts.
6. Add vertical-slice E2E and negative tenant/branch tests before enabling any writes.
7. Port orders and payments only after order/payment/finance gates pass.
8. Reconcile assets and remove obsolete files only after import graph, route, mobile, tests and deployment parity are proven.

## 7. Release boundary

- No production schema/data/Auth/RLS/GRANT/Edge/payment/finance change was performed.
- No candidate source code was copied into the live frontend in Phase 1.
- No Pages deployment or public cutover occurred.
- CATALOG_PILOT_GATE=PASS; FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED.


## 8. Additional source-level security and truthfulness blockers (2026-11-05)

These findings are from direct source inspection of the extracted archive. Credential-like values are intentionally not reproduced here.

| Finding | Source | Required treatment |
|---|---|---|
| Paymob merchant credential-shaped literal in default config; default Paymob config is enabled | src/data/seedData.ts:396–407 | Treat as exposed until proven placeholder. Remove from all client/default source; rotate if it was ever a real credential. Payment stays disabled until server-only secret configuration and approved sandbox E2E. |
| Admin password literal in initial settings | src/data/seedData.ts:409–425 | Remove immediately from production candidate. All users authenticate through Supabase Auth; admin role comes from server-verified membership and permission checks. |
| Google AI API-key-shaped literal in initial settings | src/data/seedData.ts:409–430 | Treat as exposed until proven placeholder. Remove from frontend/seed/config and rotate if real. Gemini credentials must be server-only. |
| Fake visitor fallback value presented as site traffic | src/App.tsx:96–100; src/components/admin/UnifiedEnterpriseDashboard.tsx:768–771 | Replace with an actual persisted/aggregated analytics source or display “غير متاح”; never show fallback counts as facts. |
| “Enterprise 100M” / 500k VU claims and load result simulation | src/components/Navbar.tsx; src/components/admin/AdminDashboard.tsx; src/utils/loadTestingEngine.ts | Treat as unverified product claims. Simulator outputs are not real load test evidence. Remove claims or label the tool clearly as a local simulation; production telemetry must come from measured infrastructure. |
| Unauthenticated file-backed production snapshot GET/POST routes bind on 0.0.0.0 | server.ts:46–71 and server startup | Must not be used in production. Remove or hard-disable these routes before any server deployment; replace with existing authenticated backend contracts. |
| Snapshot save marks state “official production” in localStorage and returns success even if remote persistence fails | src/context/AppContext.tsx:1247–1275 | Delete this false-success path. Persistence must return success only after authoritative server commit and audit evidence. |
| Entity, wallet, campaign and message data are automatically copied to a single local JSON snapshot | src/context/AppContext.tsx:1247–1275 | Do not use this as a production database. Split into existing domain tables/RPCs and audited server transactions. |

**Important qualification:** source inspection identifies credential-shaped literals; it does not prove that the values are active provider credentials. They must nevertheless be handled as exposed until their provenance is established. No credential value was copied into this report.

## 9. Updated candidate decision

`V6_CANDIDATE=SAFE_FOR_CONTROLLED_DEVELOPMENT_ONLY / NOT PRODUCTION READY`

Production cutover is blocked until all Section 8 findings are removed or replaced with verified backend behavior, the app has a complete semantic type-check/build/E2E pass, and the full Auth/RLS/tenant/finance/recovery gates are satisfied.
