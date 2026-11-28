# Production 79-Object Contract Read-back — 2026-11-28

**Project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Database:** PostgreSQL 17.6.1.155  
**Method:** read-only catalog probe against the 79 exact entries in `scripts/production/live-reconciliation-contract.mjs`. It checks exact function signatures via `to_regprocedure`, columns via `information_schema.columns`, and table/index/trigger names via PostgreSQL catalogs. It does not invoke business RPCs or inspect every routine body, privilege, policy, ownership rule or runtime caller.

## Aggregate

| Contract group | Required | Found by exact probe | Not found by exact probe |
|---|---:|---:|---:|
| Core objects | 32 | 11 | 21 |
| Payment contract objects | 14 | 3 | 11 |
| Control-center objects | 33 | 23 | 10 |
| **Total** | **79** | **37** | **42** |

“Not found” means the probe did not resolve the exact name/signature/column/trigger/index contract. It is not a blanket statement that every associated feature or physical effect is absent. Each item still needs dependency, alias, body, ACL, RLS and caller reconciliation before a release decision.

The 42 not-found entries are counted by the three required-contract groups. Six payment RPC signatures are deliberately present in both the core and payment groups, so the list represents **36 unique object/signature names**. This overlap is expected and does not indicate six additional missing physical objects.

## Exact not-found entries and source mapping

### Core objects — 21

| Required object | Source file(s) containing the candidate definition | Read-back note |
|---|---|---|
| `public.claim_subscription_provider_intent_creation_backend(uuid,uuid)` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | RC435 claim/row-lock state transition. |
| `public.create_purchase_order_with_lines_backend` | `20261009240000_rc438_purchase_order_creation_with_lines.sql` | RC438 explicitly depends on RC437 line schema and line-aware receiving. |
| `public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | Service-role claimable create path. |
| `public.erp_purchase_order_lines` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | Purchase-order line table. |
| `public.erp_purchase_order_lines_scope_idx` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | Tenant/business/order scoped index. |
| `public.erp_purchase_orders_business_order_number_uidx` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | Duplicate business/order-number guard and unique index. |
| `public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)` | `20261009130000_rc426_digital_page_provider_order_binding.sql` | Five-argument provider-order-bound finalizer; the older four-argument overload is present live but is not an equivalent contract. |
| `public.journal_entries_tenant_entry_number_uidx` | `20261009220000_rc436_atomic_financial_journal.sql` | Unique tenant/entry-number index. |
| `public.journal_entry_lines_entry_line_uidx` | `20261009220000_rc436_atomic_financial_journal.sql` | Unique journal/line-number index. |
| `public.mantigo_payment_provider_events` | `20261009120000_rc425_atomic_mantigo_paymob_payment.sql` | MantiGO payment webhook event/idempotency table. |
| `public.post_financial_journal_atomic_backend` | `20261009220000_rc436_atomic_financial_journal.sql` | Atomic journal RPC candidate. This is distinct from the RC449A → RC450 live journal schema/service-role boundary sequence; it is not a substitute for that coordinated release. |
| `public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)` | `20261009120000_rc425_atomic_mantigo_paymob_payment.sql` | MantiGO verified-payment atomic processor. |
| `public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)` | `20261009150000_rc428_atomic_provider_failure_webhook.sql` | Provider failure processor. |
| `public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)` | `20261009170000_rc430_atomic_subscription_success_webhook.sql` | Subscription success processor. |
| `public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)` | `20261009160000_rc429_atomic_subscription_failure_webhook.sql` | Subscription failure processor. |
| `public.receive_purchase_stock_atomic_backend` | `20261009200000_rc434_atomic_erp_purchase_receiving.sql` | Core atomic receipt processor. Line-aware receiving additionally needs RC437. |
| `public.receive_purchase_stock_with_order_line_backend` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | Line-aware receipt path and cumulative received-quantity checks. |
| `public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)` | `20261118010000_rc472_directory_claim_review_atomicity.sql` | Atomic listing claim review and owner/business binding. |
| `public.set_purchase_order_lines_backend` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | Server-owned purchase-order line creation/update. |
| `public.smm_wallet_transactions_reference_type_uidx` | `20261009190000_rc432_smm_wallet_transaction_idempotency.sql` | SMM wallet transaction reference idempotency index. |
| `public.uq_payment_intents_one_active_per_order` | `20261009140000_rc427_one_active_payment_intent_per_order.sql` | One active payment-intent invariant per order. |

### Payment contract objects — 11

| Required object | Source file(s) containing the candidate definition | Read-back note |
|---|---|---|
| `public.claim_subscription_provider_intent_creation_backend(uuid,uuid)` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | Same RC435 claim function as the core contract list. |
| `public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | Creates READY claimable intents; not interchangeable with the old create RPC. |
| `public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)` | `20261009120000_rc425_atomic_mantigo_paymob_payment.sql` | Same RC425 processor as the core contract list. |
| `public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)` | `20261009150000_rc428_atomic_provider_failure_webhook.sql` | Same RC428 processor as the core contract list. |
| `public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)` | `20261009170000_rc430_atomic_subscription_success_webhook.sql` | Same RC430 processor as the core contract list. |
| `public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)` | `20261009160000_rc429_atomic_subscription_failure_webhook.sql` | Same RC429 processor as the core contract list. |
| `public.subscription_payment_intents.client_secret_ciphertext` | `20261010010000_rc439_encrypted_checkout_recovery.sql` | Encrypted checkout-secret field. |
| `public.subscription_payment_intents.client_secret_iv` | `20261010010000_rc439_encrypted_checkout_recovery.sql` | Encryption IV field. |
| `public.subscription_payment_intents.client_secret_key_version` | `20261010010000_rc439_encrypted_checkout_recovery.sql` | Key-version field for recoverable encrypted checkout. |
| `public.subscription_payment_intents.provider_creation_claimed_at` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | Claim timestamp. |
| `public.subscription_payment_intents.provider_creation_state` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | READY/CLAIMED/CORRELATED/reconciliation state. |

