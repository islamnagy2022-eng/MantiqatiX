# R6 Client API and Backend Route Reconciliation — 2026-11-08

**Status:** source inventory and contract classification. No API was deployed or connected by this document.

## Inventory method

A static scan of the extracted original `bizcatalog-manager (6).zip` archive found:

- **63 Express server route declarations** in `server.ts`.
- **67 client-side fetch/EventSource call sites** under `src/`.
- The client calls are not all unique endpoints; dynamic resource IDs and repeated call sites contribute to the count.
- The archive’s server is a local JSON-file backend, not the existing MantiqaTix Supabase backend.

## 1. Server route inventory

| Domain | R6 Express routes | Existing MantiqaTix target | Decision |
|---|---|---|---|
| Health | `GET /api/health` | Existing deployment health/monitoring path, not a business API | Replace with platform health endpoint; no R6 local server |
| Full state snapshot | `GET/POST /api/production-state` | None | **PROHIBITED**. Exposes and overwrites the local application snapshot |
| Businesses | `GET/POST /api/businesses`, `PUT/DELETE /api/businesses/:id` | `public-catalog-directory`, `public-catalog` for public reads; `catalog-admin` for scoped catalog/business operations where an approved action exists | Split public read vs authenticated scoped write; no generic endpoint |
| Products | `GET/POST /api/products`, `PUT/DELETE /api/products/:id` | Public item/price projection via the two public catalogue functions; approved item mutations via `catalog-admin` | Field/action-level mapping required; no direct local CRUD |
| Subscribers | `GET/POST /api/subscribers`, `PUT/DELETE /api/subscribers/:id` | Supabase Auth + `user_memberships`; platform subscriber listing via `catalog-platform-admin` where authorized | Identity and membership lifecycle only; no local subscriber/password CRUD |
| Sales | `GET/POST /api/sales` | No approved order/sales ledger mapping established in the pre-import contract baseline | **BLOCKED** pending order, ledger and audit contract |
| MantyGo | `GET /api/mantygo`, `POST /api/mantygo/sync` | Separate MantiGo module/backend contracts require their own review | **NOT MAPPED** in this R6 catalogue baseline |
| Wallet | `GET /api/wallets`, `POST /api/wallets/transaction` | Finance/wallet contract remains unreconciled | **BLOCKED** |
| Ads/campaigns | `GET/POST /api/ads`, `PUT/DELETE /api/ads/:id` | Public directory provider metadata only; no full campaign write contract established | Public projection may be read-only; campaign, budget and spend writes **BLOCKED** |
| Subscriptions/billing | `GET/POST /api/subscriptions`, `PUT /api/subscriptions/:id`, `GET /api/billing/status`, `POST /api/billing/run-sweep`, `POST /api/billing/toggle-autorenew`, `POST /api/billing/pay-subscription` | Existing membership and server-side billing/finance work remains separate and not certified | **BLOCKED** pending exact schema, server action and financial E2E |
| Contact | `GET/POST /api/contact`, `PUT/DELETE /api/contact/:id` | No confirmed R6-compatible contact/message contract in the reviewed baseline | **NOT MAPPED**; protect personal data and abuse/reporting controls |
| Member messages | `GET/POST /api/messages`, `PUT/DELETE /api/messages/:id` | No approved message schema/Edge contract established here | **NOT MAPPED**; disabled as production writes |
| Image generation | `POST /api/generate-image` | `ai-gemini-proxy` for the specific supported `generate_catalog_image` action | Adapt only the supported proxy action; do not port Gemini secrets or generic local routes |
| Notifications | `GET/POST /api/notifications` | No complete R6 notification event/delivery contract established | **NOT MAPPED** until event ownership, preferences, privacy and delivery behavior are defined |
| AI Studio assistant/autopilot | `POST /api/ai-studio-assist`, `POST /api/ai-autopilot/execute` | No equivalent general-purpose production action established in baseline | **NOT MAPPED**; draft/sandbox only until auth, quotas, approvals and side-effect controls exist |
| Paymob/payment | `GET /api/payments/history`, `POST /api/payments/paymob/intention`, `POST /api/payments/paymob/webhook` | No approved R6 payment flow; global finance gate remains blocked | **BLOCKED**. Do not port local intent, webhook, history or billing flow |
| Realtime | `GET /api/realtime/stream` | Potentially Supabase Realtime, but no channel/auth contract mapped for these R6 events | **NOT MAPPED** until event and tenant/branch channel boundaries are defined |
| Uploads | `GET/POST /api/uploads` | Supabase Storage may be an option; bucket, object ownership, MIME, limits and signed URL policies not mapped | **NOT MAPPED** pending storage/RLS contract |
| WhatsApp dispatch | `GET /api/whatsapp/logs`, `POST /api/whatsapp/dispatch` | Existing source does not establish a verified, approved R6 WhatsApp dispatch action | **NOT MAPPED** pending consent, provider credentials, server-side authorization, quotas and audit |
| R6 session token | `POST /api/auth/session-token`, `POST /api/auth/verify-token` | Supabase Auth + server-verified `api GET /api/v1/me` and active `user_memberships` | **REPLACE**; never mint role from request-body values |
| Security audit | `GET /api/security/audit-logs`, `POST /api/security/run-scan` | Current platform audit/security code has separate authenticated boundaries | Do not import local audit data or report a scan as authoritative without actual server-side checks |
| Backups | `GET /api/backups`, `POST /api/backups/create`, `GET /api/backups/:id/download`, `POST /api/backups/restore`, `POST /api/backups/import` | Approved platform/provider backup and DR process | **PROHIBITED AS-IS**; no local JSON snapshot endpoints |
| Production phase status | `GET /api/production/phases-status` | No evidence contract tying these locally stored completion labels to actual release evidence | Replace with verified CI/release telemetry; all self-asserted completion states remain unverified |

