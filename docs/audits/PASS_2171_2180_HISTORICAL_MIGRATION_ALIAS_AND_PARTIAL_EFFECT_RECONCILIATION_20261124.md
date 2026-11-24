# PASS 2171–2180 — Historical migration aliases and partial-effect reconciliation

**Date:** 2026-11-24, approximately 20:00 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Main baseline:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Method:** read-only comparison of exact stored SQL in `supabase_migrations.schema_migrations.statements[1]`, current/historical Git source blobs, relation/index/function catalogs and effective ACL metadata. No application, directory-contact, payment, journal or customer rows were read. No Production write was performed.

## 1. Exact source aliases confirmed

Three exact source aliases are now evidenced. They are already represented by existing Production ledger rows; do not replay them or rewrite migration history.

| Canonical source file/version | Existing Production ledger version/name | Evidence | Disposition |
|---|---|---|---|
| `20261009010000_rc424_atomic_digital_page_payment_webhook.sql` | `20261008222845` / `rc424_atomic_digital_page_payment_webhook` | Stored one-statement body is exactly 7,208 bytes and matches source byte-for-byte; source blob `49f46e3e159e6306534adbf61f626901c2d73488` | **EXACT SQL ALIAS — already recorded** |
| `20261027100000_mantiqatix_marketing_contact_details.sql` | `20261027041411` / `mantiqatix_marketing_contact_details` | Source blob identical to `20261027041411` source (`1b85c341c0c9329e71f4fdbf36f2f852687994aa`), one 1,114-byte stored statement exact match | **DUPLICATE SOURCE ALIAS — already recorded** |
| `20261101150000_directory_source_permission_evidence.sql` | `20261101140105` / `directory_source_permission_evidence` | One stored statement, 3,558 bytes; exact equality with current-main source blob `3f2e0a480d7234171c3ea5359a21d3451b92d150` | **EXACT SQL ALIAS — already recorded** |

No ledger repair was performed. The manifest alias count is updated to three confirmed aliases, with zero ledger repairs.

## 2. Historical baseline applied, but not full forward contract

These are not filename aliases. The named ledger versions exist and their stored SQL proves a baseline was applied. Later required release migrations add separate effects which are still missing or incompatible.

### A. Subscription payments — historical Phase 3.62

Ledger evidence:
- `20260921223349` / `phase_362_subscription_payments`: one stored statement, 9,920 bytes. It creates `subscription_tier_prices` and `subscription_payment_intents`, adds RLS/FORCE RLS, defines `create_subscription_payment_intent_backend` and `process_verified_subscription_payment`, plus their idempotency/provider indexes and owner-read policies.
- `20260921223417` / `phase_362_payment_provider_order_correlation`: one stored 242-byte statement adding `payment_intents.provider_order_id` and unique `uq_payment_intents_provider_order`.

Current physical evidence:
- Both subscription tables exist; `subscription_tier_prices` and `subscription_payment_intents` have RLS + FORCE RLS.
- The old `create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` and `process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean)` exist with empty search_path and service_role EXECUTE.
- `payment_intents.provider_order_id` and `uq_payment_intents_provider_order` are present and valid/unique.
- Newer RC435 claim RPCs `create_subscription_payment_intent_claimable_backend` / `claim_subscription_provider_intent_creation_backend` are absent; `provider_creation_state` and `provider_creation_claimed_at` are absent.
- RC439 encrypted secret fields `client_secret_ciphertext`, `client_secret_iv`, `client_secret_key_version` are absent.

**Classification:** historical base and provider-order correlation are present; RC435/RC439 forward contract is **PARTIALLY PRESENT / NOT RELEASE-COMPLETE**.

### B. ERP purchase receipts and orders — historical baseline

Ledger evidence:
- `20260926215401` / `erp_purchase_receipts_table_v1`: creates `erp_purchase_receipts`.
- `20260926215717` / `erp_purchase_receipts_table_v2`: second table definition/update for `erp_purchase_receipts`.
- `20260926215725` / `erp_purchase_receiving_function_v2`: defines legacy `receive_purchase_stock_backend`.
- `20260926220351` / `erp_purchase_order_authority_v1`: creates `erp_purchase_orders`, scope index and `create_purchase_order_backend`.

Current physical evidence:
- `erp_purchase_receipts` and `erp_purchase_orders` exist with RLS enabled; their old scope indexes are present and valid.
- `receive_purchase_stock_backend` and `create_purchase_order_backend` exist, but both remain `search_path=public`; service_role EXECUTE is false for both, and the latter's authenticated EXECUTE is also false.
- Newer `erp_purchase_order_lines` table is absent.
- RC437 `set_purchase_order_lines_backend` and `receive_purchase_stock_with_order_line_backend` are absent.
- RC434 `receive_purchase_stock_atomic_backend` is absent.
- RC438 `create_purchase_order_with_lines_backend` is absent; the RC438 unique business order-number index is also absent.

