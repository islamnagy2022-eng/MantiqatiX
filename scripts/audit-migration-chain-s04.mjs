import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const migrationDir = "supabase/migrations";
const recoveredDir = "supabase/recovered-migrations";
const files = fs.readdirSync(migrationDir).filter(name => name.endsWith(".sql")).sort();
const invalidNames = files.filter(name => !/^\d{14}_.+\.sql$/.test(name));
const byVersion = new Map();
for (const name of files) {
  const version = name.slice(0, 14);
  byVersion.set(version, [...(byVersion.get(version) ?? []), name]);
}
const duplicateVersions = [...byVersion.entries()].filter(([, names]) => names.length > 1);
const approvedLegacyDuplicateGroups = [
  ["20260928020000_rc101_g6_rls_permissive_policy_hardening.sql", "20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql"],
  ["20260928060000_rc109_harden_order_support_tenant_boundaries.sql", "20260928060000_restore_registration_request_dml_grants.sql"],
  ["20260928190000_rc162_mantigo_trip_state_machine.sql", "20260928190000_rc200_cross_tenant_customer_payment_authorization.sql"],
  ["20260928200000_rc164_mantigo_direct_delete_lockdown.sql", "20260928200000_rc164_retire_legacy_mantigo_mutator.sql", "20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql"],
  ["20260928210000_rc172_restore_medical_booking_contract.sql", "20260928210000_rc207_official_global_mnty_cover_ads.sql"],
].map(names => [...names].sort().join("|"));
const approvedDuplicateGroups = duplicateVersions.filter(([, names]) =>
  approvedLegacyDuplicateGroups.includes([...names].sort().join("|"))
);
const unapprovedDuplicateVersions = duplicateVersions.filter(([, names]) =>
  !approvedLegacyDuplicateGroups.includes([...names].sort().join("|"))
);
const required = [
  "20261009120000_rc425_atomic_mantigo_paymob_payment.sql",
  "20261009130000_rc426_digital_page_provider_order_binding.sql",
  "20261009140000_rc427_one_active_payment_intent_per_order.sql",
  "20261009150000_rc428_atomic_provider_failure_webhook.sql",
  "20261009160000_rc429_atomic_subscription_failure_webhook.sql",
  "20261009170000_rc430_atomic_subscription_success_webhook.sql",
  "20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql",
  "20261009190000_rc432_smm_wallet_transaction_idempotency.sql",
  "20261009200000_rc434_atomic_erp_purchase_receiving.sql",
  "20261009210000_rc435_subscription_provider_intent_claim.sql",
  "20261009220000_rc436_atomic_financial_journal.sql",
  "20261009230000_rc437_purchase_order_lines_receiving_limits.sql",
  "20261009240000_rc438_purchase_order_creation_with_lines.sql",
  "20261010010000_rc439_encrypted_checkout_recovery.sql",
  "20261010020000_rc440_exposed_security_definer_search_path.sql",
  "20261010030000_rc441_platform_admin_scope_hardening.sql",
  "20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql",
  "20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql",
  "20261013190000_rc522_audit_log_append_only.sql",
  "20261013200000_rc523_mantigo_financial_report_canonical_columns.sql"
];
const liveLedgerOrderAliases = [
  ["20261001090000_harden_provider_onboarding_authority.sql", "20261001164107_20261001090000_harden_provider_onboarding_authority.sql"],
  ["20261001165000_grant_provider_onboarding_authenticated_insert.sql", "20261001164222_grant_provider_onboarding_authenticated_insert.sql"],
  ["20261001100000_lock_provider_onboarding_direct_writes.sql", "20261001164327_20261001100000_lock_provider_onboarding_direct_writes.sql"],
  ["20261001193000_grant_provider_onboarding_service_role.sql", "20261001170235_provider_onboarding_service_role_rpc_grants.sql"],
  ["20261002090000_super_admin_platform_authority_reconciliation.sql", "20261002044021_20261002090000_super_admin_platform_authority_reconciliation.sql"],
  ["20261002010000_rc238_fix_settlement_journal_posting.sql", "20261002083009_fix_settlement_journal_posting_order.sql"],
  ["20261002190000_rc228_digital_page_products_orders.sql", "20261002073217_rc228_digital_page_products_orders.sql"],
  ["20261002191000_rc229_digital_page_payment_columns.sql", "20261002073331_rc229_digital_page_payment_columns.sql"],
  ["20261002192000_rc230_digital_page_payment_events.sql", "20261002073419_rc230_digital_page_payment_events.sql"],
  ["20261002110000_rc248_digital_page_content_publishing.sql", "20261002090131_rc248_digital_page_content_publishing.sql"],
  ["20261002100000_rc256_critical_fk_indexes.sql", "20261002094419_rc256_critical_fk_indexes.sql"],
  ["20261001200000_provider_location_markaz_baseline.sql", "20261001173313_provider_location_center_baseline.sql"],
  ["20261001201000_provider_location_center_policy.sql", "20261001173412_provider_location_center_policy.sql"],
  ["20261002123000_rc258_centralized_server_rbac.sql", "20261002122425_rc258_centralized_server_rbac.sql"],
  ["20261002123500_rc258_use_central_rbac_admin_ad.sql", "20261002122515_rc258_use_central_rbac_admin_ad.sql"],
  ["20261002150000_rc264_registration_review_audit_notifications.sql", "20261002142519_rc264_registration_review_audit_notifications.sql"],
  ["20261004004500_rc339_seed_mantiqati_official_showcase.sql", "20261004005819_rc339_seed_mantiqati_official_showcase.sql"],
  ["20261006110000_rc_mantigo_production_completion_v1.sql", "20261006101048_rc_mantigo_production_completion_v1.sql"],
  ["20261006133000_mantigo_p0_security_audit_notification_hardening.sql", "20261006103016_mantigo_p0_security_audit_notification_hardening.sql"],
  ["20261006150000_mantigo_matching_idempotency_v1.sql", "20261006103232_mantigo_matching_idempotency_v1.sql"],
  ["20261006121810_mantigo_rating_immutability_v1.sql", "20261006121907_mantigo_rating_immutability_v1.sql"],
  ["20261006170000_mantigo_trip_reason_hardening_v1.sql", "20261006131243_mantigo_trip_reason_hardening_v1.sql"],
  ["20261006171000_mantigo_notification_lifecycle_v1.sql", "20261006140601_mantigo_notification_lifecycle_v1.sql"],
  ["20261006172000_mantigo_stale_expiration_engine_v1.sql", "20261006140650_mantigo_stale_expiration_engine_v1.sql"],
  ["20261006173000_mantigo_state_integrity_constraints_v1.sql", "20261006141819_mantigo_state_integrity_constraints_v1.sql"],
  ["20261006174000_mantigo_acceptance_integrity_trigger_v1.sql", "20261006142022_mantigo_acceptance_integrity_trigger_v1.sql"],
  ["20261006175000_mantigo_cancellation_reason_policy_v1.sql", "20261006142337_mantigo_cancellation_reason_policy_v1.sql"],
  ["20261006180000_mantigo_customer_tracking_and_finance_indexes_v1.sql", "20261006144647_mantigo_customer_tracking_and_finance_indexes_v1.sql"],
  ["20261006181000_mantigo_admin_dashboard_kpi_rpc_v1.sql", "20261006144733_mantigo_admin_dashboard_kpi_rpc_v1.sql"],
  ["20261006184500_mantigo_captain_earnings_dashboard_v2.sql", "20261006154605_mantigo_captain_earnings_dashboard_v2.sql"],
  ["20261006190000_mantigo_admin_financial_report_v1.sql", "20261006154704_mantigo_admin_financial_report_v1.sql"],
  ["20261006214500_mantigo_financial_config_rls_v1.sql", "20261006184441_mantigo_financial_config_rls_v1.sql"],
  ["20261007001000_mantigo_abuse_rate_limits_v1.sql", "20261006212355_mantigo_abuse_rate_limits_v1.sql"],
  ["20261007002000_mantigo_rate_limit_idempotency_compat_v1.sql", "20261006212705_mantigo_rate_limit_idempotency_compat_v1.sql"],
  ["20261006235500_job_application_backend_submit_v1.sql", "20261007011733_job_application_backend_submit_v1.sql"],
  ["20261007021500_reverse_bidding_server_authority_v1.sql", "20261007011736_reverse_bidding_server_authority_v1.sql"],
  ["20261007030000_cleanup_duplicate_job_application_index_v1.sql", "20261007011740_cleanup_duplicate_job_application_index_v1.sql"],
  ["20261007060000_education_request_server_authority_v1.sql", "20261007021723_education_request_server_authority_v1.sql"],
  ["20261007023000_remove_duplicate_mantigo_bids_index_v1.sql", "20261007022318_remove_duplicate_mantigo_bids_index_v1.sql"],
  ["20261007064000_mantigo_rate_limit_internal_boundary_v1.sql", "20261007064228_mantigo_rate_limit_internal_boundary_v1.sql"],
  ["20261007073000_harden_private_order_status_trigger_execute_v1.sql", "20261007065754_harden_private_order_status_trigger_execute_v1.sql"],
  ["20261008000001_rc422_security_definer_caller_contract_v1.sql", "20261007223944_rc422_security_definer_caller_contract_v1.sql"],
  ["20261008000002_rc423_restrictive_authenticated_guard_policies.sql", "20261008125422_rc423_convert_authenticated_guard_policies_to_restrictive.sql"],
];
const missingLiveLedgerOrderAliases = liveLedgerOrderAliases.filter(([source, target]) =>
  !fs.existsSync(path.join(migrationDir, source)) ||
  fs.existsSync(path.join(migrationDir, target))
);
const missingRequired = required.filter(name => !fs.existsSync(path.join(migrationDir, name)));
const rc433 = files.filter(name => /rc433/i.test(name));
const recovered = fs.existsSync(recoveredDir)
  ? fs.readdirSync(recoveredDir).filter(name => name.endsWith(".sql")).sort()
  : [];
