# Required 63-Migration Source/Object Crosswalk — 2026-11-19

**Repository baseline:** `ab93522aed69fca49ea151cbd8dcb6bd1def2864`  
**Live Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Evidence:** canonical `scripts/production/live-reconciliation-contract.mjs`, `docs/release/production-migration-reconciliation.json`, current `supabase/migrations/` tree, and read-only live object inventory.

## Executive result

- Required release source identifiers: **63**.
- Required source files found in current main: **63/63**.
- Live migration ledger: **310** rows through `20261110150618`.
- Exact required identifiers in the live ledger: **0/63**.
- Physical-object contract: **60** objects; 30 present and 30 absent.
- Semantic object state: 28 PASS / 32 BLOCKED.
- This crosswalk is a source/object index, not proof that a migration's effect is absent merely because its exact version is absent. Physical objects may be supplied by prior migrations, aliases or forward repairs.

## Required migration crosswalk

| Required source version | Source file | Release identifier | Current physical-object contract |
|---|---|---|---|
| `20261009120000` | `20261009120000_rc425_atomic_mantigo_paymob_payment.sql` | RC425 | BLOCKED/MIXED | `public.mantigo_payment_provider_events` (BLOCKED)<br>`public.process_verified_mantigo_payment_backend` (BLOCKED) |
| `20261009130000` | `20261009130000_rc426_digital_page_provider_order_binding.sql` | RC426 | BLOCKED/MIXED | `public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)` (BLOCKED) |
| `20261009140000` | `20261009140000_rc427_one_active_payment_intent_per_order.sql` | RC427 | BLOCKED/MIXED | `public.uq_payment_intents_one_active_per_order` (BLOCKED) |
| `20261009150000` | `20261009150000_rc428_atomic_provider_failure_webhook.sql` | RC428 | BLOCKED/MIXED | `public.process_verified_provider_payment_failure` (BLOCKED) |
| `20261009160000` | `20261009160000_rc429_atomic_subscription_failure_webhook.sql` | RC429 | BLOCKED/MIXED | `public.process_verified_subscription_payment_failure` (BLOCKED) |
| `20261009170000` | `20261009170000_rc430_atomic_subscription_success_webhook.sql` | RC430 | BLOCKED/MIXED | `public.process_verified_subscription_payment_backend` (BLOCKED) |
| `20261009180000` | `20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql` | RC431 | BLOCKED/MIXED | `public.process_verified_digital_page_payment_backend` (BLOCKED) |
| `20261009190000` | `20261009190000_rc432_smm_wallet_transaction_idempotency.sql` | RC432 | BLOCKED/MIXED | `public.smm_wallet_transactions_reference_type_uidx` (BLOCKED) |
| `20261009200000` | `20261009200000_rc434_atomic_erp_purchase_receiving.sql` | RC434 | BLOCKED/MIXED | `public.receive_purchase_stock_atomic_backend` (BLOCKED) |
| `20261009210000` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | RC435 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261009220000` | `20261009220000_rc436_atomic_financial_journal.sql` | RC436 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261009230000` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | RC437 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261009240000` | `20261009240000_rc438_purchase_order_creation_with_lines.sql` | RC438 | BLOCKED/MIXED | `public.create_purchase_order_with_lines_backend` (BLOCKED)<br>`public.update_purchase_order_status_backend(varchar,varchar)` (BLOCKED) |
| `20261010010000` | `20261010010000_rc439_encrypted_checkout_recovery.sql` | RC439 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010020000` | `20261010020000_rc440_exposed_security_definer_search_path.sql` | RC440 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010030000` | `20261010030000_rc441_platform_admin_scope_hardening.sql` | RC441 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010060000` | `20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql` | RC446 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010120000` | `20261010120000_rc442_approval_action_audit_atomicity.sql` | RC442 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010140000` | `20261010140000_rc444_crm_business_scope_rls.sql` | RC444 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010150000` | `20261010150000_rc447_matrimony_profile_privacy_boundary.sql` | RC447 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010161000` | `20261010161000_rc448_matrimony_request_lifecycle_authority.sql` | RC448 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010170000` | `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql` | RC449 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010175000` | `20261010175000_rc449a_financial_journal_schema_prerequisites.sql` | RC449A | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010180000` | `20261010180000_rc450_financial_journal_service_role_boundary.sql` | RC450 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010200000` | `20261010200000_rc451_targeted_ads_empty_search_path.sql` | RC451 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010210000` | `20261010210000_rc452_marketing_crm_tenant_scope.sql` | RC452 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261010220000` | `20261010220000_rc453_marketing_campaign_backend.sql` | RC453 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261011010000` | `20261011010000_rc456_smm_service_role_access_boundary.sql` | RC456 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261014230000` | `20261014230000_rc525_digital_page_product_platform_admin_scope.sql` | RC525 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261023020000` | `20261023020000_rc102_provider_services_owner_write_grants.sql` | RC102 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261023030000` | `20261023030000_rc103_order_status_branch_scope.sql` | RC103 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261023040000` | `20261023040000_rc104_order_idempotency_scope.sql` | RC104 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261023050000` | `20261023050000_rc105_order_create_service_role_identity.sql` | RC105 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261023060000` | `20261023060000_rc106_order_status_service_role_identity.sql` | RC106 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261027030000` | `20261027030000_rc113_super_admin_control_center_foundation.sql` | RC113 | BLOCKED/MIXED | `public.mnty_platform_admin_assign_custom_role` (PASS)<br>`public.mnty_platform_admin_list_custom_roles` (PASS)<br>`public.mnty_platform_admin_upsert_custom_role` (PASS)<br>`public.platform_custom_roles` (PASS)<br>`public.platform_role_assignments` (PASS)<br>`public.platform_role_assignments_active_unique` (PASS)<br>`public.platform_role_assignments_user_scope_idx` (PASS)<br>`public.ux_user_memberships_user_business_branch_nullsafe` (BLOCKED) |
| `20261027040000` | `20261027040000_rc114_business_employee_hiring_system.sql` | RC114 | PASS | `public.business_employees` (PASS)<br>`public.business_employees_business_status_idx` (PASS)<br>`public.business_employees_email_per_business_unique` (PASS)<br>`public.business_employees_user_active_idx` (PASS)<br>`public.business_job_positions` (PASS)<br>`public.business_job_positions_business_active_idx` (PASS)<br>`public.mnty_business_employee_position_upsert` (PASS)<br>`public.mnty_business_employee_upsert` (PASS) |
| `20261027050000` | `20261027050000_rc115_control_center_integration.sql` | RC115 | PASS | `public.mnty_business_employee_list` (PASS)<br>`public.mnty_business_employee_position_upsert` (PASS)<br>`public.mnty_business_employee_upsert` (PASS)<br>`public.mnty_platform_admin_list_audit` (PASS)<br>`public.mnty_platform_admin_list_people` (PASS)<br>`public.mnty_platform_admin_list_role_assignments` (PASS)<br>`public.mnty_platform_has_permission` (PASS) |
| `20261027060000` | `20261027060000_rc116_business_subscriber_admin.sql` | RC116 | PASS | `public.mnty_platform_admin_list_businesses` (PASS)<br>`public.mnty_platform_admin_manage_business` (PASS)<br>`public.mnty_platform_admin_manage_membership` (PASS) |
| `20261027070000` | `20261027070000_rc117_default_images_and_activity_admin.sql` | RC117 | BLOCKED/MIXED | `public.businesses.mnty_business_default_images` (BLOCKED)<br>`public.catalog_items.mnty_catalog_item_default_image` (BLOCKED)<br>`public.marketing_services.image_source` (BLOCKED)<br>`public.marketing_services.image_url` (BLOCKED)<br>`public.marketing_services.mnty_marketing_service_default_image` (BLOCKED)<br>`public.mnty_default_business_images_trigger` (BLOCKED)<br>`public.mnty_default_catalog_item_image_trigger` (BLOCKED)<br>`public.mnty_default_image_url` (BLOCKED)<br>`public.mnty_default_marketing_service_image_trigger` (BLOCKED)<br>`public.mnty_platform_admin_list_businesses` (PASS)<br>`public.mnty_platform_admin_manage_business` (PASS) |
| `20261027090000` | `20261027090000_rc113_user_membership_business_scope_idempotency.sql` | RC113 | BLOCKED/MIXED | `public.mnty_platform_admin_assign_custom_role` (PASS)<br>`public.mnty_platform_admin_list_custom_roles` (PASS)<br>`public.mnty_platform_admin_upsert_custom_role` (PASS)<br>`public.platform_custom_roles` (PASS)<br>`public.platform_role_assignments` (PASS)<br>`public.platform_role_assignments_active_unique` (PASS)<br>`public.platform_role_assignments_user_scope_idx` (PASS)<br>`public.ux_user_memberships_user_business_branch_nullsafe` (BLOCKED) |
| `20261027093000` | `20261027093000_add_qadam_alsaad_homewares_store.sql` | — | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261031100000` | `20261031100000_rc463_trigger_only_security_definer_acl.sql` | RC463 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261113214500` | `20261113214500_rc464_platform_admin_live_registry_hardening.sql` | RC464 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261113220000` | `20261113220000_rc464b_orders_select_policy_preflight.sql` | RC464B | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261114010000` | `20261114010000_rc465_orders_read_scope_hardening.sql` | RC465 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261114020000` | `20261114020000_rc466_business_branch_read_scope_hardening.sql` | RC466 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261115010000` | `20261115010000_rc467_commission_scope_hardening.sql` | RC467 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261115030000` | `20261115030000_rc468_digital_page_payment_claim_hardening.sql` | RC468 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261117010000` | `20261117010000_rc469_shared_platform_admin_caller_search_path.sql` | RC469 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261117020000` | `20261117020000_rc470_digital_page_webhook_forward_repair.sql` | RC470 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261117190000` | `20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` | RC471 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118010000` | `20261118010000_rc472_directory_claim_review_atomicity.sql` | RC472 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118020000` | `20261118020000_rc473_directory_listing_contact_consent.sql` | RC473 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118030000` | `20261118030000_rc474_payment_intent_business_branch_scope.sql` | RC474 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118040000` | `20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql` | RC475 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118050000` | `20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql` | RC476 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118060000` | `20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql` | RC477 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118070000` | `20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql` | RC478 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118190000` | `20261118190000_rc479_revoke_anon_provider_profile_base_read.sql` | RC479 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118210000` | `20261118210000_rc480_digital_pages_anon_column_boundary.sql` | RC480 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261118220000` | `20261118220000_rc481_legal_edge_service_role_column_grants.sql` | RC481 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261119020000` | `20261119020000_rc482_legal_platform_admin_registry_guard.sql` | RC482 | NO_DIRECT_OBJECT_CONTRACT | — |
| `20261119030000` | `20261119030000_rc483_atomic_legal_cms_create_audit.sql` | RC483 | NO_DIRECT_OBJECT_CONTRACT | — |

## Explicit source aliases

The following source files are aliases of existing Production ledger entries. They must not be executed again as new migrations and must not be inserted as synthetic ledger rows.

| Source version | Source file | Existing ledger version | Evidence | Formal ledger repair |
|---|---|---|---|---|
| `20261009010000` | `supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql` | `20261008222845` | EXACT_STATEMENT_ALIAS | SOURCE_ALIAS_CONFIRMED_LEDGER_REPAIR_PENDING |
| `20261027100000` | `supabase/migrations/20261027100000_mantiqatix_marketing_contact_details.sql` | `20261027041411` | EXACT_SOURCE_BLOB_ALIAS | SOURCE_ALIAS_CONFIRMED_LEDGER_REPAIR_PENDING |

**Alias repair state:** 0/2 formal ledger repairs applied. Source alias effects are confirmed; the existing ledger identities remain preserved.

## How to interpret the object column

- `PASS` means the listed object was physically observed and its current manifest status is PASS; it does not certify every runtime, ACL or caller contract.
- `BLOCKED/MIXED` means at least one linked object is absent or fails the current contract. For example, RC425–RC438 include absent payment/finance/ERP functions or indexes.
- `NO_DIRECT_OBJECT_CONTRACT` means the 60-object manifest does not list an object directly under that migration's RC label. It does **not** mean the migration has no effect. Its SQL, caller contracts, RLS/ACL/search_path effects and dependencies still require source review and disposable replay.

## Critical dependency clusters

1. **Payments and subscriptions (RC425–RC431, RC435, RC439, RC470, RC475):** provider-order correlation, idempotency, atomic success/failure webhooks, subscription intent claims, encrypted checkout recovery and deployed webhook parity. Do not enable payments until the live database and Edge bundles converge and Paymob sandbox adversarial tests pass.
2. **Finance and ERP (RC432, RC434, RC436–RC438, RC449A, RC450):** wallet transaction idempotency, atomic journal posting, purchase order lines/receiving, schema prerequisites and service-role boundary. Live physical objects remain incomplete.
3. **Platform authority (RC441, RC449, RC464, RC469, RC471, RC482):** protected platform-admin registry, exact caller authorization, SECURITY DEFINER search_path and legal/platform admin boundaries. Issue #852 records the live shared-helper P0.
4. **Orders and tenant scope (RC102–RC106, RC444, RC465–RC467):** provider owner writes, order branch scope/idempotency/service identity, CRM scope and commission scope.
5. **Directory/privacy/legal (RC446–RC448, RC472–RC473, RC477–RC483):** MantiGO privacy, matrimony privacy/lifecycle, directory claim/consent, legal Edge column grants, legal platform registry and atomic Legal CMS audit.

## Release controls

1. Resolve all 63 source/alias/physical-effect rows with exact SQL statement/blob evidence and dependency order.
2. Complete chronological replay from the captured Production schema checkpoint in disposable PostgreSQL 17, including negative tests and repeat application/idempotency.
3. Obtain a verified encrypted offsite Production backup and isolated restore rehearsal with measured RPO/RTO and rollback evidence.
4. Apply migrations only through the reviewed release process; do not repair history by inventing ledger rows.
5. Recheck every physical object, function body, owner, EXECUTE ACL, RLS policy, search_path, Edge version/source hash and live end-to-end behavior.
6. Keep full platform status **BLOCKED / NOT CERTIFIED** until all gates pass.

**Production mutations during this crosswalk:** none.
