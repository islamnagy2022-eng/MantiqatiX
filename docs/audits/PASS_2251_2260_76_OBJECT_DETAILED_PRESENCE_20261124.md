# PASS 2251–2260 — Detailed 76-object Production presence read-back

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
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.claim_subscription_provider_intent_creation_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.create_subscription_payment_intent_claimable_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.erp_purchase_order_liness=>"'"+s.replaceAll("'","''")+"'" | TABLE | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.erp_purchase_order_lines_scope_idxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.erp_purchase_orders_business_order_number_uidxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.expire_stale_mantigo_rides_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.get_mantigo_admin_dashboard_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.get_mantigo_admin_financial_report_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.journal_entries_tenant_entry_number_uidxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.journal_entry_lines_entry_line_uidxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_can_platform_admins=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.post_financial_journal_atomic_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.receive_purchase_stock_with_order_line_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.set_purchase_order_lines_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| CURRENT_RECHECK | s=>"'"+s.replaceAll("'","''")+"'"public.settle_mantigo_captain_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_assign_custom_roles=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_list_custom_roless=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_upsert_custom_roles=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.platform_custom_roless=>"'"+s.replaceAll("'","''")+"'" | TABLE | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.platform_role_assignmentss=>"'"+s.replaceAll("'","''")+"'" | TABLE | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.platform_role_assignments_active_uniques=>"'"+s.replaceAll("'","''")+"'" | INDEX | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.platform_role_assignments_user_scope_idxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | PRESENT |
| RC113 | s=>"'"+s.replaceAll("'","''")+"'"public.ux_user_memberships_user_business_branch_nullsafes=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| RC114 | s=>"'"+s.replaceAll("'","''")+"'"public.business_employeess=>"'"+s.replaceAll("'","''")+"'" | TABLE | PRESENT |
| RC114 | s=>"'"+s.replaceAll("'","''")+"'"public.business_employees_business_status_idxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | PRESENT |
| RC114 | s=>"'"+s.replaceAll("'","''")+"'"public.business_employees_email_per_business_uniques=>"'"+s.replaceAll("'","''")+"'" | INDEX | PRESENT |
| RC114 | s=>"'"+s.replaceAll("'","''")+"'"public.business_employees_user_active_idxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | PRESENT |
| RC114 | s=>"'"+s.replaceAll("'","''")+"'"public.business_job_positionss=>"'"+s.replaceAll("'","''")+"'" | TABLE | PRESENT |
| RC114 | s=>"'"+s.replaceAll("'","''")+"'"public.business_job_positions_business_active_idxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | PRESENT |
| RC114/RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_business_employee_position_upserts=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC114/RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_business_employee_upserts=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_business_employee_lists=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_list_audits=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_list_peoples=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_list_role_assignmentss=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC115 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_has_permissions=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC116 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_manage_memberships=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC116/RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_list_businessess=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC116/RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_platform_admin_manage_businesss=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.businesses.mnty_business_default_imagess=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.catalog_items.mnty_catalog_item_default_images=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.marketing_services.image_sources=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.marketing_services.image_urls=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.marketing_services.mnty_marketing_service_default_images=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_default_business_images_triggers=>"'"+s.replaceAll("'","''")+"'" | TRIGGER | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_default_catalog_item_image_triggers=>"'"+s.replaceAll("'","''")+"'" | TRIGGER | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_default_image_urls=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC117 | s=>"'"+s.replaceAll("'","''")+"'"public.mnty_default_marketing_service_image_triggers=>"'"+s.replaceAll("'","''")+"'" | TRIGGER | ABSENT |
| RC425 | s=>"'"+s.replaceAll("'","''")+"'"public.mantigo_payment_provider_eventss=>"'"+s.replaceAll("'","''")+"'" | TABLE | ABSENT |
| RC425 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_mantigo_payment_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC425 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC426 | s=>"'"+s.replaceAll("'","''")+"'"public.digital_page_orders.provider_order_ids=>"'"+s.replaceAll("'","''")+"'" | COLUMN | PRESENT |
| RC426 | s=>"'"+s.replaceAll("'","''")+"'"public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC426/RC475 | s=>"'"+s.replaceAll("'","''")+"'"public.payment_intents.provider_order_ids=>"'"+s.replaceAll("'","''")+"'" | COLUMN | PRESENT |
| RC427 | s=>"'"+s.replaceAll("'","''")+"'"public.uq_payment_intents_one_active_per_orders=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| RC428 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_provider_payment_failures=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC428/RC475 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC429 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_subscription_payment_failures=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC429/RC475 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC430 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_subscription_payment_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC430/RC475 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC431 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_digital_page_payment_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC432 | s=>"'"+s.replaceAll("'","''")+"'"public.smm_wallet_transactions_reference_type_uidxs=>"'"+s.replaceAll("'","''")+"'" | INDEX | ABSENT |
| RC434 | s=>"'"+s.replaceAll("'","''")+"'"public.receive_purchase_stock_atomic_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC435 | s=>"'"+s.replaceAll("'","''")+"'"public.claim_subscription_provider_intent_creation_backend(uuid,uuid)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC435 | s=>"'"+s.replaceAll("'","''")+"'"public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC435 | s=>"'"+s.replaceAll("'","''")+"'"public.subscription_payment_intents.provider_creation_claimed_ats=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC435 | s=>"'"+s.replaceAll("'","''")+"'"public.subscription_payment_intents.provider_creation_states=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC438 | s=>"'"+s.replaceAll("'","''")+"'"public.create_purchase_order_with_lines_backends=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | ABSENT |
| RC438 | s=>"'"+s.replaceAll("'","''")+"'"public.update_purchase_order_status_backend(varchar,varchar)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC439 | s=>"'"+s.replaceAll("'","''")+"'"public.subscription_payment_intents.client_secret_ciphertexts=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC439 | s=>"'"+s.replaceAll("'","''")+"'"public.subscription_payment_intents.client_secret_ivs=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC439 | s=>"'"+s.replaceAll("'","''")+"'"public.subscription_payment_intents.client_secret_key_versions=>"'"+s.replaceAll("'","''")+"'" | COLUMN | ABSENT |
| RC475 | s=>"'"+s.replaceAll("'","''")+"'"public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric)s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |
| RC484 | s=>"'"+s.replaceAll("'","''")+"'"private.platform_adminss=>"'"+s.replaceAll("'","''")+"'" | TABLE | PRESENT |
| RC484 | s=>"'"+s.replaceAll("'","''")+"'"public.is_platform_admin()s=>"'"+s.replaceAll("'","''")+"'" | FUNCTION | PRESENT |

## Interpretation

- The 76-object register is a curated sample, not an exhaustive map of every effect from all 82 required source migrations.
- Function-family checks without exact signatures are name-level presence only.
- All 41 function entries, including present routines, require exact contract review before release.
- Production migration ledger remains 310 rows through 20261110150618; 0/82 exact source version identifiers. This is an identity mismatch, not proof all effects are absent.
- Keep FULL_PLATFORM_GATE BLOCKED / NOT CERTIFIED. No Production DDL/DML, migration, ACL, RLS, Auth, Storage, Edge, payment or business-data mutation occurred.