# PASS 2231–2240 — Detailed 76-object Production presence read-back

**Date:** 2026-11-24
**Project:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu
**Method:** read-only PostgreSQL catalog checks using to_regclass, pg_proc/to_regprocedure, information_schema.columns, pg_trigger and schema catalogs. No application rows, personal data, secrets or financial payloads were read. No Production mutation occurred.

## Summary

| Type | Checked | Present | Absent |
|---|---:|---:|---:|
| FUNCTION | 41 | 22 | 19 |
| TABLE | 7 | 5 | 2 |
| INDEX | 13 | 6 | 7 |
| COLUMN | 12 | 2 | 10 |
| TRIGGER | 3 | 0 | 3 |
| **Total** | **76** | **35** | **41** |

Presence does not certify function signature/body, owner, SECURITY DEFINER mode, search_path, effective EXECUTE ACL, RLS/FORCE RLS, policy expression, uniqueness/validity or runtime behavior. The known present-but-contract-blocked objects remain blocked.

## Object-level results

| Migration family | Object | Kind | Physical presence |
|---|---|---|---|
| CURRENT_RECHECK | public.claim_subscription_provider_intent_creation_backend | FUNCTION | ABSENT |
| CURRENT_RECHECK | public.create_subscription_payment_intent_claimable_backend | FUNCTION | ABSENT |
| CURRENT_RECHECK | public.erp_purchase_order_lines | TABLE | ABSENT |
| CURRENT_RECHECK | public.erp_purchase_order_lines_scope_idx | INDEX | ABSENT |
| CURRENT_RECHECK | public.erp_purchase_orders_business_order_number_uidx | INDEX | ABSENT |
| CURRENT_RECHECK | public.expire_stale_mantigo_rides_backend | FUNCTION | PRESENT |
| CURRENT_RECHECK | public.get_mantigo_admin_dashboard_backend | FUNCTION | PRESENT |
| CURRENT_RECHECK | public.get_mantigo_admin_financial_report_backend | FUNCTION | PRESENT |
| CURRENT_RECHECK | public.journal_entries_tenant_entry_number_uidx | INDEX | ABSENT |
| CURRENT_RECHECK | public.journal_entry_lines_entry_line_uidx | INDEX | ABSENT |
| CURRENT_RECHECK | public.mnty_can_platform_admin | FUNCTION | PRESENT |
| CURRENT_RECHECK | public.post_financial_journal_atomic_backend | FUNCTION | ABSENT |
| CURRENT_RECHECK | public.receive_purchase_stock_with_order_line_backend | FUNCTION | ABSENT |
| CURRENT_RECHECK | public.set_purchase_order_lines_backend | FUNCTION | ABSENT |
| CURRENT_RECHECK | public.settle_mantigo_captain_backend | FUNCTION | PRESENT |
| RC113 | public.mnty_platform_admin_assign_custom_role | FUNCTION | PRESENT |
| RC113 | public.mnty_platform_admin_list_custom_roles | FUNCTION | PRESENT |
| RC113 | public.mnty_platform_admin_upsert_custom_role | FUNCTION | PRESENT |
| RC113 | public.platform_custom_roles | TABLE | PRESENT |
| RC113 | public.platform_role_assignments | TABLE | PRESENT |
| RC113 | public.platform_role_assignments_active_unique | INDEX | PRESENT |
| RC113 | public.platform_role_assignments_user_scope_idx | INDEX | PRESENT |
| RC113 | public.ux_user_memberships_user_business_branch_nullsafe | INDEX | ABSENT |
| RC114 | public.business_employees | TABLE | PRESENT |
| RC114 | public.business_employees_business_status_idx | INDEX | PRESENT |
| RC114 | public.business_employees_email_per_business_unique | INDEX | PRESENT |
| RC114 | public.business_employees_user_active_idx | INDEX | PRESENT |
| RC114 | public.business_job_positions | TABLE | PRESENT |
| RC114 | public.business_job_positions_business_active_idx | INDEX | PRESENT |
| RC114/RC115 | public.mnty_business_employee_position_upsert | FUNCTION | PRESENT |
| RC114/RC115 | public.mnty_business_employee_upsert | FUNCTION | PRESENT |
| RC115 | public.mnty_business_employee_list | FUNCTION | PRESENT |
| RC115 | public.mnty_platform_admin_list_audit | FUNCTION | PRESENT |
| RC115 | public.mnty_platform_admin_list_people | FUNCTION | PRESENT |
| RC115 | public.mnty_platform_admin_list_role_assignments | FUNCTION | PRESENT |
| RC115 | public.mnty_platform_has_permission | FUNCTION | PRESENT |
| RC116 | public.mnty_platform_admin_manage_membership | FUNCTION | PRESENT |
| RC116/RC117 | public.mnty_platform_admin_list_businesses | FUNCTION | PRESENT |
| RC116/RC117 | public.mnty_platform_admin_manage_business | FUNCTION | PRESENT |
| RC117 | public.businesses.mnty_business_default_images | COLUMN | ABSENT |
| RC117 | public.catalog_items.mnty_catalog_item_default_image | COLUMN | ABSENT |
| RC117 | public.marketing_services.image_source | COLUMN | ABSENT |
| RC117 | public.marketing_services.image_url | COLUMN | ABSENT |
| RC117 | public.marketing_services.mnty_marketing_service_default_image | COLUMN | ABSENT |
| RC117 | public.mnty_default_business_images_trigger | TRIGGER | ABSENT |
| RC117 | public.mnty_default_catalog_item_image_trigger | TRIGGER | ABSENT |
| RC117 | public.mnty_default_image_url | FUNCTION | ABSENT |
| RC117 | public.mnty_default_marketing_service_image_trigger | TRIGGER | ABSENT |
| RC425 | public.mantigo_payment_provider_events | TABLE | ABSENT |
| RC425 | public.process_verified_mantigo_payment_backend | FUNCTION | ABSENT |
| RC425 | public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) | FUNCTION | ABSENT |
| RC426 | public.digital_page_orders.provider_order_id | COLUMN | PRESENT |
| RC426 | public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) | FUNCTION | ABSENT |
| RC426/RC475 | public.payment_intents.provider_order_id | COLUMN | PRESENT |
| RC427 | public.uq_payment_intents_one_active_per_order | INDEX | ABSENT |
| RC428 | public.process_verified_provider_payment_failure | FUNCTION | ABSENT |
| RC428/RC475 | public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb) | FUNCTION | ABSENT |
| RC429 | public.process_verified_subscription_payment_failure | FUNCTION | ABSENT |
| RC429/RC475 | public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb) | FUNCTION | ABSENT |
| RC430 | public.process_verified_subscription_payment_backend | FUNCTION | ABSENT |
| RC430/RC475 | public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb) | FUNCTION | ABSENT |
| RC431 | public.process_verified_digital_page_payment_backend | FUNCTION | PRESENT |
| RC432 | public.smm_wallet_transactions_reference_type_uidx | INDEX | ABSENT |
| RC434 | public.receive_purchase_stock_atomic_backend | FUNCTION | ABSENT |
| RC435 | public.claim_subscription_provider_intent_creation_backend(uuid,uuid) | FUNCTION | ABSENT |
| RC435 | public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid) | FUNCTION | ABSENT |
| RC435 | public.subscription_payment_intents.provider_creation_claimed_at | COLUMN | ABSENT |
| RC435 | public.subscription_payment_intents.provider_creation_state | COLUMN | ABSENT |
| RC438 | public.create_purchase_order_with_lines_backend | FUNCTION | ABSENT |
| RC438 | public.update_purchase_order_status_backend(varchar,varchar) | FUNCTION | PRESENT |
| RC439 | public.subscription_payment_intents.client_secret_ciphertext | COLUMN | ABSENT |
| RC439 | public.subscription_payment_intents.client_secret_iv | COLUMN | ABSENT |
| RC439 | public.subscription_payment_intents.client_secret_key_version | COLUMN | ABSENT |
| RC475 | public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) | FUNCTION | PRESENT |
| RC484 | private.platform_admins | TABLE | PRESENT |
| RC484 | public.is_platform_admin() | FUNCTION | PRESENT |

## Interpretation

- The 76-object register is a curated sample, not an exhaustive map of every effect from all 82 required source migrations.
- Function-family checks without exact signatures are name-level presence only.
- All 41 function entries, including present routines, require exact contract review before release.
- Production migration ledger remains 310 rows through 20261110150618; 0/82 exact source version identifiers. This is an identity mismatch, not proof all effects are absent.
- Keep FULL_PLATFORM_GATE BLOCKED / NOT CERTIFIED. No Production DDL/DML, migration, ACL, RLS, Auth, Storage, Edge, payment or business-data mutation occurred.