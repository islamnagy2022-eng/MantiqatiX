# PASS 2061–2070 — Edge Dependency Closure Recheck
**Date:** 2026-11-24  
**Repository head inspected:** `9bb63466f7b0f2f3f3d454247662e2a911b0218a`  
**Production project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Scope:** read-only retrieval of nine deployed Edge Function bundles, current-main entrypoints and direct imports, plus read-only PostgreSQL catalog/ACL/column checks.  
**Disposition:** dependency inventory advanced; **no Edge function or Production object was changed or invoked**.

## Method and boundaries
- Retrieved deployed source and version metadata for nine launch-critical Edge Functions.
- Compared direct import specifiers, local module imports, table references and RPC names against current `main`.
- Queried only PostgreSQL catalogs, object existence, function metadata/ACLs, column existence and aggregate directory counts. No business rows, secrets, payment events or customer data were read.
- This is a **direct dependency inventory**, not full transitive bundle/import-map certification or behavioral E2E. The exact current-main source must still be replayed against the complete disposable PostgreSQL 17 release chain before any deployment.

## Deployed-to-source matrix

| Edge Function | Live version / JWT | Current-main direct dependency delta | Live database dependency finding | Release decision |
|---|---:|---|---|---|
| `catalog-admin` | v20 / false | Current main adds `mnty_can_platform_admin()` RPC and audit/tenant object use. Live v20 still contains a client-membership metadata predicate (`permissions.scope=PLATFORM` and `full_control=true`) as its platform-admin decision. | `mnty_can_platform_admin()` exists but remains SECURITY DEFINER with `search_path=public, pg_temp`; live implementation still delegates to a null-scope tenant helper. `is_platform_admin()` remains SECURITY INVOKER with `search_path=public`. | **BLOCKED P0.** Coordinate RC464/RC471/RC484/RC485 and all caller/policy dependencies. Do not deploy alone. |
| `order-create` | v8 / true | No direct local import delta; table and RPC names match at entrypoint level, but source differs materially (live 10,083 chars; main 13,988 chars). | Exact `create_order_backend(...)` signature exists; service_role EXECUTE=true, anon/authenticated=false, live `search_path=public`. | **BLOCKED P1.** Name-level parity is not body/contract parity. Require RC497/RC498 and order idempotency/authorization tests on exact head. |
| `paymob-webhook` | v10 / false | Current main removes direct `payment_provider_events` table use and routes additional success/failure paths through atomic RPCs. | Missing: `mantigo_payment_provider_events`, `process_verified_mantigo_payment_backend`, `process_verified_provider_payment_failure`, `process_verified_subscription_payment_backend`, `process_verified_subscription_payment_failure`. The older provider-payment RPC exists with service_role EXECUTE=true and `search_path=public`. | **BLOCKED P1.** Keep Paymob fail-closed until ordered RC425–RC430/RC475 schema, RPC, event-binding and replay tests pass. |
| `payment-intent` | v8 / true | Main adds `../_shared/paymob-intent-correlation.mjs` (amount/currency/reference/order/provider correlation) and no longer reads `user_memberships` directly. | `create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)` exists; SECURITY DEFINER, service_role EXECUTE=true, authenticated EXECUTE=true, anon=false, `search_path=public, pg_temp`. `payment_intents.provider_order_id` exists. | **BLOCKED P1.** Verify exact function body, pricing/correlation invariants and matching RC474/RC475 contracts before any deployment. |
| `subscription-payment-intent` | v4 / true | Main adds `paymob-intent-correlation.mjs` and `checkout-secret-crypto.mjs` (versioned encrypted checkout-secret handling). | Missing RPCs: `create_subscription_payment_intent_claimable_backend`, `claim_subscription_provider_intent_creation_backend`. Missing columns: `provider_creation_state`, `provider_creation_claimed_at`, `client_secret_ciphertext`, `client_secret_iv`, `client_secret_key_version`. | **BLOCKED P1.** RC435/RC439 and their concurrency/key-recovery tests must pass first. |
| `financial-journal` | v3 / true | Main calls `post_financial_journal_backend(uuid,jsonb,jsonb)`; live v3 calls legacy `post_financial_journal(jsonb,jsonb)`. | Both RPC names exist, but service_role EXECUTE=false for both. Backend RPC is SECURITY DEFINER with `search_path=public`. | **BLOCKED P1.** RC449A → RC450 schema/grant sequence and journal integration tests required; do not deploy. |
| `settlement-financial-atomic` | v4 / true | Main adds `./authorization.mjs`, explicit CORS import and registry-helper check; live bundle has only `index.ts` + `deno.json`. | `create_settlement_and_post_journal(...)` exists; service_role EXECUTE=true, anon/authenticated=false, but live `search_path=pg_catalog, public`. Registry helper remains legacy. | **BLOCKED P1.** RC464/RC471/RC494 scope and helper contracts must be coordinated and tested; no real settlements. |
| `business-register` | v9 / true | Main adds `mnty_can_platform_admin()` registry-gated administrative path; live source has no such RPC call. | `mnty_can_platform_admin()` exists but remains on the legacy helper definition and search path. | **BLOCKED P0/P1.** Coordinate platform-root repair and registration/approval RPC scope. |
| `directory-listings` | v18 / false | Main adds eight local modules: pagination, doctor import/output contracts, consent pagination, platform registry, release gate and publication rules. Live v18 is a 2,054-character fail-closed stub with no imports. | `directory_listing_contact_consents` absent; `directory_source_permission_evidence` exists but has **0 rows**; 869 stored rows have PUBLISHED status. The status does not establish republication rights or owner consent. | **KEEP FAIL-CLOSED.** RC472/RC473, owner consent, source-rights evidence and complete bundle must pass together. |

