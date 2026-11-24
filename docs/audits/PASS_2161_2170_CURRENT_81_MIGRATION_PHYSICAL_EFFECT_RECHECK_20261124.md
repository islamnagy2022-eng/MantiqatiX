# PASS 2161–2170 — Current 81-migration physical-effect recheck

**Date:** 2026-11-24, approximately 19:45 UTC  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Repository main:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Method:** read-only SQL using `to_regclass`, `pg_class`, `pg_index`, `information_schema.columns`, `pg_proc`, `pg_get_function_identity_arguments`, `has_function_privilege` and function configuration metadata. No business or financial rows, profile data, secrets or payment records were read. No Production mutation was performed.

## 1. Migration ledger baseline

- Live ledger: **310 rows**.
- Latest version: `20261110150618`.
- Current exact source release contract: **81 required migrations**.
- Exact RC923 and RC924 identities are not recorded.
- Exact identifier absence is a ledger fact, not proof every intended physical effect is absent or safe to replay. The checks below classify selected physical objects independently.

## 2. Focused relation inventory

The current read-only query checked 18 high-value relations.

| Relation | Exists | RLS | FORCE RLS |
|---|---:|---:|---:|
| `public.business_employees` | Yes | On | On |
| `public.business_job_positions` | Yes | On | On |
| `public.digital_page_orders` | Yes | On | Off |
| `public.directory_listing_contact_consents` | **No** | — | — |
| `public.directory_source_permission_evidence` | Yes | On | On |
| `public.erp_purchase_order_lines` | **No** | — | — |
| `public.journal_entries` | Yes | On | On |
| `public.journal_entry_lines` | Yes | On | On |
| `public.mantigo_payment_provider_events` | **No** | — | — |
| `public.marketing_campaign_participants` | **No** | — | — |
| `public.marketing_campaigns` | **No** | — | — |
| `public.marketing_services` | Yes | On | On |
| `public.payment_intents` | Yes | On | On |
| `public.platform_custom_roles` | Yes | On | On |
| `public.platform_role_assignments` | Yes | On | On |
| `private.platform_admins` | Yes | On | **Off** |
| `public.settlement_transactions` | Yes | On | On |
| `public.subscription_payment_intents` | Yes | On | On |

Important distinctions:
- The platform-admin registry exists, but FORCE RLS is off.
- The source-rights evidence registry exists, but the separately rechecked row count is zero.
- The consent table, purchase-order-line table, MantiGO provider-event table and marketing-campaign tables are absent.

## 3. Focused index inventory

| Index | Exists / valid |
|---|---|
| `business_employees_email_per_business_unique` | Present / valid / unique |
| `business_employees_user_active_idx` | Present / valid |
| `platform_role_assignments_active_unique` | Present / valid / unique |
| `uq_payment_intents_one_active_per_order` | **Absent** |
| `smm_wallet_transactions_reference_type_uidx` | **Absent** |
| `journal_entries_tenant_entry_number_uidx` | **Absent** |
| `journal_entry_lines_entry_line_uidx` | **Absent** |
| `erp_purchase_orders_business_order_number_uidx` | **Absent** |
| `ux_user_memberships_user_business_branch_nullsafe` | **Absent** |
| `catalog_item_prices_item_branch_version_uidx` | **Absent** |
| `mantigo_bids_one_accepted_per_ride_idx` | **Absent** |
| `settlement_transactions_business_id_idx` | **Absent** |

These findings directly affect RC427, RC432, RC436, RC437/438, RC472, RC486, RC494 and RC496 invariants. Index presence was not treated as semantic pass without validity and uniqueness checks.

## 4. Column inventory

Two of 17 selected required columns are present; 15 are absent.