## 2. Confirmed critical implementation findings in the R6 server

Static source inspection confirms:

1. `GET /api/production-state` returns the local state snapshot; `POST` merges caller-provided state into local persistence.
2. `POST /api/auth/session-token` accepts `role`, `userId` and `businessId` from request JSON, defaults the role to `super_admin`, and signs it without server-verifying the identity or membership first.
3. Backup listing, download, creation, restore and import handlers do not show a verified platform-admin membership guard in the route definitions examined.
4. Paymob webhook logic uses `hmacSignature || targetIntent.hmacSignature`; when the incoming signature is absent, the stored expected signature becomes the value being checked. A callback must be authenticated using the exact provider callback contract, not a signature supplied/stored by the application itself.
5. Sensitive handlers read and write local JSON state, and the archive’s environment example contains non-empty defaults for Gemini/API/session/HMAC/backup values. The cleanroom package replaces this environment file with blank placeholders and excludes the local server.
6. Core R6 state is also loaded/saved in browser `localStorage`; local storage cannot act as trusted identity, role, tenant, business or branch authority.

These are source-review findings, not runtime penetration-test results. Exact exploitability and any route-level mitigations not visible in the reviewed handlers must be verified separately; they are sufficient to prohibit importing or deploying this server as the production backend.

## 3. Approved reuse boundary in current MantiqaTix

| Use case | Existing contract | Guardrail |
|---|---|---|
| Public directory | `public-catalog-directory` GET | Published active production tenants/businesses, active providers/branches, reduced public fields and public availability |
| Public business catalogue | `public-catalog` GET | Valid business and optional branch, active business/provider/branch/items, current effective public prices |
| Identity | Supabase Auth | The signed-in user is an identity, not automatically a merchant/admin |
| User/membership bootstrap | `api GET /api/v1/me` + `user_memberships` | Active membership and tenant/business/branch scope; no request-body role trust |
| Merchant catalogue management | `catalog-admin` | Existing actions only; server verifies bearer token, membership, role, permissions and scope |
| Platform administration | `catalog-platform-admin` | Exact SUPER_ADMIN + PLATFORM full_control membership |
| AI catalog image | `ai-gemini-proxy` | Only the supported `generate_catalog_image` action; provider key stays server-side |

## 4. Required order of migration

1. Keep the original R6 archive unchanged as source evidence; use the sanitized cleanroom package for frontend review only.
2. Replace public directory reads with the public read-only projection and add mapping tests for business/provider/activity/specialty/branch/item/price/image visibility.
3. Replace local sign-in/session/role behavior with Supabase Auth and active membership bootstrap. Never derive role from R6 `AuthRole`, browser storage or a route parameter.
4. Route merchant/admin mutations through existing `catalog-admin` actions only after action-by-action capability and scope review.
5. Keep all sales/orders, bookings, wallets, billing, commissions, Paymob, messages, ads/spend, MantyGo mutations, WhatsApp dispatch, uploads, AI autopilot, backups and realtime events closed until their actual server contract and negative authorization tests exist.
6. Add isolated tests for cross-tenant, wrong-business, wrong-branch, inactive-membership, anonymous and role-escalation attempts.
7. Run exact-head build, route tests, E2E, accessibility, 390px mobile, PWA and static-hosting base-path checks before Preview.

## Final status

- Route inventory: **63 server declarations / 67 client call sites — PASS as static inventory**.
- Public directory/catalogue reuse: **existing main-source contracts found; R6 adapters not implemented**.
- Auth/membership reuse: **existing main-source contract found; R6 auth replacement not implemented**.
- Generic Express CRUD/API: **DO NOT IMPORT**.
- Finance/payment/wallet/booking/message/ads/backup/realtime/WhatsApp/autopilot writes: **BLOCKED / NOT MAPPED**.
- R6 source import to GitHub: **NOT DONE**.
- Production deployment: **NOT AUTHORIZED**.
- Overall platform: `BLOCKED / NOT CERTIFIED`.


## Additional P0 authorization finding

The R6 frontend includes a default `adminPassword: 'admin'` seed and direct quick-login calls using that same literal. `loginAsAdmin()` creates the local administrator role solely from this browser-held comparison. This must be removed rather than adapted. Platform administration must require verified Supabase Auth plus an active `SUPER_ADMIN` membership with platform scope and server-side enforcement.