## Fresh Production metadata snapshot

| Check | Read-only result |
|---|---|
| Migration ledger | 310 rows; latest version `20261110150618` |
| Required release IDs | Previous current checkpoint: 0/79 exact IDs; physical effects still require alias/object reconciliation |
| Platform registry | `private.platform_admins` exists; RLS=true; FORCE RLS=false; owner=`postgres` |
| `is_platform_admin()` | Exists; SECURITY INVOKER; `search_path=public`; 57 policy references |
| `mnty_can_platform_admin()` | Exists; SECURITY DEFINER; `search_path=public, pg_temp`; 5 policy references |
| Directory consent | Contact-consent table absent; source-rights evidence table has 0 rows |
| Subscription checkout | Five claim/encrypted-secret columns and two claim RPCs absent |
| Financial journal | Backend RPC exists but service_role EXECUTE=false |
| Settlement RPC | Exists; service_role EXECUTE=true; `search_path=pg_catalog, public` |

## Shared source files found in current main

- Paymob correlation: `supabase/functions/_shared/paymob-intent-correlation.mjs`.
- Versioned checkout-secret crypto: `supabase/functions/_shared/checkout-secret-crypto.mjs`.
- Settlement authorization: `supabase/functions/settlement-financial-atomic/authorization.mjs`.
- Directory helpers: `pagination-filter.mjs`, `doctor-import-contract.mjs`, `public-directory-output-contract.mjs`, `consent-pagination.mjs`, `contact-consent-pagination.mjs`, `platform-admin-registry.mjs`, `release-gate.mjs`, `doctor-publication-contract.mjs`.

These modules are not present in the retrieved deployed bundles. Their source has been retrieved and direct import references checked; unit tests, import-map resolution and transitive dependencies remain to be checked.

## Safe next sequence
1. Complete platform-root migration ordering and PG17 adversarial tests (RC464 → RC471/RC484 → RC485 and dependent RC494); Production remains read-only.
2. Reconcile the exact 79 migration effects and aliases against the live schema before any forward replay or release.
3. Complete payment dependency tests: RC425–RC430, RC435/RC439, RC449A/RC450, RC474/RC475, plus RC497/RC498 for orders. Keep all real payment/settlement paths fail-closed.
4. Complete directory consent/source-rights schema, owner grant/revoke and privacy-negative tests; do not publish third-party directory data without evidence.
5. Finish transitive Edge import-map/bundle checks and verify every RPC owner, SECURITY DEFINER flag, search_path and EXECUTE ACL.
6. Deploy only complete, versioned DB + Edge dependency slices after encrypted backup/restore, rollback plan and release approval.

**Safety:** no Production migration, DDL/DML, Auth/RLS/GRANT, Storage, Edge deployment, payment, settlement, publication or customer-data mutation occurred. **FULL PLATFORM: BLOCKED / NOT CERTIFIED.**