| Table.column | Live result |
|---|---|
| `payment_intents.provider_order_id` | Present |
| `digital_page_orders.provider_order_id` | Present |
| `subscription_payment_intents.provider_creation_state` | **Absent** |
| `subscription_payment_intents.provider_creation_claimed_at` | **Absent** |
| `subscription_payment_intents.client_secret_ciphertext` | **Absent** |
| `subscription_payment_intents.client_secret_iv` | **Absent** |
| `subscription_payment_intents.client_secret_key_version` | **Absent** |
| `journal_entries.entry_number` | **Absent** |
| `journal_entries.total_debit` | **Absent** |
| `journal_entries.total_credit` | **Absent** |
| `journal_entries.posted_at` | **Absent** |
| `journal_entries.updated_at` | **Absent** |
| `journal_entries.reversed_by_entry_id` | **Absent** |
| `journal_entry_lines.line_number` | **Absent** |
| `marketing_services.image_url` | **Absent** |
| `marketing_services.image_source` | **Absent** |
| `settlement_transactions.business_id` | **Absent** |

This confirms the RC435/RC439 subscription claim and encrypted-secret blockers, the RC436/RC449A financial journal schema gaps, the RC117 default-image gaps, and the RC494 business-scoped settlement field gap.

## 5. Function presence versus contract

The focused query examined 15 function families and exact overloads.

| Function family | Live result | Contract issue |
|---|---|---|
| `create_settlement_and_post_journal` | Present | `search_path=pg_catalog, public`; retain only as legacy until RC494 exact contract is met |
| `finalize_digital_page_payment_intent_backend` | Present, 4-argument overload | Required 5-argument form absent; service_role EXECUTE false |
| `post_financial_journal_backend(uuid,jsonb,jsonb)` | Present | service_role EXECUTE false; `search_path=public` |
| `process_verified_digital_page_payment_backend(...)` | Present | `search_path=public, pg_temp`; function body/ACL parity not certified |
| `process_verified_mantigo_payment_backend` | **Absent** | RC425 atomic payment RPC |
| `process_verified_provider_payment_failure` | **Absent** | RC428/RC475 |
| `process_verified_subscription_payment_backend` | **Absent** | RC430/RC475 |
| `process_verified_subscription_payment_failure` | **Absent** | RC429/RC475 |
| `create_subscription_payment_intent_claimable_backend` | **Absent** | RC435 |
| `claim_subscription_provider_intent_creation_backend` | **Absent** | RC435 |
| `create_purchase_order_with_lines_backend` | **Absent** | RC438 |
| `receive_purchase_stock_atomic_backend` | **Absent** | RC434 |
| `set_purchase_order_lines_backend` | **Absent** | RC437 |
| `post_financial_journal_atomic_backend` | **Absent** | RC436 is not the canonical RC449A → RC450 production path |
| `review_directory_listing_claim_atomic` | **Absent** | RC472 expected atomic claim-review RPC |

A function name or overload is not a pass. Owner, SECURITY DEFINER, search_path, exact signature, effective ACL, RLS/tenant scope and runtime behavior must all match. In particular, do not grant the legacy financial journal RPC as a workaround; the approved journal path is RC449A → RC450.

## 6. Relationship to the prior 76-object inventory

The earlier PASS 2091–2100 query (2026-11-24 13:12 UTC) evaluated 76 tracked physical contracts and found 35 present / 41 absent, with no change from the 2026-11-20 snapshot. This later focused query adds current evidence for additional payment, subscription, journal, settlement, directory and catalog contracts. The focused samples do not yet constitute a complete 81-migration object map; remaining policies, all function owners/ACLs, triggers, constraints, indexes, import consumers and known aliases still require coverage.

## 7. Required next actions

1. Extend the crosswalk from the current 76 historical contracts to every object effect across all 81 source migrations.
2. Classify each effect as exact-present, alias/effect-present, semantically incompatible, safe-to-replay, superseded/forward-fixed or blocked.
3. Verify exact function bodies and effective grants; do not use names alone.
4. Resolve the source-version aliases without rewriting migration history or fabricating ledger rows.
5. Keep production DDL/DML, RLS/GRANT, Auth, Storage, Edge, payment, wallet and settlement changes stopped until encrypted DB + Storage backup, retrieval/hash validation, Vault/Auth recovery, independent PostgreSQL 17 restore/rollback, measured RPO/RTO and release-owner approval all pass.

**Safety:** SELECT-only. No Production DDL/DML, migration, permissions, RLS, Auth, Storage, Edge, payment, settlement or application data was changed. Full platform remains **BLOCKED / NOT CERTIFIED**.
