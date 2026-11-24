# Required 82-Migration Source-to-Live Effect Crosswalk — 2026-11-24

**Repository baseline:** `main @ da1b17ccbaeefd501dee1456bd76b3f3e39bbbd8`
**Live Supabase project:** `moyhiluyhjsujhwlyeuu`
**Required migration set:** `scripts/production/verify-production.mjs` and `scripts/production/live-reconciliation-contract.mjs`
**Live ledger:** 310 rows through `20261110150618`
**Release status:** **BLOCKED / NOT CERTIFIED**

## Executive result

- Required ordered source migrations: **82/82**; names come from the canonical production verifier.
- Exact required version IDs in the live ledger: **0/82**. This is an identity mismatch, not proof every physical effect is absent.
- The historical 63-source crosswalk covers the earlier source/object set; its per-object statuses are historical and are not silently promoted to current status here.
- The 19 later migrations from RC484 through RC925 were source-reviewed and checked against current Production catalogs/policies on 2026-11-24.
- A separate 76-object curated physical register was refreshed on 2026-11-24: 35 present / 41 absent. Presence is not semantic parity.
- No Production mutation was performed.

## Full ordered source list and current evidence

| Required source version | Exact source file | Release/effect | Source object contract | Latest Production read-back / disposition |
|---|---|---|---|---|
| `20261009120000` | `20261009120000_rc425_atomic_mantigo_paymob_payment.sql` | RC425 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009130000` | `20261009130000_rc426_digital_page_provider_order_binding.sql` | RC426 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009140000` | `20261009140000_rc427_one_active_payment_intent_per_order.sql` | RC427 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009150000` | `20261009150000_rc428_atomic_provider_failure_webhook.sql` | RC428 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009160000` | `20261009160000_rc429_atomic_subscription_failure_webhook.sql` | RC429 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009170000` | `20261009170000_rc430_atomic_subscription_success_webhook.sql` | RC430 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009180000` | `20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql` | RC431 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009190000` | `20261009190000_rc432_smm_wallet_transaction_idempotency.sql` | RC432 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009200000` | `20261009200000_rc434_atomic_erp_purchase_receiving.sql` | RC434 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009210000` | `20261009210000_rc435_subscription_provider_intent_claim.sql` | RC435 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009220000` | `20261009220000_rc436_atomic_financial_journal.sql` | RC436 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009230000` | `20261009230000_rc437_purchase_order_lines_receiving_limits.sql` | RC437 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261009240000` | `20261009240000_rc438_purchase_order_creation_with_lines.sql` | RC438 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010010000` | `20261010010000_rc439_encrypted_checkout_recovery.sql` | RC439 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010020000` | `20261010020000_rc440_exposed_security_definer_search_path.sql` | RC440 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010030000` | `20261010030000_rc441_platform_admin_scope_hardening.sql` | RC441 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010060000` | `20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql` | RC446 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010120000` | `20261010120000_rc442_approval_action_audit_atomicity.sql` | RC442 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010140000` | `20261010140000_rc444_crm_business_scope_rls.sql` | RC444 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010150000` | `20261010150000_rc447_matrimony_profile_privacy_boundary.sql` | RC447 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010161000` | `20261010161000_rc448_matrimony_request_lifecycle_authority.sql` | RC448 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010170000` | `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql` | RC449 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010175000` | `20261010175000_rc449a_financial_journal_schema_prerequisites.sql` | RC449A | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010180000` | `20261010180000_rc450_financial_journal_service_role_boundary.sql` | RC450 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010200000` | `20261010200000_rc451_targeted_ads_empty_search_path.sql` | RC451 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010210000` | `20261010210000_rc452_marketing_crm_tenant_scope.sql` | RC452 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261010220000` | `20261010220000_rc453_marketing_campaign_backend.sql` | RC453 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261011010000` | `20261011010000_rc456_smm_service_role_access_boundary.sql` | RC456 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261014230000` | `20261014230000_rc525_digital_page_product_platform_admin_scope.sql` | RC525 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261023020000` | `20261023020000_rc102_provider_services_owner_write_grants.sql` | RC102 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261023030000` | `20261023030000_rc103_order_status_branch_scope.sql` | RC103 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261023040000` | `20261023040000_rc104_order_idempotency_scope.sql` | RC104 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261023050000` | `20261023050000_rc105_order_create_service_role_identity.sql` | RC105 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261023060000` | `20261023060000_rc106_order_status_service_role_identity.sql` | RC106 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027030000` | `20261027030000_rc113_super_admin_control_center_foundation.sql` | RC113 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027040000` | `20261027040000_rc114_business_employee_hiring_system.sql` | RC114 | PASS | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027050000` | `20261027050000_rc115_control_center_integration.sql` | RC115 | PASS | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027060000` | `20261027060000_rc116_business_subscriber_admin.sql` | RC116 | PASS | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027070000` | `20261027070000_rc117_default_images_and_activity_admin.sql` | RC117 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027090000` | `20261027090000_rc113_user_membership_business_scope_idempotency.sql` | RC113 | BLOCKED/MIXED | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261027093000` | `20261027093000_add_qadam_alsaad_homewares_store.sql` | — | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261031100000` | `20261031100000_rc463_trigger_only_security_definer_acl.sql` | RC463 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261113214500` | `20261113214500_rc464_platform_admin_live_registry_hardening.sql` | RC464 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261113220000` | `20261113220000_rc464b_orders_select_policy_preflight.sql` | RC464B | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261114010000` | `20261114010000_rc465_orders_read_scope_hardening.sql` | RC465 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261114020000` | `20261114020000_rc466_business_branch_read_scope_hardening.sql` | RC466 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261115010000` | `20261115010000_rc467_commission_scope_hardening.sql` | RC467 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261115030000` | `20261115030000_rc468_digital_page_payment_claim_hardening.sql` | RC468 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261117010000` | `20261117010000_rc469_shared_platform_admin_caller_search_path.sql` | RC469 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261117020000` | `20261117020000_rc470_digital_page_webhook_forward_repair.sql` | RC470 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261117190000` | `20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql` | RC471 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118010000` | `20261118010000_rc472_directory_claim_review_atomicity.sql` | RC472 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118020000` | `20261118020000_rc473_directory_listing_contact_consent.sql` | RC473 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118030000` | `20261118030000_rc474_payment_intent_business_branch_scope.sql` | RC474 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118040000` | `20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql` | RC475 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118050000` | `20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql` | RC476 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118060000` | `20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql` | RC477 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118070000` | `20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql` | RC478 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118190000` | `20261118190000_rc479_revoke_anon_provider_profile_base_read.sql` | RC479 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118210000` | `20261118210000_rc480_digital_pages_anon_column_boundary.sql` | RC480 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261118220000` | `20261118220000_rc481_legal_edge_service_role_column_grants.sql` | RC481 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261119020000` | `20261119020000_rc482_legal_platform_admin_registry_guard.sql` | RC482 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261119030000` | `20261119030000_rc483_atomic_legal_cms_create_audit.sql` | RC483 | NO_DIRECT_OBJECT_CONTRACT | Historical source/object status from 2026-11-19 crosswalk; refresh current object contracts before release. |
| `20261119040000` | `20261119040000_rc484_registry_backed_is_platform_admin.sql` | RC484 | private.platform_admins; public.is_platform_admin() | Registry exists; RLS ON/FORCE RLS OFF. Helper remains SECURITY INVOKER, search_path=public, membership-derived. **BLOCKED: present but not source contract.** |
| `20261120193000` | `20261120193000_rc479_restrict_anonymous_auth_provider_profile_select.sql` | RC479 forward repair | RESTRICTIVE SELECT policy marketing_provider_profiles_confirmed_auth_select | Expected restrictive policy absent. **BLOCKED: missing.** |
| `20261120200000` | `20261120200000_rc485_catalog_rpc_registry_root.sql` | RC485 | Seven direct catalog RPC definitions and registry-root helper precondition | All seven signatures exist; all remain search_path=public and none references private.platform_admins. Three expose service_role EXECUTE; ACL parity needs separate review. **BLOCKED: present but contract-incompatible.** |
| `20261120210000` | `20261120210000_rc486_catalog_price_version_serialization.sql` | RC486 | catalog_item_prices_item_branch_version_uidx; serialized upsert_catalog_price_backend | Index absent; live price RPC remains search_path=public and lacks pg_catalog.pg_advisory_xact_lock. **BLOCKED: missing index and function behavior.** |
| `20261120220000` | `20261120220000_rc487_remove_smm_first_user_admin_bootstrap.sql` | RC487 | Drop auth.users.trg_smm_bootstrap_admin and public.smm_bootstrap_first_admin(); service_role SELECT-only allowlist | Trigger and bootstrap function both still exist. **BLOCKED: prohibited bootstrap path remains.** |
| `20261120230000` | `20261120230000_rc488_storage_anonymous_auth_write_guard.sql` | RC488 | Three RESTRICTIVE policies on storage.objects for INSERT/UPDATE/DELETE | All three expected confirmed-Auth restrictive policies absent. **BLOCKED: 0/3 policies present.** |
| `20261120240000` | `20261120240000_rc489_financial_anonymous_auth_read_guard.sql` | RC489 | 15 RESTRICTIVE confirmed-Auth SELECT policies across private financial/payment tables | All 15 expected policies absent in latest direct policy inventory. **BLOCKED: 0/15 policies present.** |
| `20261120250000` | `20261120250000_rc490_medical_anonymous_auth_read_guard.sql` | RC490 | RESTRICTIVE confirmed-Auth SELECT policy on public.medical_appointments | Expected policy absent. **BLOCKED: missing.** |
| `20261120260000` | `20261120260000_rc491_support_anonymous_auth_boundary.sql` | RC491 | RESTRICTIVE confirmed-Auth SELECT policy on public.support_tickets | Expected policy absent. **BLOCKED: missing.** |
| `20261120270000` | `20261120270000_rc492_indrive_anonymous_auth_write_guard.sql` | RC492 | Three RESTRICTIVE request-write policies and one bid-read policy for InDrive | All four expected policies absent. **BLOCKED: 0/4 policies present.** |
| `20261120280000` | `20261120280000_rc493_private_crm_notification_read_guards.sql` | RC493 | RESTRICTIVE confirmed-Auth SELECT policies on marketing_leads, marketing_projects, notifications | All three expected policies absent. **BLOCKED: 0/3 policies present.** |
| `20261120290000` | `20261120290000_rc494_settlement_financial_atomic_registry_scope_hardening.sql` | RC494 | settlement_transactions.business_id, FK, index, registry-scoped settlement writer | Business column and index absent. Settlement writer exists but uses search_path=pg_catalog, public; platform registry helper remains legacy. **BLOCKED: partial base only; scope/owner contract absent.** |
| `20261121020000` | `20261121020000_rc495_storage_filename_regex_forward_repair.sql` | RC495 | Five Storage policy replacements: platform branding INSERT/UPDATE/DELETE and profile-media owner INSERT/UPDATE | All five policies exist but remain membership-SUPER_ADMIN based and use old filename predicates, not registry-backed/[.] source contract. **BLOCKED: present but semantically stale.** |
| `20261121030000` | `20261121030000_rc496_mantigo_bid_accept_state_invariant.sql` | RC496 | mantigo_bids_one_accepted_per_ride_idx; accept/create bid and fare-lock replacements | Three functions exist but remain search_path=public; required partial unique index absent. **BLOCKED: partial base; invariant not installed.** |
| `20261123010000` | `20261123010000_rc921_medical_appointment_provider_state_machine.sql` | RC921 | update_medical_appointment_status_backend(uuid,text,text) assigned-provider/forward-only state machine | Function exists but remains search_path=public, pg_temp; live body lacks assigned-provider and forward-transition guards. **BLOCKED: legacy body.** |
| `20261123221950` | `20261123221950_rc922_medical_appointment_tenant_wide_provider_scope.sql` | RC922 | Forward replacement of medical status RPC with tenant-wide SERVICE_PROVIDER scope only for its own active profile in exact appointment business | Same live function remains legacy search_path=public, pg_temp and lacks assigned-provider guard. **BLOCKED: forward repair not applied.** |
| `20261124121348` | `20261124121348_rc923_catalog_rpc_anonymous_auth_guard.sql` | RC923 | Forward replacements for three direct catalog RPCs with anonymous Auth denial | Three target RPCs still have no anonymous-claim guard; other four use old COALESCE guard. All seven remain search_path=public. **BLOCKED: source replacement not applied.** |
| `20261124140000` | `20261124140000_rc924_agreement_participant_read_scope.sql` | RC924 | RESTRICTIVE confirmed-Auth agreement SELECT guard and participant-only read policy | Restrictive agreements_confirmed_auth_select absent. Existing agreements_participant_read is PERMISSIVE, correlates ap.agreement_id=ap.id instead of agreements.id, and uses COALESCE false. **BLOCKED: present but incorrect; privacy-critical.** |
| `20261124150000` | `20261124150000_rc925_catalog_rpc_missing_anonymous_claim_guard.sql` | RC925 | Explicit is_anonymous IS DISTINCT FROM 'false' guard in all seven catalog RPCs | All seven signatures exist; four retain COALESCE guard and three have no claim guard. None has explicit-false guard; all remain search_path=public. **BLOCKED: source-only; not applied.** |

