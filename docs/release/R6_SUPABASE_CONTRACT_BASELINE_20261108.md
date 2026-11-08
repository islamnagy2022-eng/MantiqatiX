# R6-to-Supabase Integration Baseline — 2026-11-08

**Status:** PRE-IMPORT CONTRACT BASELINE — NOT AN R6 FIELD MAP, NOT A DEPLOYMENT APPROVAL.

This document records the existing MantiqatiX backend contracts found in the current `main` source after documentation PR #692 merged at `74b8efc797ab189b0aa169622b861d94ee517c52`. It is groundwork for the approved `bizcatalog-manager (6).zip` (R6) import. R6 source bytes were not available to inspect in this session, so no claim is made that R6 property names or components have already been mapped.

## 1. Source files inspected

| Main-branch source | Blob SHA |
|---|---|
| `apps/catalog-frontend/src/lib/production.ts` | `91569747476959214452e4413e00f655774b83ba` |
| `apps/catalog-frontend/src/types/index.ts` | `bc34b7f3463ce0783d0019aa28b33098b8235a10` |
| `supabase/functions/public-catalog-directory/index.ts` | `4358be969335e36ba095a4fae25dd2bcf55e043d` |
| `supabase/functions/public-catalog/index.ts` | `a66e6bbb0a0f7bcd88bbb8c3e16b1575898ce1fd` |
| `supabase/functions/api/index.ts` | `48f49b775b6f590402a3505d8a6696882532d53c` |
| `supabase/functions/catalog-admin/index.ts` | `e07917748d4f710895ed43f99c35ddc64be470ac` |
| `supabase/functions/catalog-platform-admin/index.ts` | `adb7a0e8ac227fbe852bc70506756675593d26a1` |

These are Git blob identities for the inspected `main` source files, not Supabase deployed-version or live byte-parity attestations. Live Edge versions and schema must be freshly read before any deployment or migration decision.

## 2. Public directory read contract

**Existing entry point:** Supabase Edge Function `public-catalog-directory`, `GET` only (plus CORS `OPTIONS`). The current main source:
- Uses server-side Supabase service credentials; those credentials must never enter browser code.
- Selects ACTIVE production tenants and excludes test/isolation tenants.
- Includes ACTIVE businesses only when `settings.catalog_public_enabled === true` or the business is an official platform showcase.
- Requires an ACTIVE `marketing_provider_profiles` row for the public business record.
- Reads ACTIVE branches; catalogue-enabled businesses without an active branch are omitted.
- Reads ACTIVE `catalog_items` only for a public, operationally active catalogue. An item is included only when `metadata.catalog_public.is_available === true`.
- Reads ACTIVE, currently effective `catalog_item_prices` rows only when the matching item's public metadata explicitly has `show_price === true`. A hidden price must not be serialized as a numeric price.
- Returns a deliberately reduced public projection and marks the response `accessMode: PUBLIC_DIRECTORY_READ_ONLY`; it also reports `paymentsEnabled: false` per business.

**Source tables observed:** `tenants`, `businesses`, `marketing_provider_profiles`, `branches`, `catalog_items`, `catalog_item_prices`, and the narrowly sanitized `bizcatalog_platform_settings` `activityModuleOverrides` setting.

**Public business projection observed:** business ID/name/slug/code/category, activity group/category/classification/specialty codes, a reduced profile (bio, governorate, markaz, village, working hours, logo/cover, map URL, WhatsApp phone), provider kind/description/slug/verified/featured, active branches, selected branch, public items and visible prices, operational status and publication flags.

**R6 integration rule:** the imported R6 public directory and medical directory must consume this read-only projection through an adapter. Do not fetch all businesses/catalogue rows directly from the browser using a service key or privileged table grants. Do not infer owner verification from a business's mere presence in the public directory: use the provider's explicit verified field. Do not expose unpublished, inactive, test-tenant, unavailable, or quote-only numeric price data.

## 3. Public single-business catalogue contract

**Existing entry point:** Supabase Edge Function `public-catalog`, `GET` only (plus CORS `OPTIONS`), queried with `businessId` and optional `branchId`.

The current main source validates the UUID-shaped business ID and branch selector, requires an ACTIVE business with `catalog_public_enabled === true`, an ACTIVE provider profile and an ACTIVE selected branch. It returns a reduced business/provider/profile/branch projection, ACTIVE items, currently effective ACTIVE price rows and public item options. It filters quote-only items from numeric price and option-delta payloads. For products with stock tracking enabled, availability is derived from active warehouse stock balances minus reserved quantities; it does not publish the raw stock ledger to the public client.

**Observed source tables:** `businesses`, `marketing_provider_profiles`, `branches`, `catalog_items`, `catalog_item_prices`, `catalog_item_options`, `warehouses`, and `stock_balances`.

**R6 integration rule:** a public activity profile can call this adapter with a validated business ID and selected public branch. A quote-only service stays a quote request and must not be represented as a priced product. Public availability must not be fabricated from local seed data.

## 4. Authentication and membership contract

The current frontend creates a Supabase Auth client with persisted Auth session and token refresh. For signed-in bootstrap, `bootstrapProductionUser(user)` reads ACTIVE `user_memberships` for the authenticated Supabase user and derives the workspace role and scope from those membership rows. For a signed-out visitor it returns the public directory and a guest session, not demo subscriber credentials.

The existing `api` Edge Function:
- Requires an `Authorization: Bearer <access-token>` header for authenticated routes.
- Verifies the token with `auth.getUser(token)` using server-side credentials and rejects missing, invalid and anonymous users.
- `GET /api/v1/me` returns the authenticated user ID and ACTIVE membership rows containing `id, tenant_id, organization_id, business_id, branch_id, role, permissions, status`.

