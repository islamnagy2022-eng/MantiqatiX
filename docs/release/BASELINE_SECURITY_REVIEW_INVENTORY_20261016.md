# Production Schema Baseline — SECURITY DEFINER Review Inventory

**Date:** 2026-10-16  
**Source:** `supabase/tests/baselines/production_schema_snapshot.sql` on integration candidate branch  
**Baseline checkpoint:** `20261008222845`  
**Manifest review status:** `PENDING_REVIEW`  
**Purpose:** Inventory to support manual security review before disposable forward replay. This file is not an approval and does not authorize production changes.

## Static inventory summary

- Parsed SECURITY DEFINER function definitions: **144**
- Configured empty search path: **25**
- Search path containing `public` and/or `pg_temp`: **119**
- Missing search path in parsed function definition: **0**
- Other configured search path: **0**
- Review status for every item below: **NOT REVIEWED**

These are static counts, not vulnerability counts. A `public` or `pg_temp` search path is a review signal, not by itself proof of exploitability. An empty search path is not sufficient by itself to prove a function safe. The function body, qualified object references, grants, caller identity checks, RLS assumptions, tenant/business/branch scoping, and intended exposure must be assessed per function.

## Required reviewer checklist

For each entry, record the review result in a separate reviewed artifact before changing the baseline manifest status:

1. Verify intended EXECUTE roles (PUBLIC, anon, authenticated, service_role, and any custom roles) against the feature contract.
2. Check authentication and actor binding; reject caller-supplied user IDs that do not equal the authenticated identity where applicable.
3. Check tenant, organization, business, and branch scope for every read and mutation.
4. Check table/function names are schema-qualified when search_path is empty or potentially shadowable.
5. Review dynamic SQL, casts, exception handling, transaction boundaries, and idempotency.
6. Check RLS/policies and direct table grants together; do not infer safety from RLS alone.
7. Verify no sensitive row data or credential material is embedded in the schema dump or function definitions.
8. Record reviewer, date, decision, rationale, and any remediation before explicit approval for disposable replay.

## Inventory