const digest = name => crypto.createHash("sha256").update(fs.readFileSync(path.join(migrationDir, name))).digest("hex");
const report = {
  schema_version: 1,
  audit: "MANTIQATIX S04 migration-chain source audit",
  migration_file_count: files.length,
  invalid_filename_count: invalidNames.length,
  duplicate_version_groups: duplicateVersions.map(([version, names]) => ({ version, names })),
  approved_legacy_duplicate_group_count: approvedDuplicateGroups.length,
  unapproved_duplicate_version_groups: unapprovedDuplicateVersions.map(([version, names]) => ({ version, names })),
  missing_required_sources: missingRequired,
  live_ledger_order_aliases: liveLedgerOrderAliases.map(([source, target]) => ({ source, target })),
  invalid_live_ledger_order_aliases: missingLiveLedgerOrderAliases,
  known_unrecovered_live_ledger_migrations: [
    { version: "20261001113451", name: "restore_authenticated_read_grants_notifications_marketing_projects", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261001163708", name: "provider_onboarding_requests", source_status: "TEST_ONLY_BASELINE_NOT_HISTORICAL_DDL" },
    { version: "20261001164118", name: "harden_provider_onboarding_tenant_scope", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261001173122", name: "provider_location_selector_public_read", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261005053703", name: "rc368_complete_sector_categories_27", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261006101110", name: "rc_mantigo_captain_read_contract_v1", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261006122809", name: "mantigo_financial_config_explicit_deny_policy_v1", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261006122824", name: "mantigo_financial_config_policy_cleanup_v1", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261006141122", name: "mantigo_trip_status_notification_merge_v1", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261006145156", name: "commission_engine_idempotency_and_preview_v1", source_status: "NOT_FOUND_IN_REPOSITORY" },
    { version: "20261006233409", name: "job_application_idempotency_v1", source_status: "NOT_FOUND_IN_REPOSITORY" }
  ],
  clean_history_certified: false,
  disposable_normalization_required: approvedDuplicateGroups.length > 0 || liveLedgerOrderAliases.length > 0,
  rc433_sources: rc433,
  rc433_status: rc433.length ? "SOURCE_PRESENT" : "NOT_FOUND_NOT_VERIFIED_GAP",
  recovered_archive_file_count: recovered.length,
  recovered_archive_is_executable: false,
  required_source_sha256: Object.fromEntries(required.filter(name => fs.existsSync(path.join(migrationDir, name))).map(name => [name, digest(name)])),
  first_12_migration_files: files.slice(0, 12),
  latest_12_migration_files: files.slice(-12),
  result: invalidNames.length || unapprovedDuplicateVersions.length || missingRequired.length || missingLiveLedgerOrderAliases.length ? "FAIL" : "PASS_WITH_APPROVED_DISPOSABLE_NORMALIZATION_AND_KNOWN_SOURCE_GAP"
};
console.log(JSON.stringify(report, null, 2));
if (invalidNames.length) console.error("Invalid migration filenames:", invalidNames.join(", "));
if (unapprovedDuplicateVersions.length) {
  for (const [version, names] of unapprovedDuplicateVersions) console.error(`Unapproved duplicate migration version ${version}: ${names.join(" | ")}`);
}
if (missingRequired.length) console.error("Missing required migration sources:", missingRequired.join(", "));
assert.equal(invalidNames.length, 0, "Every migration filename must use the 14-digit timestamp convention");
assert.equal(unapprovedDuplicateVersions.length, 0, "Only the exact approved legacy duplicate groups may be normalized in disposable CI");
assert.equal(missingRequired.length, 0, "Every required S04 migration source must exist");
assert.equal(missingLiveLedgerOrderAliases.length, 0, "Digital-page migration sources and their live-ledger replay aliases must remain reconciled");