**R6 integration rule:** Supabase Auth establishes identity; an ACTIVE membership establishes the user's current tenant/business/branch scope and role. A role string supplied by R6 request JSON, query params, URL state, browser memory or localStorage is never authorization evidence. No client-side default role, seeded admin account or role restoration may be ported.

## 5. Authenticated catalogue/admin operations

The frontend's existing adapter calls `catalog-admin` and `catalog-platform-admin` Edge Functions. `catalog-admin` requires a Bearer token, verifies the Supabase user server-side, loads that user's ACTIVE memberships, and checks platform or tenant/business/branch scope before operating. The inspected source also applies role and permission checks for catalog reads versus mutations, blocks writes for frozen/inactive businesses, and scopes data access by tenant/business/branch.

The platform-admin contract requires a membership whose role is `SUPER_ADMIN`, has no business/branch scope, and carries `permissions.scope === PLATFORM` and `permissions.full_control === true`. The frontend's `callPlatformAdmin` wrapper is a transport adapter only; it does not grant platform-admin authority.

**R6 integration rule:** keep merchant/admin screens hidden or read-only until their exact R6 actions are mapped to an existing Edge Function action and that server action's role, permission and resource scope checks are verified. Never implement a frontend-only permission check as a substitute for server authorization.

## 6. R6 domain-to-backend mapping checklist

This is the mapping target to fill after the exact R6 archive is extracted. It is intentionally not marked complete.

| R6 domain/surface | Existing backend target | Initial integration boundary |
|---|---|---|
| Public home, activity directory, medical directory | `public-catalog-directory` | Public read-only, published projection only |
| Business/activity profile and public product/service list | `public-catalog` | Public read-only, validated business/branch |
| Sign-in, account and session | Supabase Auth + `api /api/v1/me` | Verified identity + ACTIVE membership; no client-held role |
| Owner/employee catalogue dashboard | `catalog-admin` (`CATALOG_READ` and approved mutation actions) | Closed until action-level authorization and scope mapping is complete |
| Platform admin | `catalog-platform-admin` | Closed until explicit platform membership and action permission are verified |
| Product/service price and stock display | `catalog_items`, `catalog_item_prices`, `catalog_item_options`, public catalogue projections | Only current ACTIVE price, branch-aware; quote-only items hide numeric prices |
| Orders, wallets, subscriptions, Paymob, settlements | Existing `api` and payment/finance Edge contracts | BLOCKED pending live schema/ACL reconciliation and coupled payment/finance E2E |
| AI image generation | `ai-gemini-proxy` | Server-side secret only; never embed provider API keys in the client |
| Mobile web UI | R6 `src/components/mobile/` + same approved adapters | Preserve route and layout; test 390px viewport independently |
| Native Android/Kotlin | Existing native project in repository history | Preserve independently; this archive is not a replacement for it |

## 7. Explicit non-mappings / prohibited shortcuts

- Do not connect R6's local `/api/production-state`, local JSON snapshot, backup/restore route or local CRUD endpoints to production.
- Do not port `localStorage` roles, seeded subscriber/admin credentials, request-supplied `userId`/`role`, or predictable JWT/Paymob fallback secrets.
- Do not expose service-role credentials, admin settings, private subscribers, wallets, ledger rows, messages, stock balances or backup artifacts through public adapters.
- Do not assume GitHub Pages can host the Express server bundled with R6. Separate static public frontend deployment from backend Edge APIs; any server-runtime requirement needs an explicitly approved hosting design.
- Do not enable orders, checkout, Paymob, wallet, subscription billing, commission posting or settlements merely because R6 contains a UI for them. The global finance/payment release gate remains independent and blocked.
- Do not add duplicate production tables or migrations to mirror R6 model names. Map to current schema first and use an isolated migration rehearsal for any required schema change.

## 8. Required work immediately after R6 upload becomes readable

1. Verify SHA-256 against `c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447`; inspect ZIP integrity and list every entry.
2. Preserve the archive unchanged as evidence. Extract only required source, UI assets, tests and lockfile. Exclude `.data/`, backups, `.env*`, keys/secrets, node_modules, build output and editor caches.
3. Inventory R6 types, routes, API calls, local storage keys, Express routes, server startup and all mobile components. Produce the exact R6 field-to-contract matrix; do not infer it from this pre-import document.
4. Implement an adapter boundary, starting with public directory/profile reads, and add explicit mapping tests for business, branch, activity taxonomy, provider verification, products/services, price visibility, images and availability.
5. Keep all writes/admin/finance surfaces disabled until their mapped server action has passing tenant/branch/RBAC negative tests.
6. Run R6 tests, lint, semantic TypeScript check, production build, public browser E2E, accessibility, secret scan, mobile viewport and PWA checks on one exact commit.
7. Deploy an isolated Preview only after safe source extraction and exact-head checks. Keep the current Pages root and `/legacy/` unchanged until separate release approval and tested rollback.

## 9. Verification boundaries for this document

- Verified from GitHub `main` source code as of commit `74b8efc797ab189b0aa169622b861d94ee517c52`.
- Not verified in this pass: exact current deployed Supabase Edge Function versions/source hashes, fresh live database schema/ACL, any production mutation, and any R6 source property or endpoint mapping.
- No source application code, Supabase configuration/data/schema, production deployment, Pages root, mobile source or Android source was modified by preparing this contract baseline.
- Overall release status remains `BLOCKED / NOT CERTIFIED`.