### Control-center objects — 10

| Required object | Source file(s) containing the candidate definition | Read-back note |
|---|---|---|
| `public.businesses.mnty_business_default_images` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Default-image trigger. |
| `public.catalog_items.mnty_catalog_item_default_image` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Catalog item trigger. |
| `public.marketing_services.image_source` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Image provenance column. |
| `public.marketing_services.image_url` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Marketing-service image column. |
| `public.marketing_services.mnty_marketing_service_default_image` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Marketing-service default-image trigger. |
| `public.mnty_default_business_images_trigger` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Default business images trigger function. |
| `public.mnty_default_catalog_item_image_trigger` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Default catalog item image trigger function. |
| `public.mnty_default_image_url` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Name/category-aware placeholder image selector. |
| `public.mnty_default_marketing_service_image_trigger` | `20261027070000_rc117_default_images_and_activity_admin.sql` | Default marketing-service image trigger function. |
| `public.ux_user_memberships_user_business_branch_nullsafe` | `20261118010000_rc472_directory_claim_review_atomicity.sql` | **Important correction:** RC472 itself contains a forward repair that creates this null-safe index because the original RC113 migration is absent from the live ledger. RC472 itself repairs the missing index and creates the claim-review RPC; do not describe RC113 as a runtime prerequisite that must be deployed separately. |

## Dependency and release interpretation

- The source files above are candidates in the repository, not proof of deployed production objects.
- RC425–RC439 payment/finance candidates are not individually releasable; maintain timestamp order, exact RPC overloads, service-role/client ACLs and Edge bundle dependency closure.
- RC436 atomic-journal objects are separate from the documented RC449A → RC450 financial-journal schema and service-role boundary release. Do not use RC436 presence/absence as a reason to grant legacy journal RPC access.
- RC437 requires the line schema, indexes and RLS before RC438 line-aware order creation; RC434's generic atomic receipt alone does not complete line-level purchasing.
- RC439 encrypted checkout recovery and RC435 provider creation claims must both be reconciled with the exact subscription Edge source and key-management boundary.
- RC117 creates the image columns/functions/triggers; the later `20261126020000_preserve_marketing_service_image_provenance.sql` preserves non-empty owner-provided images and fills only missing URLs. That repair does not independently create the missing schema.
- RC472 contains the forward null-safe membership index repair and atomic claim review; RC473 consent remains a separate required database + Edge boundary. Keep `directory-listings` v18 fail-closed until that complete coordinated contract is live and tested.
- A passing disposable chronological replay proves source compatibility in the fixture, not Production deployment or backup/restore.

## Safety

This was a metadata-only read-back. No Production SQL write/migration, grant, RLS, Auth, Storage, Edge deployment, payment, wallet, settlement or customer/business-data mutation was performed. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains in force.
