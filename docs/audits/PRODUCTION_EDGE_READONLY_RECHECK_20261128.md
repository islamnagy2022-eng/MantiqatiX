# Production and Edge Read-only Recheck — 2026-11-28

## Scope and method

This report records a read-only verification of the connected Supabase Production project and selected deployed Edge Function entrypoints against the current GitHub source. No production migration, SQL write, Auth/RLS/GRANT mutation, Storage write, Edge deployment, payment, refund, wallet, payout, settlement, or customer/business-data mutation was performed.

Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`)  
Observed at: 2026-11-28 00:55 EET (2026-11-27 22:55 UTC)  
Application/source baseline recorded after RC930: `6581ba937f7075987bd1d6055412afb9a73ad44e`  
Latest read-only evidence-document commit recorded previously: `9aa0a4cca803f6d6d71ea06720fe9f15d23cb34f`

## Live database and migration identity

- Supabase project status: `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.155`.
- Live migration inventory: 310 rows; latest version `20261110150618`.
- The canonical source contract in `scripts/production/live-reconciliation-contract.mjs` contains 88 unique, strictly ordered required migration versions.
- Exact source-version intersection with the live migration ledger: **0/88**; 88 required IDs are absent as exact IDs.
- Three previously declared legacy aliases have their target ledger versions present while their source filename versions are absent:
  - `20261009010000 → 20261008222845` (RC424).
  - `20261027100000 → 20261027041411` (marketing contact).
  - `20261101150000 → 20261101140105` (directory permission evidence).
- The 2026-11-27 21:42 UTC read-only audit recorded exact SQL/blob alias comparisons and relevant physical effects for these three cases. Their formal reconciliation/repair states must not be silently treated as complete if the current manifest still says pending.
- Do not fabricate migration ledger entries, rewrite history, or replay the 88-version chain blindly against Production. A zero exact-ID match is an identity gap, not proof that every physical object is absent.

## Platform-root authorization

A fresh read-only PostgreSQL catalog query confirmed:

- `private.platform_admins` exists and is owned by `postgres`; RLS is enabled but FORCE RLS is disabled.
- `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public`; its body grants true for any ACTIVE `user_memberships` row whose role is `ADMIN` or `SUPER_ADMIN`. It does not consult the private platform-admin registry.
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER, owned by `postgres`, with `search_path=public, pg_temp`; its body delegates to `public.mnty_can('admin',NULL,NULL,NULL)`. It does not consult the private platform-admin registry.
- The helper blast radius remains 57 policy references for `is_platform_admin()` and five for `mnty_can_platform_admin()`, previously measured across 27 distinct tables combined (62 references).

This is a confirmed authorization design defect in the live helper definitions; it is not evidence that exploitation occurred or that a breach happened. Keep admin Edge deployments blocked until the ordered registry-backed migration, caller, policy, ACL and adversarial-test chain is released as one reviewed unit.

## Selected deployed Edge Function source comparison

The live project reports 42 active Edge Functions. Direct file-content comparison was performed for the deployed `index.ts` of these nine high-impact functions against the matching tracked file on current `main`:

| Function | Live version | `verify_jwt` | Entrypoint equal to current `main` |
|---|---:|---:|---|
| `catalog-admin` | 20 | false | NO |
| `catalog-platform-admin` | 23 | true | NO |
| `payment-intent` | 8 | true | NO |
| `paymob-webhook` | 10 | false | NO |
| `order-create` | 8 | true | NO |
| `financial-journal` | 3 | true | NO |
| `subscription-payment-intent` | 4 | true | NO |
| `digital-page-payment-intent` | 5 | true | NO |
| `settlement-financial-atomic` | 4 | true | NO |

For `settlement-financial-atomic`, the additional deployed `deno.json` did match the tracked source; its entrypoint did not. This is a direct source-bundle drift finding for the inspected files, not by itself proof of a specific runtime exploit. It does mean current-main code cannot be assumed to be what Production is executing.

Do not deploy any of these functions individually. Their current source references database RPCs, migration effects, permissions and security helpers that are not yet proven live. Reconcile the full function file set, import-map/dependency locks, environment contracts, exact RPC signatures, ACL/RLS requirements and deployed positive/negative tests before any coordinated release.

`directory-listings` remains active v18 and is intentionally fail-closed. Do not re-enable unclaimed-directory listings or contact disclosure until the source-permission and owner-consent schema/RPC/ACL/RLS plus complete Edge bundle have passed the required tests.

## Required physical-object contract read-back

A separate read-only SQL catalog probe checked the 79 entries in the three canonical arrays `REQUIRED_CORE_OBJECTS`, `REQUIRED_PAYMENT_CONTRACT_OBJECTS`, and `REQUIRED_CONTROL_CENTER_OBJECTS`. The check used exact `to_regprocedure` resolution for declared function signatures, relation/index resolution for two-part names, and column/trigger catalog checks for three-part names.

| Contract group | Required | Matched by name/signature | Missing or non-matching |
|---|---:|---:|---:|
| Core objects | 32 | 11 | 21 |
| Payment contracts | 14 | 3 | 11 |
| Control-center objects | 33 | 23 | 10 |
| **Total** | **79** | **37** | **42** |

This is a source-contract presence check only. A mismatch can mean an absent object, a different overload/name, or a missing required column/index/trigger; it does not prove that every related physical effect is absent. It does not certify ACLs, RLS predicates, object owners, runtime behavior, or atomicity. Those require separate exact definition/privilege and adversarial behavior checks.

Selected critical non-matches include the provider-order claim/finalizer RPCs, MantiGO verified-payment processor, provider/subscription payment failure and success overloads, financial journal backend RPC, journal idempotency indexes, ERP purchase-order lines/constraints, payment-intent uniqueness index, subscription provider-creation state and encrypted client-secret columns, marketing-service image provenance columns/default-image function/triggers, and the null-safe user-membership uniqueness index. Keep these dependencies fail-closed; do not hand-create or hot-patch them in Production.

Missing contract entries by group:

- **Core (21):** `claim_subscription_provider_intent_creation_backend`, `create_purchase_order_with_lines_backend`, `create_subscription_payment_intent_claimable_backend`, `erp_purchase_order_lines`, `erp_purchase_order_lines_scope_idx`, `erp_purchase_orders_business_order_number_uidx`, `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)`, `journal_entries_tenant_entry_number_uidx`, `journal_entry_lines_entry_line_uidx`, `mantigo_payment_provider_events`, `post_financial_journal_atomic_backend`, `process_verified_mantigo_payment_backend`, `process_verified_provider_payment_failure`, `process_verified_subscription_payment_backend`, `process_verified_subscription_payment_failure`, `receive_purchase_stock_atomic_backend`, `receive_purchase_stock_with_order_line_backend`, `review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)`, `set_purchase_order_lines_backend`, `smm_wallet_transactions_reference_type_uidx`, `uq_payment_intents_one_active_per_order`.
- **Payment (11):** `claim_subscription_provider_intent_creation_backend(uuid,uuid)`, `create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)`, `process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)`, `process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)`, `process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)`, `process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)`, `subscription_payment_intents.client_secret_ciphertext`, `subscription_payment_intents.client_secret_iv`, `subscription_payment_intents.client_secret_key_version`, `subscription_payment_intents.provider_creation_claimed_at`, `subscription_payment_intents.provider_creation_state`.
- **Control center (10):** `businesses.mnty_business_default_images`, `catalog_items.mnty_catalog_item_default_image`, `marketing_services.image_source`, `marketing_services.image_url`, `marketing_services.mnty_marketing_service_default_image`, `mnty_default_business_images_trigger`, `mnty_default_catalog_item_image_trigger`, `mnty_default_image_url`, `mnty_default_marketing_service_image_trigger`, `ux_user_memberships_user_business_branch_nullsafe`.

## Website and monitoring status

- The latest recorded Pages deployment and deployed-origin browser checks passed for the root catalog, `/legacy/`, `/v6-preview/`, catalog routes, dashboard desktop/mobile, QR and activity-share accessibility.
- The associated Production Health Monitor reported the protected Edge `/health` endpoint as **NOT CHECKED** because `HEALTH_MONITOR_TOKEN` was missing. A successful website/legacy database probe is not evidence that protected Edge health was checked.

## Complete public-schema SECURITY DEFINER inventory

A fresh read-only `pg_proc` + effective EXECUTE privilege inventory over all 149 public-schema SECURITY DEFINER functions found:

| Measure | Count |
|---|---:|
| Public SECURITY DEFINER functions | 149 |
| Effective EXECUTE for `authenticated` | 65 |
| Effective EXECUTE for `anon` | 1 |
| Empty function-level `search_path` | 28 |
| Non-empty explicit `search_path` | 121 |
| Unset function-level `search_path` | 0 |

Among the 65 authenticated-executable functions, 18 have an empty path and 47 have a non-empty path. All 149 inspected functions are owned by `postgres`. The only anon-executable function is `public.get_mnty_targeted_advertisements(...)`, and its path is empty. It is a documented public ad-read contract and must be checked against its allowlisted projection and predicates rather than blindly revoked.

These are aggregate exposure counts, not a declaration that all 65 routines are unsafe. A non-empty path may still be defensible when the function body is schema-qualified and all referenced schemas are trusted; each routine requires body, caller, tenant/auth, grants and intended-audience classification. A separate focused sample found eight shared SECURITY DEFINER helper/caller routines using non-empty paths; only `mnty_can_platform_admin()` in that sample was directly authenticated-executable. Do not mass-revoke or mass-alter function paths.

The current Supabase Security Advisor snapshot returned 166 findings total (157 WARN, 9 INFO): 90 anonymous-Auth policy warnings, 65 authenticated SECURITY DEFINER warnings, one anon SECURITY DEFINER warning, nine RLS-enabled/no-policy INFO, and leaked-password protection disabled. Advisor categories are signals for predicate-by-predicate review; anonymous Auth-session policies are not equivalent to raw anon-role grants.

## Release blockers and operating decisions

1. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.
2. Owner-controlled encrypted Production database and Storage exports, integrity/retrieval proof, Auth/Vault recovery coverage, independent PostgreSQL 17 restore/rollback and measured RPO/RTO remain NOT VERIFIED. Disposable CI replay is not a Production backup/restore drill.
3. Finish the complete 88-version source-to-ledger/alias/physical-effect reconciliation and database/RPC/ACL/RLS dependency closure.
4. Correct platform-root registry enforcement only through the coordinated ordered migration/caller/policy release, after its required backup and exact-head adversarial tests.
5. Reconcile all critical Edge source bundles and their database dependencies; do not ship a partial admin/payment deployment.
6. Keep payment, webhook, wallet, payout, settlement, and customer-data operations blocked until signed sandbox tests and finance/journal/idempotency/rollback evidence pass.
7. Keep the Menoufia-specific catalog and OSM-candidate work permanently cancelled. Use only the existing `Activity → Specialty` sections; newly added unverified records must remain hidden `DRAFT / UNVERIFIED` until independently verified.
8. Do not edit `docs/SESSION_LOG.md` in this audit update.

## Evidence boundaries

This report records source and metadata reads only. It does not claim that all 88 migrations' physical effects are absent, that all 42 Edge Functions were byte-compared, that payments are safe, that a Production backup exists, or that the platform is launch-certified.