## Exact aliases already proven — do not replay

| Source version/file | Existing ledger version | Evidence | Disposition |
|---|---|---|---|
| `20261009010000_rc424_atomic_digital_page_payment_webhook.sql` | `20261008222845` | Exact stored SQL statement byte match | Alias confirmed; preserve immutable ledger |
| `20261027100000_mantiqatix_marketing_contact_details.sql` | `20261027041411` | Exact source blob alias | Alias confirmed; preserve immutable ledger |
| `20261101150000_directory_source_permission_evidence.sql` | `20261101140105` | Exact stored SQL statement byte match | Alias confirmed; preserve immutable ledger |

## Interpretation rules

1. Exact ID absent is a ledger fact only. It does not prove the migration's physical effect is absent.
2. Object present is not semantic pass. Verify exact function overload/body, owner, SECURITY DEFINER mode, empty search_path, effective ACL, RLS/FORCE RLS, policy permissiveness/restrictiveness and caller behavior.
3. Policy present is not a pass if the predicate is wrong, permissive when restrictive is required, or correlates the wrong row.
4. Partial/historical base must not be classified as the full forward contract.
5. Do not rewrite migration history, synthesize ledger rows or replay the 82-migration chain directly on Production.
6. Keep affected Edge/payment/settlement/directory endpoints fail-closed until their DB + Edge dependency slice is reconciled and independently tested.