| # | Function signature | Configured search_path | Triage category | Review |
|---:|---|---|---|---|
| 1 | `"private"."accept_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 2 | `"private"."activate_customer_registration_atomic"("p_user_id" "uuid", "p_tenant_id" character varying DEFAULT 'MNTY-PLATFORM'::character varying)` | `''` | EMPTY_PATH | NOT REVIEWED |
| 3 | `"private"."bootstrap_platform_admin"("p_user_id" "uuid", "p_tenant_id" character varying DEFAULT 'MNTY_PLATFORM'::character varying, "p_tenant_name" character varying DEFAULT 'MNTY Platform'::character varying, "p_tenant_code" character varying DEFAULT 'MNTY-PLATFORM'::character varying)` | `''` | EMPTY_PATH | NOT REVIEWED |
| 4 | `"private"."can_read_indrive_bid"("p_request_id" "uuid", "p_provider_user_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 5 | `"private"."can_read_indrive_request"("p_request_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 6 | `"private"."can_submit_indrive_bid"("p_request_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 7 | `"private"."disable_mnty_push_subscription"("p_endpoint" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 8 | `"private"."ensure_customer_membership_for_user"("p_user_id" "uuid", "p_tenant_id" character varying DEFAULT 'MNTY-PLATFORM'::character varying)` | `''` | EMPTY_PATH | NOT REVIEWED |
| 9 | `"private"."handle_auth_user_customer_membership"()` | `''` | EMPTY_PATH | NOT REVIEWED |
| 10 | `"private"."legal_is_admin"()` | `''` | EMPTY_PATH | NOT REVIEWED |
| 11 | `"private"."legal_is_admin"("p_user_id" "uuid" DEFAULT NULL::"uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 12 | `"private"."mnty_notify_order_created"()` | `''` | EMPTY_PATH | NOT REVIEWED |
| 13 | `"private"."mnty_notify_order_status"()` | `''` | EMPTY_PATH | NOT REVIEWED |
| 14 | `"private"."mnty_notify_order_status_changed"()` | `''` | EMPTY_PATH | NOT REVIEWED |
| 15 | `"private"."reject_indrive_bid_impl"("p_request_id" "uuid", "p_bid_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 16 | `"private"."review_business_approval_atomic"("p_actor_user_id" "uuid", "p_approval_request_id" character varying, "p_action" character varying)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 17 | `"private"."review_provider_onboarding_atomic"("p_actor_user_id" "uuid", "p_onboarding_request_id" "uuid", "p_decision" "text", "p_rejection_reason" "text" DEFAULT NULL::"text")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 18 | `"private"."review_registration_request_atomic"("p_actor_user_id" "uuid", "p_request_id" "uuid", "p_decision" "text", "p_tenant_id" character varying DEFAULT NULL::character varying, "p_organization_id" character varying DEFAULT NULL::character varying)` | `''` | EMPTY_PATH | NOT REVIEWED |
| 19 | `"private"."submit_provider_onboarding"("p_user_id" "uuid", "p_registration_request_id" "uuid", "p_tenant_id" character varying, "p_organization_id" character varying, "p_business_name" character varying, "p_provider_kind" character varying, "p_name_en" character varying DEFAULT NULL::character varying, "p_description" "text" DEFAULT NULL::"text", "p_specialties" "jsonb" DEFAULT '[]'::"jsonb", "p_service_areas" "jsonb" DEFAULT '[]'::"jsonb", "p_portfolio" "jsonb" DEFAULT '[]'::"jsonb", "p_profile_image_path" "text" DEFAULT NULL::"text")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 20 | `"private"."upsert_mnty_push_subscription"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text" DEFAULT NULL::"text", "p_platform" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 21 | `"public"."accept_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_bid_id" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 22 | `"public"."admin_create_global_ad"("p_title" character varying, "p_creative_url" "text", "p_target_url" "text" DEFAULT NULL::"text", "p_start_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_at" timestamp with time zone DEFAULT NULL::timestamp with time zone)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 23 | `"public"."append_audit_log_backend"("p_id" character varying, "p_tenant_id" character varying, "p_organization_id" character varying DEFAULT NULL::character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" character varying DEFAULT NULL::character varying, "p_action" character varying DEFAULT 'UNKNOWN'::character varying, "p_entity_type" character varying DEFAULT 'UNKNOWN'::character varying, "p_entity_id" character varying DEFAULT ''::character varying, "p_old_values" "jsonb" DEFAULT NULL::"jsonb", "p_new_values" "jsonb" DEFAULT NULL::"jsonb", "p_result" character varying DEFAULT 'SUCCESS'::character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 24 | `"public"."append_ticket_message_backend"("p_id" character varying, "p_ticket_id" character varying, "p_content" "text", "p_sender_role" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 25 | `"public"."assert_financial_membership"("p_tenant_id" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 26 | `"public"."claim_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text", "p_claim_token" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 27 | `"public"."claim_referral"("p_code" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 28 | `"public"."confirm_cash_payment"("p_payment_intent_id" character varying, "p_user_id" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 29 | `"public"."confirm_mantigo_cash_payment_backend"("p_user_id" "uuid", "p_ride_id" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 30 | `"public"."confirm_obligation_settlement"("p_obligation_id" character varying, "p_external_reference" character varying, "p_confirmed_amount" numeric, "p_currency" character varying, "p_provider" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 31 | `"public"."counter_offer_indrive_bid"("p_request_id" "uuid", "p_bid_id" "uuid", "p_new_counter_price" numeric)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 32 | `"public"."create_commission_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_rule_id" character varying, "p_order_amount" numeric, "p_commission_rate" numeric, "p_commission_amount" numeric, "p_platform_net" numeric, "p_merchant_net" numeric, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 33 | `"public"."create_education_request_backend"("p_target_id" "uuid", "p_target_type" "text", "p_student_name" "text", "p_subject_or_grade" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 34 | `"public"."create_indrive_bid_backend"("p_user_id" "uuid", "p_request_id" "uuid", "p_provider_name" "text", "p_provider_type" "text", "p_offered_price" numeric, "p_note" "text", "p_estimated_delivery_time" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 35 | `"public"."create_indrive_request_backend"("p_user_id" "uuid", "p_domain_type" "text", "p_category_name" "text", "p_title" "text", "p_details_description" "text", "p_user_proposed_price" numeric, "p_target_provider_type" "text", "p_req_location_district" "text", "p_idempotency_key" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 36 | `"public"."create_job_backend"("p_user_id" "uuid", "p_job_id" "text", "p_tenant_id" character varying, "p_business_id" "uuid", "p_title" "text", "p_company_name" "text", "p_category" "text", "p_location" "text", "p_job_type" "text", "p_salary_range" "text", "p_description" "text", "p_requirements" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 37 | `"public"."create_mantigo_bid_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_captain_name" "text", "p_captain_phone" "text", "p_captain_rating" numeric, "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_offered_price" numeric, "p_eta_minutes" integer, "p_captain_message" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 38 | `"public"."create_mantigo_ride_backend"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 39 | `"public"."create_mantigo_ride_backend_v2"("p_user_id" "uuid", "p_customer_name" "text", "p_customer_phone" "text", "p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text", "p_idempotency_key" "text", "p_pickup_lat" double precision DEFAULT NULL::double precision, "p_pickup_lon" double precision DEFAULT NULL::double precision, "p_destination_lat" double precision DEFAULT NULL::double precision, "p_destination_lon" double precision DEFAULT NULL::double precision)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 40 | `"public"."create_medical_appointment_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_business_id" "uuid", "p_doctor_id" "text", "p_date_time" bigint, "p_reason" "text" DEFAULT NULL::"text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 41 | `"public"."create_notification_backend"("p_id" character varying, "p_tenant_id" character varying, "p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_body" "text", "p_entity_type" character varying DEFAULT NULL::character varying, "p_entity_id" character varying DEFAULT NULL::character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 42 | `"public"."create_order_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_customer_id" "uuid", "p_client_idempotency_key" character varying, "p_subtotal" numeric, "p_discount" numeric, "p_tax" numeric, "p_delivery_fee" numeric, "p_total_amount" numeric, "p_currency" character varying, "p_customer_name" "text", "p_customer_phone" "text", "p_delivery_address" "text", "p_items_json" "jsonb", "p_notes" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 43 | `"public"."create_payment_intent_backend"("p_tenant_id" character varying, "p_order_id" "uuid", "p_amount" numeric, "p_currency" character varying, "p_provider" character varying, "p_payment_method" character varying, "p_idempotency_key" character varying)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 44 | `"public"."create_payment_obligations"("p_id_prefix" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_provider_id" character varying, "p_currency" character varying, "p_payment_method" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 45 | `"public"."create_purchase_order_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_order_number" character varying, "p_supplier_id" character varying, "p_total_amount" numeric, "p_tax_amount" numeric, "p_discount_amount" numeric, "p_reason" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 46 | `"public"."create_settlement_and_post_journal"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT NULL::"text", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid")` | `'pg_catalog', 'public'` | REVIEW_PATH | NOT REVIEWED |
| 47 | `"public"."create_settlement_backend"("p_id" character varying, "p_tenant_id" character varying, "p_beneficiary_type" character varying, "p_beneficiary_id" character varying, "p_gross" numeric, "p_platform_fee" numeric, "p_net" numeric, "p_voucher" numeric, "p_channel" character varying, "p_reference_id" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 48 | `"public"."create_stock_transfer_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_transfer_number" character varying, "p_from_warehouse_id" character varying, "p_to_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 49 | `"public"."create_subscription_payment_intent_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_billing_cycle" "text", "p_sector" "text", "p_idempotency_key" "text", "p_actor_user_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 50 | `"public"."create_support_ticket_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_subject" character varying, "p_description" "text", "p_category" character varying, "p_priority" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 51 | `"public"."create_wallet_transaction_backend"("p_id" character varying, "p_tenant_id" character varying, "p_wallet_id" character varying, "p_transaction_type" character varying, "p_amount" numeric, "p_idempotency_key" character varying, "p_reference_type" character varying, "p_reference_id" character varying, "p_description" "text", "p_journal_entry" "jsonb", "p_journal_lines" "jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 52 | `"public"."create_warehouse_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_name" character varying, "p_code" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 53 | `"public"."deactivate_business"("p_business_id" "uuid", "p_reason" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 54 | `"public"."expire_stale_mantigo_rides_backend"("p_admin_user_id" "uuid", "p_age_minutes" integer DEFAULT 30)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 55 | `"public"."fashion_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 56 | `"public"."finalize_digital_page_payment_intent_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text", "p_provider_intent_id" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 57 | `"public"."find_mnty_nearby_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_radius_km" double precision DEFAULT 3)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 58 | `"public"."find_mnty_nearest_provider_businesses"("p_lat" double precision, "p_lon" double precision, "p_limit" integer DEFAULT 12)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 59 | `"public"."fulfill_digital_page_publish"("p_actor_user_id" "uuid", "p_order_id" "uuid", "p_page_id" "uuid")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 60 | `"public"."get_mantigo_admin_dashboard_backend"("p_admin_user_id" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 61 | `"public"."get_mantigo_admin_financial_report_backend"("p_admin_user_id" "uuid", "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 62 | `"public"."get_mantigo_captain_earnings_backend"("p_user_id" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 63 | `"public"."get_mnty_push_secrets"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 64 | `"public"."get_mnty_targeted_advertisements"("p_country_code" character varying DEFAULT 'EG'::character varying, "p_governorate_code" character varying DEFAULT NULL::character varying, "p_center_code" character varying DEFAULT NULL::character varying, "p_lat" double precision DEFAULT NULL::double precision, "p_lon" double precision DEFAULT NULL::double precision, "p_ad_space_id" character varying DEFAULT NULL::character varying, "p_limit" integer DEFAULT 3)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 65 | `"public"."get_or_create_business_referral_profile"("p_business_id" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 66 | `"public"."get_or_create_my_referral_profile"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 67 | `"public"."initialize_opening_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_warehouse_id" character varying, "p_product_id" "uuid", "p_quantity" numeric, "p_unit_cost" numeric, "p_reference_id" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 68 | `"public"."legal_assert_action"("p_user_id" "uuid", "p_action_key" "text", "p_business_id" "uuid" DEFAULT NULL::"uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 69 | `"public"."legal_audit_bridge"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 70 | `"public"."legal_check_action"("p_action_key" "text", "p_business_id" "uuid" DEFAULT NULL::"uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 71 | `"public"."legal_effective_version"("p_document_type" "text", "p_audience" "text" DEFAULT 'ALL'::"text", "p_business_id" "uuid" DEFAULT NULL::"uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 72 | `"public"."legal_gate_business_activation"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 73 | `"public"."legal_gate_commission_insert"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 74 | `"public"."legal_gate_employee_activation"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 75 | `"public"."legal_gate_order_insert"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 76 | `"public"."legal_gate_referral_insert"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 77 | `"public"."legal_is_admin"("p_user_id" "uuid" DEFAULT "auth"."uid"())` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 78 | `"public"."legal_publish_version"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_version_number" integer, "p_effective_at" timestamp with time zone DEFAULT "now"())` | `''` | EMPTY_PATH | NOT REVIEWED |
| 79 | `"public"."legal_suspend_document"("p_actor_user_id" "uuid", "p_document_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 80 | `"public"."legal_update_document"("p_actor_user_id" "uuid", "p_document_id" "uuid", "p_title" "text", "p_target_audience" "text"[], "p_required_consent" boolean, "p_requires_reconsent" boolean, "p_sector_codes" "text"[] DEFAULT ARRAY[]::"text"[], "p_locale" "text" DEFAULT 'ar-EG'::"text")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 81 | `"public"."legal_update_draft_version"("p_actor_user_id" "uuid", "p_version_id" "uuid", "p_content" "text")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 82 | `"public"."list_mantigo_captain_rides_backend"("p_user_id" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 83 | `"public"."list_mantigo_customer_rides_backend"("p_user_id" "uuid", "p_ride_id" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 84 | `"public"."list_open_mantigo_rides_backend"("p_user_id" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 85 | `"public"."lock_mantigo_fare_backend"("p_user_id" "uuid", "p_ride_id" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 86 | `"public"."mantigo_accept_bid"("p_ride_id" "text", "p_bid_id" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 87 | `"public"."mantigo_cancel_ride"("p_ride_id" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 88 | `"public"."mantigo_create_ride"("p_vehicle_category" "text", "p_ride_type" "text", "p_pickup_location" "text", "p_destination_location" "text", "p_proposed_price" numeric, "p_note" "text" DEFAULT ''::"text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 89 | `"public"."mantigo_guard_bid_rate_limit"()` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 90 | `"public"."mantigo_guard_ride_rate_limit"()` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 91 | `"public"."mantigo_rate_limit_check"("p_action" "text", "p_actor" "uuid")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 92 | `"public"."mantigo_rate_ride"("p_ride_id" "text", "p_rating" integer, "p_comment" "text" DEFAULT ''::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 93 | `"public"."mantigo_submit_bid"("p_ride_id" "text", "p_offered_price" numeric, "p_captain_name" "text" DEFAULT ''::"text", "p_vehicle_category" "text" DEFAULT 'MALAKI'::"text", "p_vehicle_model" "text" DEFAULT ''::"text", "p_captain_message" "text" DEFAULT ''::"text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 94 | `"public"."mantigo_update_proposed_price"("p_ride_id" "text", "p_new_price" numeric)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 95 | `"public"."mark_notifications_read_backend"("p_notification_id" character varying DEFAULT NULL::character varying)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 96 | `"public"."match_mantigo_ride_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_limit" integer DEFAULT 10)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 97 | `"public"."mnty_active_membership"("p_tenant_id" character varying DEFAULT NULL::character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" character varying DEFAULT NULL::character varying)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 98 | `"public"."mnty_can"("p_permission" "text", "p_tenant_id" character varying DEFAULT NULL::character varying, "p_business_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" character varying DEFAULT NULL::character varying)` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 99 | `"public"."mnty_can_platform_admin"()` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 100 | `"public"."mnty_push_notification_hook"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 101 | `"public"."payment_financial_reconciliation_check"("p_tenant_id" character varying DEFAULT NULL::character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 102 | `"public"."post_financial_journal"("p_entry" "jsonb", "p_lines" "jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 103 | `"public"."post_financial_journal_backend"("p_user_id" "uuid", "p_entry" "jsonb", "p_lines" "jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 104 | `"public"."preview_commission_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying, "p_gross_amount" numeric)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 105 | `"public"."process_verified_digital_page_payment_backend"("p_order_id" "uuid", "p_external_event_id" "text", "p_event_type" "text", "p_status" "text", "p_signature_verified" boolean, "p_amount" numeric, "p_currency" "text", "p_provider_transaction_id" "text", "p_provider_order_id" "text", "p_raw_payload" "jsonb")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 106 | `"public"."process_verified_provider_payment"("p_event_id" character varying, "p_tenant_id" character varying, "p_provider" character varying, "p_external_event_id" character varying, "p_payment_intent_id" character varying, "p_event_type" character varying, "p_signature_verified" boolean, "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" character varying, "p_platform_received_amount" numeric DEFAULT NULL::numeric)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 107 | `"public"."process_verified_subscription_payment"("p_event_id" "text", "p_external_event_id" "text", "p_subscription_payment_intent_id" "uuid", "p_provider_transaction_id" "text", "p_provider_confirmed_amount" numeric, "p_provider_confirmed_currency" "text", "p_signature_verified" boolean)` | `''` | EMPTY_PATH | NOT REVIEWED |
| 108 | `"public"."receive_purchase_stock_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_purchase_order_id" character varying, "p_receipt_number" character varying, "p_warehouse_id" character varying, "p_product_id" "uuid", "p_received_quantity" numeric, "p_unit_cost" numeric)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 109 | `"public"."receive_stock_transfer_backend"("p_transfer_id" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 110 | `"public"."record_cash_commission_due"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_provider_id" character varying, "p_gross_amount" numeric, "p_commission_amount" numeric, "p_currency" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 111 | `"public"."record_legal_consent"("p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid" DEFAULT NULL::"uuid", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_device_info" "jsonb" DEFAULT '{}'::"jsonb", "p_session_id" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'APP'::"text", "p_consent_status" "text" DEFAULT 'ACCEPTED'::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 112 | `"public"."record_legal_consent_backend"("p_user_id" "uuid", "p_document_id" "uuid", "p_document_version_id" "uuid", "p_account_type" "text", "p_agreement_id" "uuid" DEFAULT NULL::"uuid", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_device_info" "jsonb" DEFAULT '{}'::"jsonb", "p_session_id" "text" DEFAULT NULL::"text", "p_source" "text" DEFAULT 'APP_EDGE'::"text", "p_consent_status" "text" DEFAULT 'ACCEPTED'::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 113 | `"public"."record_refund_backend"("p_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_order_id" "uuid", "p_payment_intent_id" character varying, "p_customer_wallet_id" character varying, "p_original_amount" numeric, "p_refund_amount" numeric, "p_reason" "text", "p_idempotency_key" character varying, "p_journal_entry" "jsonb", "p_journal_lines" "jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 114 | `"public"."release_digital_page_payment_intent_claim_backend"("p_order_id" "uuid", "p_user_id" "uuid", "p_claim_token" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 115 | `"public"."resolve_commission_rule_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_module_id" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 116 | `"public"."resolve_legacy_scope"("p_branch_id" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 117 | `"public"."resolve_platform_feature"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying DEFAULT NULL::character varying, "p_sector_id" character varying DEFAULT NULL::character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 118 | `"public"."restaurant_erp_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 119 | `"public"."restaurant_table_mutate"("p_action" "text", "p_payload" "jsonb", "p_idempotency_key" "text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 120 | `"public"."review_mantigo_captain_application"("p_admin_user_id" "uuid", "p_captain_id" "uuid", "p_decision" "text", "p_vehicle_category" "text" DEFAULT NULL::"text", "p_vehicle_model" "text" DEFAULT NULL::"text", "p_vehicle_plate" "text" DEFAULT NULL::"text", "p_service_areas" "jsonb" DEFAULT NULL::"jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 121 | `"public"."set_mantigo_financial_config_backend"("p_admin_user_id" "uuid", "p_commission_rate" numeric, "p_currency" "text" DEFAULT 'EGP'::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 122 | `"public"."set_platform_feature_flag_backend"("p_scope_type" character varying, "p_scope_id" character varying, "p_sector_id" character varying, "p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_module_code" character varying, "p_feature_code" character varying, "p_enabled" boolean, "p_configuration" "jsonb" DEFAULT '{}'::"jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 123 | `"public"."settle_mantigo_captain_backend"("p_admin_user_id" "uuid", "p_ride_id" "text", "p_channel" "text" DEFAULT 'BANK_TRANSFER'::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 124 | `"public"."smm_admin_credit_wallet"("p_actor" "uuid", "p_user" "uuid", "p_amount" numeric, "p_description" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 125 | `"public"."smm_bootstrap_first_admin"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 126 | `"public"."smm_debit_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 127 | `"public"."smm_get_provider_secret"("p_provider_id" "uuid")` | `'public', 'vault'` | REVIEW_PATH | NOT REVIEWED |
| 128 | `"public"."smm_refund_wallet"("p_user" "uuid", "p_amount" numeric, "p_reference" "uuid", "p_description" "text" DEFAULT 'SMM refund'::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 129 | `"public"."smm_set_provider_secret"("p_provider_id" "uuid", "p_actor_user_id" "uuid", "p_secret" "text")` | `'public', 'vault'` | REVIEW_PATH | NOT REVIEWED |
| 130 | `"public"."start_business_trial_backend"("p_business_id" "uuid", "p_tier_code" "text", "p_sector" "text", "p_trial_days" integer, "p_idempotency_key" "text", "p_actor_user_id" "uuid")` | `''` | EMPTY_PATH | NOT REVIEWED |
| 131 | `"public"."submit_job_application_backend"("p_user_id" "uuid", "p_job_id" "uuid", "p_applicant_name" "text", "p_applicant_phone" "text", "p_qualifications" "text", "p_cv_summary_text" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 132 | `"public"."submit_mantigo_captain_application"("p_user_id" "uuid", "p_vehicle_category" "text", "p_vehicle_model" "text", "p_vehicle_plate" "text", "p_service_areas" "jsonb" DEFAULT '[]'::"jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 133 | `"public"."track_business_referral_event"("p_code" character varying, "p_event_type" character varying DEFAULT 'VISIT'::character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 134 | `"public"."update_mantigo_captain_presence_backend"("p_user_id" "uuid", "p_availability_status" "text", "p_current_lat" double precision DEFAULT NULL::double precision, "p_current_lon" double precision DEFAULT NULL::double precision)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 135 | `"public"."update_mantigo_trip_status_backend"("p_user_id" "uuid", "p_ride_id" "text", "p_target_status" "text", "p_reason" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 136 | `"public"."update_medical_appointment_status_backend"("p_user_id" "uuid", "p_appointment_id" "text", "p_target_status" "text")` | `'public', 'pg_temp'` | REVIEW_PATH | NOT REVIEWED |
| 137 | `"public"."update_order_status_backend"("p_order_id" "uuid", "p_tenant_id" character varying, "p_user_id" "uuid", "p_new_status" character varying, "p_reason" "text" DEFAULT NULL::"text")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 138 | `"public"."update_purchase_order_status_backend"("p_order_id" character varying, "p_target_status" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 139 | `"public"."update_stock_transfer_status_backend"("p_transfer_id" character varying, "p_target_status" character varying)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 140 | `"public"."update_support_ticket_status_backend"("p_ticket_id" character varying, "p_status" character varying, "p_assigned_user_id" "uuid" DEFAULT NULL::"uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 141 | `"public"."upsert_catalog_item_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_branch_id" character varying, "p_legacy_ref" character varying, "p_item_type" character varying, "p_name_ar" "text", "p_name_en" "text", "p_description" "text", "p_sku" character varying, "p_tax_rate" numeric, "p_metadata" "jsonb", "p_id" "uuid" DEFAULT NULL::"uuid")` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 142 | `"public"."upsert_catalog_price_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_catalog_item_id" "uuid", "p_branch_id" character varying, "p_currency" character varying, "p_unit_price" numeric, "p_effective_from" timestamp with time zone DEFAULT "now"(), "p_effective_to" timestamp with time zone DEFAULT NULL::timestamp with time zone)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 143 | `"public"."upsert_catalog_settings_backend"("p_tenant_id" character varying, "p_business_id" "uuid", "p_currency" character varying DEFAULT 'EGP'::character varying, "p_delivery_fee" numeric DEFAULT 0, "p_tax_inclusive" boolean DEFAULT false, "p_allow_discounts" boolean DEFAULT false)` | `'public'` | REVIEW_PATH | NOT REVIEWED |
| 144 | `"public"."validate_mantigo_ride_acceptance_integrity"()` | `'public'` | REVIEW_PATH | NOT REVIEWED |

## Guardrails

- Do not change `review_status` to `APPROVED_FOR_DISPOSABLE_REPLAY` until a qualified human reviewer has completed the per-function and policy/grant review.
- Replay only in a disposable local Supabase/PostgreSQL environment. The replay workflow must continue to fail closed while review is pending.
- Never apply this schema snapshot to production or put it in `supabase/migrations`.
- Passing static scans or CI tests does not establish that the snapshot is free of all secrets, that the functions are secure, or that production is release-ready.
