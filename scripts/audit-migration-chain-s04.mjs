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
  disposable_normalization_required: approvedDuplicateGroups.length > 0,
  missing_required_sources: missingRequired,
  rc433_sources: rc433,
  rc433_status: rc433.length ? "SOURCE_PRESENT" : "NOT_FOUND_NOT_VERIFIED_GAP",
  recovered_archive_file_count: recovered.length,
  recovered_archive_is_executable: false,
  required_source_sha256: Object.fromEntries(required.filter(name => fs.existsSync(path.join(migrationDir, name))).map(name => [name, digest(name)])),
  first_12_migration_files: files.slice(0, 12),
  latest_12_migration_files: files.slice(-12),
  result: invalidNames.length || unapprovedDuplicateVersions.length || missingRequired.length ? "FAIL" : "PASS_WITH_APPROVED_DISPOSABLE_NORMALIZATION"
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