**Classification:** ERP receipts/order base exists; current atomic line-level purchasing/receiving contract is **PARTIALLY PRESENT / NOT RELEASE-COMPLETE**.

### C. Financial journal — historical RC159 baseline

Ledger evidence:
- `20260928123245` / `rc159_financial_journal_backend` contains one 4,424-byte stored statement defining `post_financial_journal_backend(uuid,jsonb,jsonb)`.

Historical source evidence:
- A prior source file was recovered from commit `bb777f13969f87a8228a6ee025292b47da4ea037` at `supabase/migrations/20260928170000_rc159_financial_journal_backend.sql`.
- That file is 4,267 bytes and does **not** byte-match the 4,424-byte statement in the live ledger. Do not assert this is an exact source alias.

Current physical evidence:
- The function exists, SECURITY DEFINER, but `search_path=public` and service_role EXECUTE is false.
- RC449A required journal columns `entry_number`, `total_debit`, `total_credit`, `posted_at`, `updated_at`, `reversed_by_entry_id`, and `journal_entry_lines.line_number` are absent.
- RC449A unique journal indexes are absent.
- The approved production sequence is **RC449A → RC450**. RC436's separate `post_financial_journal_atomic_backend` is absent and must not be used as a substitute.

**Classification:** old journal function is present, but source parity is unconfirmed and the current journal schema/service-role contract is **BLOCKED**.

### D. Public directory — historical baseline

Ledger evidence:
- `20261029051004` / `public_directory_listings_and_claim_requests` contains one 4,761-byte statement creating `public_directory_listings`, `directory_listing_claim_requests`, legacy indexes and `set_public_directory_updated_at()`.
- `20261101140105` / `directory_source_permission_evidence` is the exact alias detailed in section 1.

Current physical evidence:
- `public_directory_listings` and `directory_listing_claim_requests` exist with RLS + FORCE RLS; `directory_listing_claim_requests_one_open` exists and is valid/unique.
- The evidence registry exists with FORCE RLS and two valid indexes but has **zero rows**.
- The atomic RC472 review function `review_directory_listing_claim_atomic` is absent; the RC472 null-safe membership index is absent.
- The RC473 `directory_listing_contact_consents` table is absent.

**Classification:** directory tables and source-rights registry baseline exist, but claim review/contact consent has not been completed. The legacy Edge endpoint correctly remains fail-closed.

### E. Payment-provider history versus RC425/RC428–RC430

- Historical `payment_provider_events` exists with RLS + FORCE RLS and legacy `process_verified_provider_payment(...)` exists with service_role EXECUTE, but it remains `search_path=public`.
- Separate RC425 `mantigo_payment_provider_events` table and `process_verified_mantigo_payment_backend` RPC are absent.
- RC428/RC429/RC430 provider/subscription atomic failure/success RPCs are absent.

**Classification:** legacy generic provider processing exists; newer MantiGO + atomic failure/subscription flows are **NOT PRESENT**.

## 3. Forward repair (not an alias)

- Original RC451 source version `20261010200000` remains absent from the live ledger.
- Its search_path effect was applied through a distinct recorded forward repair `20261027223523_rc451_targeted_ads_search_path_forward_repair`.
- Manifest already records exact statement parity and post-repair function configuration for this forward repair. Keep it classified as **FORWARD REPAIR APPLIED**, not as an exact alias.

## 4. Current alias resolution summary

| Classification | Count | Meaning |
|---|---:|---|
| Exact SQL/source aliases confirmed | 3 | RC424, marketing contact details, directory source permission evidence |
| Ledger repairs applied | 0 | Historical migration IDs remain immutable |
| Partial historical baselines | 5 families | Subscription, ERP, journal, directory, generic payments |
| Distinct forward repair | 1 | RC451 target-ad search_path |
| Unresolved source/physical effects | Remaining 81-ID scope | Must continue per migration/object |

A missing exact source ID is not by itself a reason to reapply SQL. Conversely, the existence of a base table or old function is not proof the newer authorization, atomicity, scope, ACL, search_path or RLS contract is satisfied.

## 5. Next actions

1. Keep the three confirmed aliases in the reconciliation manifest without replay or ledger rewrite.
2. Keep the RC159 historical source mismatch unresolved until the exact stored statement's origin is recovered or the current live function is independently compared with an approved forward repair.
3. Continue the per-migration crosswalk beyond these five partial families, especially RC425–RC439, RC464–RC496 and RC921–RC924.
4. Keep all Production writes stopped until the complete 81-ID physical/alias matrix, encrypted backup/restore, Auth/Vault recovery, independent PostgreSQL 17 restore/rollback, measured RPO/RTO and explicit release approval pass.

**Production impact:** read-only ledger/catalog/source comparisons only. No ledger repair, SQL DDL/DML, permissions, Auth, RLS, Storage, Edge, payment, wallet, settlement or data changes occurred. **FULL_PLATFORM_GATE remains BLOCKED / NOT CERTIFIED.**