## Current high-priority blockers proven by read-only evidence

- Platform Admin registry exists but FORCE RLS is off; is_platform_admin() remains SECURITY INVOKER and membership-derived.
- mnty_can_platform_admin() remains SECURITY DEFINER with search_path=public, pg_temp and legacy unscoped helper behavior.
- Seven catalog RPCs remain search_path=public; four use legacy COALESCE anonymous checks and three have no claim check. None requires an explicit false claim.
- RC488/RC489/RC490/RC491/RC492/RC493 restrictive policies are absent in the checked scope.
- RC487's first-user SMM admin trigger/function remain present.
- RC494 settlement business column/index are absent; settlement writer remains on a legacy search path.
- RC495 Storage policies remain membership-based with old filename predicates.
- RC496 partial unique accepted-bid index is absent.
- RC921/RC922 medical status RPC remains on the old definition and search_path; assigned-provider/forward-only guards are absent.
- RC924 restrictive agreement guard is absent and existing participant policy has a wrong parent-row correlation predicate.
- RC925 is source-only and not applied to Production.

## Next work

1. Expand current live physical-effect read-back beyond the 76-object curated sample, especially policy definitions, constraints, triggers, overloads and all 82 migration dependencies.
2. Build the coordinated DB → RPC/ACL/RLS → Edge bundle/version → deployed-origin E2E dependency graph.
3. Obtain owner-controlled encrypted DB + Storage backups, prove Auth/Vault coverage, and complete isolated PostgreSQL 17 restore/rollback with measured RPO/RTO.
4. Only then prepare the coordinated, explicitly approved Production release window.

**Production mutations:** NONE.