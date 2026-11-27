# Public SECURITY DEFINER Function Inventory — 2026-11-28

**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`
**Observed:** 2026-11-28 01:10 EET (2026-11-27 23:10 UTC).
**Method:** read-only PostgreSQL catalog inventory using `pg_proc`, `pg_namespace`, `pg_roles`, `pg_language`, function-level `proconfig`, and effective `has_function_privilege` checks. No function body was invoked. No grants, function definitions, data, Auth settings, or Edge deployment were changed.

## Aggregate

- Functions: 149.
- Owners: postgres=149.
- Languages: plpgsql=140, sql=9.
- Effective anon EXECUTE: 1.
- Effective authenticated EXECUTE: 65.
- Effective service_role EXECUTE: 34.
- Function-level search_path: search_path=public=91; search_path=public, pg_temp=26; search_path=public, auth=1; search_path=""=28; search_path=pg_catalog, public=1; search_path=public, vault=2.

These counts describe effective privileges and the function-level GUC only. They do **not** establish whether a function body is safe, whether its caller is intended, or whether tenant/business/branch isolation is correct. Effective EXECUTE may be inherited from `PUBLIC`; this inventory records the effective privilege result rather than attributing every grant to a direct ACL entry.

The only anon-executable routine in this inventory is `public.get_mnty_targeted_advertisements(...)`. It is also callable by `authenticated`, uses an empty function-level search path, and is a documented public ad-read contract. Review its allowlisted projection and predicates; do not revoke it solely because an Advisor lint exists.

## Function-by-function metadata

| Function signature | Owner | Language | Function search_path | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---|---|---|---:|---:|---:|
| `accept_mantigo_bid_backend(uuid,text,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `append_audit_log_backend(character varying,character varying,character varying,uuid,character varying,character varying,character varying,character varying,jsonb,jsonb,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `append_ticket_message_backend(character varying,character varying,text,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `assert_financial_membership(character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `assign_default_owner_to_unowned_business()` | `postgres` | plpgsql | `search_path=public, auth` | no | no | no |
| `capture_commission_rule_audit()` | `postgres` | plpgsql | `search_path=""` | no | no | no |
| `claim_digital_page_payment_intent_backend(uuid,uuid,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `claim_referral(character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `confirm_cash_payment(character varying,uuid)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `confirm_mantigo_cash_payment_backend(uuid,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `confirm_obligation_settlement(character varying,character varying,numeric,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `counter_offer_indrive_bid(uuid,uuid,numeric)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `create_commission_backend(character varying,character varying,uuid,uuid,character varying,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_education_request_backend(uuid,text,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `create_indrive_bid_backend(uuid,uuid,text,text,numeric,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `create_indrive_request_backend(uuid,text,text,text,text,numeric,text,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `create_job_backend(uuid,text,character varying,uuid,text,text,text,text,text,text,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `create_mantigo_ride_backend(uuid,text,text,text,text,text,text,numeric,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `create_mantigo_ride_backend_v2(uuid,text,text,text,text,text,text,numeric,text,text,double precision,double precision,double precision,double precision)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `create_medical_appointment_backend(uuid,text,uuid,text,bigint,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_order_backend(uuid,character varying,uuid,character varying,uuid,character varying,numeric,numeric,numeric,numeric,numeric,character varying,text,text,text,jsonb,text,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | YES |
| `create_payment_obligations(character varying,character varying,uuid,uuid,character varying,numeric,numeric,character varying,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_purchase_order_backend(character varying,character varying,uuid,character varying,character varying,character varying,numeric,numeric,numeric,text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_settlement_and_post_journal(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying,uuid,text,uuid)` | `postgres` | plpgsql | `search_path=pg_catalog, public` | no | no | YES |
| `create_settlement_backend(character varying,character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `create_stock_transfer_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `create_support_ticket_backend(character varying,character varying,uuid,character varying,text,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_wallet_transaction_backend(character varying,character varying,character varying,character varying,numeric,character varying,character varying,character varying,text,jsonb,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `create_warehouse_backend(character varying,character varying,uuid,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `deactivate_business(uuid,text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `expire_stale_mantigo_rides_backend(uuid,integer)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `fashion_erp_mutate(text,jsonb,text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `find_mnty_nearby_provider_businesses(double precision,double precision,double precision)` | `postgres` | sql | `search_path=public` | no | no | no |
| `find_mnty_nearest_provider_businesses(double precision,double precision,integer)` | `postgres` | sql | `search_path=public` | no | no | no |
| `fulfill_digital_page_publish(uuid,uuid,uuid)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `get_mantigo_admin_dashboard_backend(uuid)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `get_mantigo_captain_earnings_backend(uuid)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `get_mnty_push_secrets()` | `postgres` | sql | `search_path=public` | no | no | YES |
| `get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)` | `postgres` | sql | `search_path=""` | YES | YES | no |
| `get_or_create_business_referral_profile(uuid)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `get_or_create_my_referral_profile()` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `initialize_opening_stock_backend(character varying,character varying,uuid,character varying,uuid,numeric,numeric,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_assert_action(uuid,text,uuid)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `legal_audit_bridge()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_check_action(text,uuid)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `legal_effective_version(text,text,uuid)` | `postgres` | sql | `search_path=public` | no | no | no |
| `legal_gate_business_activation()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_gate_commission_insert()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_gate_employee_activation()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_gate_order_insert()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_gate_referral_insert()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `legal_is_admin(uuid)` | `postgres` | sql | `search_path=public` | no | no | no |
| `legal_publish_version(uuid,uuid,integer,timestamp with time zone)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `legal_suspend_document(uuid,uuid)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `legal_update_document(uuid,uuid,text,text[],boolean,boolean,text[],text)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `legal_update_draft_version(uuid,uuid,text)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `list_mantigo_captain_rides_backend(uuid)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `list_mantigo_customer_rides_backend(uuid,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `list_open_mantigo_rides_backend(uuid)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `lock_mantigo_fare_backend(uuid,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `mantigo_accept_bid(text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_cancel_ride(text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_create_ride(text,text,text,text,numeric,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_guard_bid_rate_limit()` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_guard_ride_rate_limit()` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_rate_limit_check(text,uuid)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_rate_ride(text,integer,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `mantigo_submit_bid(text,numeric,text,text,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mantigo_update_proposed_price(text,numeric)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | no |
| `mark_notifications_read_backend(character varying)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `match_mantigo_ride_backend(uuid,text,integer)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `mnty_active_membership(character varying,uuid,character varying)` | `postgres` | sql | `search_path=public, pg_temp` | no | YES | no |
| `mnty_business_employee_list(character varying,uuid)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_business_employee_list_scoped(character varying,uuid,character varying)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_business_employee_permission_ceiling_allows(jsonb,character varying,uuid,character varying)` | `postgres` | plpgsql | `search_path=""` | no | no | no |
| `mnty_business_employee_position_upsert(character varying,uuid,text,text,text,text,jsonb,boolean,boolean,character varying,uuid)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_business_employee_upsert(character varying,uuid,uuid,text,text,text,uuid,text,jsonb,character varying,uuid)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_can(text,character varying,uuid,character varying)` | `postgres` | sql | `search_path=public, pg_temp` | no | YES | no |
| `mnty_can_platform_admin()` | `postgres` | sql | `search_path=public, pg_temp` | no | YES | no |
| `mnty_commission_rule_drafts(text,character varying,character varying,jsonb)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_assign_custom_role(uuid,uuid,character varying,uuid,character varying,boolean,uuid)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_list_audit(text)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_list_businesses(text)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_list_custom_roles()` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_list_people(text)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_list_role_assignments()` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_manage_business(uuid,text,jsonb,text)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_manage_membership(uuid,text,text)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_admin_upsert_custom_role(text,text,text,text,jsonb,uuid,boolean)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_platform_has_permission(text,character varying,uuid,character varying)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `mnty_push_notification_hook()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `payment_financial_reconciliation_check(character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `post_financial_journal(jsonb,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `post_financial_journal_backend(uuid,jsonb,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `preview_commission_backend(character varying,uuid,character varying,numeric)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `preview_commission_rule_draft(character varying,character varying,numeric)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `preview_commission_rule_resolution(character varying,uuid,character varying,text,text,text,text,numeric)` | `postgres` | plpgsql | `search_path=""` | no | YES | no |
| `process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | no | YES |
| `process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `process_verified_subscription_payment(text,text,uuid,text,numeric,text,boolean)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `receive_purchase_stock_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `receive_stock_transfer_backend(character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `record_cash_commission_due(character varying,character varying,uuid,uuid,character varying,numeric,numeric,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `record_legal_consent(uuid,uuid,text,uuid,text,text,jsonb,text,text,text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `record_legal_consent_backend(uuid,uuid,uuid,text,uuid,text,text,jsonb,text,text,text)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `record_refund_backend(character varying,character varying,uuid,uuid,character varying,character varying,numeric,numeric,text,character varying,jsonb,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `release_digital_page_payment_intent_claim_backend(uuid,uuid,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `resolve_commission_rule_backend(character varying,uuid,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `resolve_legacy_scope(text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `resolve_platform_feature(character varying,uuid,character varying,character varying,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `restaurant_erp_mutate(text,jsonb,text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `restaurant_table_mutate(text,jsonb,text)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `set_mantigo_financial_config_backend(uuid,numeric,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `settle_mantigo_captain_backend(uuid,text,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `smm_admin_credit_wallet(uuid,uuid,numeric,text)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `smm_bootstrap_first_admin()` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `smm_debit_wallet(uuid,numeric,uuid)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `smm_get_provider_secret(uuid)` | `postgres` | plpgsql | `search_path=public, vault` | no | no | YES |
| `smm_refund_wallet(uuid,numeric,uuid,text)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `smm_set_provider_secret(uuid,uuid,text)` | `postgres` | plpgsql | `search_path=public, vault` | no | no | YES |
| `start_business_trial_backend(uuid,text,text,integer,text,uuid)` | `postgres` | plpgsql | `search_path=""` | no | no | YES |
| `submit_job_application_backend(uuid,uuid,text,text,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `submit_mantigo_captain_application(uuid,text,text,text,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `track_business_referral_event(character varying,character varying,jsonb)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `update_mantigo_captain_presence_backend(uuid,text,double precision,double precision)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `update_mantigo_trip_status_backend(uuid,text,text,text)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `update_medical_appointment_status_backend(uuid,text,text)` | `postgres` | plpgsql | `search_path=public, pg_temp` | no | YES | no |
| `update_order_status_backend(uuid,character varying,uuid,character varying,text)` | `postgres` | plpgsql | `search_path=public` | no | no | YES |
| `update_purchase_order_status_backend(character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `update_stock_transfer_status_backend(character varying,character varying)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `update_support_ticket_status_backend(character varying,character varying,uuid)` | `postgres` | plpgsql | `search_path=public` | no | no | no |
| `upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `upsert_catalog_item_and_price_backend(character varying,uuid,character varying,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid,character varying,numeric,timestamp with time zone,timestamp with time zone)` | `postgres` | plpgsql | `search_path=public` | no | YES | no |
| `upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)` | `postgres` | plpgsql | `search_path=public` | no | YES | YES |
| `upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)` | `postgres` | plpgsql | `search_path=public` | no | YES | YES |
| `upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean)` | `postgres` | plpgsql | `search_path=public` | no | YES | YES |
| `validate_mantigo_ride_acceptance_integrity()` | `postgres` | plpgsql | `search_path=public` | no | no | no |

## Delegation review — six authenticated-callable routines without a direct `auth.uid()` token

A source-text scan found six of the 65 authenticated-callable SECURITY DEFINER functions without a literal direct `auth.uid()` call in their own body. A missing token is only a triage signal: the immediate delegated function must be reviewed before drawing an authorization conclusion.

| Routine | Immediate authorization path | Current Production disposition |
|---|---|---|
| `get_mnty_targeted_advertisements(...)` | Deliberate anonymous public-read query; empty search_path; schema-qualified relations; only active, approved, in-window ad metadata; result limit clamped 1–50. | **INTENTIONAL PUBLIC READ**. Preserve the contract; do not revoke anon based on Advisor label alone. Re-verify the exact seven-column projection and deployed caller after changes. |
| `mnty_business_employee_list(tenant,business)` | Delegates to `mnty_business_employee_list_scoped(tenant,business,NULL)`, which binds `auth.uid()`, rejects anonymous JWTs, validates business↔tenant and optional branch↔business, then requires an active eligible business membership or explicit scoped employee permission. | **DELEGATED USER SCOPE**. The wrapper's direct body is thin; the scoped helper is the effective boundary. Keep the professional-dashboard branch/mobile tests. |
| `mnty_can(permission,tenant,business,branch)` | Delegates to `mnty_active_membership(...)`, which filters by `auth.uid()`, ACTIVE membership and supplied tenant/business/branch scopes. | **DELEGATED MEMBERSHIP SCOPE** when scope parameters are supplied. Null-scope calls intentionally enumerate all active memberships and must not be repurposed as proof of platform-root authority. |
| `mnty_can_platform_admin()` | Calls `mnty_can('admin',NULL,NULL,NULL)`, which uses the null-scope helper. Any eligible tenant OWNER/ADMIN role can satisfy the broad admin permission branch. | **CONFIRMED P0 PLATFORM-ROOT DEFECT**. This is not a missing-actor-token false positive; it is an overbroad authorization decision. RC464 → RC469 → RC471 → RC484 → RC485 source chain exists but is not applied to Production. |
| `preview_commission_backend(tenant,business,module,gross)` | Calls `assert_financial_membership(tenant)`, which binds `auth.uid()` and requires an ACTIVE finance-capable role within the tenant, but does not bind the user to the requested business and does not reject branch-only finance actors for a branch-less preview. | **CONFIRMED P1 SCOPE DEFECT**. RC467 (`20261115010000`) adds exact business/tenant binding and denies branch-scoped finance; it depends on RC464. Production RC467 remains unapplied; `commission_rules` row count was 0 in the fresh read-only check, so no rule disclosure was observed. |
| `upsert_catalog_item_and_price_backend(...)` | Delegates to `upsert_catalog_item_backend` and `upsert_catalog_price_backend`; both require `auth.uid()`, verify active membership, exact tenant/business, branch/business hierarchy and allowed owner/manager role (with platform-root route). | **DELEGATED USER SCOPE** in the inspected call chain. Preserve downstream positive/negative business/branch tests; do not add redundant user-ID parameters to the wrapper solely to satisfy a regex scan. |


## Additional authenticated-caller scope finding — MantiGO open rides

`public.list_open_mantigo_rides_backend(uuid)` does contain a direct `auth.uid()` equality check, so it is not part of the six no-direct-token list. That check only proves the caller supplied their own user ID; it does **not** prove the caller is a MantiGO captain or authorized to view pickup/destination data.

**Fresh read-only Production body/ACL read-back:** SECURITY DEFINER, owner `postgres`, `search_path=public`, authenticated EXECUTE=true, anon EXECUTE=false. It filters to OPEN/OPEN_FOR_BIDS rides, excludes the caller's own rides, but returns customer names, pickup/destination locations and notes without checking `mantigo_captain_profiles` ACTIVE/VERIFIED/AVAILABLE status or the caller's vehicle category. Therefore any confirmed authenticated user who can invoke the RPC can reach this location-disclosure path. No RPC was invoked and no customer/ride rows were selected.

**Existing source repair:** RC478 `supabase/migrations/20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql` is a current-schema forward repair. It rejects anonymous Auth JWTs, binds the caller, requires the caller's own ACTIVE + VERIFIED + AVAILABLE captain profile, restricts results to the profile's vehicle category, pins `search_path=pg_catalog`, revokes PUBLIC/anon, and keeps authenticated EXECUTE. Its PG16 disposable integration covers ordinary authenticated users, pending/unverified/offline captains, anonymous sessions, category separation, own-ride exclusion and closed rides. Static validator and workflow are present. RC478 exact ID remains absent from the Production 310-row ledger; no Production mutation was made.

**Disposition:** confirmed P1 location-privacy boundary mismatch; tracked in issue #911. Do not hot-apply RC478 or deploy a separate Edge change. Include it in the full ordered, backed-up release and verify the exact live function definition/ACL and negative/positive cases post-deployment.


## Additional authenticated-role privacy boundary — MantiGO open ride list

`public.list_open_mantigo_rides_backend(uuid)` contains a direct `auth.uid()` equality check, so it is not part of the six no-direct-token list. However, the caller-ID equality check alone does **not** prove the caller is an eligible captain.

**Direct Production read-back:** SECURITY DEFINER, owner `postgres`, `search_path=public`, authenticated EXECUTE=true / anon EXECUTE=false. The live body filters to OPEN/OPEN_FOR_BIDS rides, excludes the caller's own rides, but returns customer names, pickup/destination locations and notes without checking the caller's captain profile ACTIVE/VERIFIED/AVAILABLE state or vehicle category. Any authenticated user could reach this location-disclosure path. No RPC was invoked and no ride/customer rows were selected.

**Existing repair:** RC478 `20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql` is source-only and requires a non-anonymous Auth JWT, exact caller identity, an ACTIVE + VERIFIED + AVAILABLE captain profile, and a vehicle-category match. It pins `search_path=pg_catalog` and preserves authenticated-only EXECUTE. Disposable PostgreSQL 16 tests cover ordinary authenticated users, pending/unverified/offline captains, anonymous Auth sessions, vehicle-category separation, own-ride exclusion and closed rides. The migration is not in the Production ledger; issue #911 remains open.

**Disposition:** confirmed P1 location-privacy boundary mismatch in Production. Do not hot-apply RC478 or deploy a separate backend function; include it in the coordinated release and verify exact live function body/ACL plus positive/negative cases after rollout.

## Additional authenticated-role privacy boundary — MantiGO customer bid contacts

`public.list_mantigo_customer_rides_backend(uuid,text)` correctly binds the caller to `auth.uid()` and limits rides to the caller's own rides, but the live body builds its `bids` JSON using `jsonb_agg(to_jsonb(b))` without masking contact fields. The `mantigo_bids` row includes `captain_phone` and `vehicle_plate`, so the customer can receive those identifiers for OFFERED/non-accepted bids.

**Direct Production read-back:** SECURITY DEFINER, owner `postgres`, `search_path=public`, authenticated EXECUTE=true / anon EXECUTE=false. RC477 `supabase/migrations/20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql` replaces full-row serialization with an explicit masking projection: phone and plate are JSON null until bid status is `ACCEPTED`, while remaining offer fields are preserved. It pins an empty search_path and retains authenticated-only EXECUTE. The disposable PostgreSQL test proves OFFERED fields hidden, ACCEPTED fields visible, non-sensitive bid fields unchanged, actor mismatch rejected, and expected grants/path. RC477's exact ID is absent from Production; issue #913 remains open.

**Disposition:** confirmed P1 pre-acceptance contact disclosure mismatch. No customer rows, phone numbers, plates or function results were read. No RPC was invoked or Production mutation performed. Keep RC477 inside the coordinated migration/Edge/backup release and verify OFFERED/ACCEPTED/REJECTED/WITHDRAWN/EXPIRED cases after deployment.
**Limit:** this section records a direct body/delegation triage of the six no-direct-token entries. It is not a full review of all 65 authenticated-callable routines or a replacement for deployed-caller/Edge parity verification.
## Required next classification

1. Trace each routine's current callers in browser code and deployed/current Edge bundles.
2. Classify each as intentional public-read, authenticated user-scoped action, trigger/internal-only, or backend/server-only operation.
3. For each routine, review exact `pg_get_functiondef`, schema qualification, actor binding (`auth.uid()` / verified actor), tenant/business/branch scope, SECURITY DEFINER owner, `search_path`, and referenced table RLS/ACL dependencies.
4. For server-only functions, move callers behind a verified Edge/server boundary first; only then prepare narrowly scoped grant changes with regression tests. Never mass-revoke `authenticated` or mass-change `search_path`.
5. Add positive and negative disposable PostgreSQL tests for actor spoofing, tenant/business/branch crossover, anonymous Auth sessions, idempotency and intended role access.
6. Re-run the inventory and Supabase Security Advisor after the coordinated release, and compare exact function bodies and grants with the deployed Edge callers.

**Release status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`. This is a metadata inventory input to issue #98, not a per-function security certification.