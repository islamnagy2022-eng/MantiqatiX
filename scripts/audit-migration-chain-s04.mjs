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
  missing_required_sources: missingRequired,
  rc433_sources: rc433,
  rc433_status: rc433.length ? "SOURCE_PRESENT" : "NOT_FOUND_NOT_VERIFIED_GAP",
  recovered_archive_file_count: recovered.length,
  recovered_archive_is_executable: false,
  required_source_sha256: Object.fromEntries(required.filter(name => fs.existsSync(path.join(migrationDir, name))).map(name => [name, digest(name)])),
  first_12_migration_files: files.slice(0, 12),
  latest_12_migration_files: files.slice(-12),
  result: invalidNames.length || duplicateVersions.length || missingRequired.length ? "FAIL" : "PASS"
};
console.log(JSON.stringify(report, null, 2));
if (invalidNames.length) console.error("Invalid migration filenames:", invalidNames.join(", "));
if (duplicateVersions.length) {
  for (const [version, names] of duplicateVersions) console.error(`Duplicate migration version ${version}: ${names.join(" | ")}`);
}
if (missingRequired.length) console.error("Missing required migration sources:", missingRequired.join(", "));
assert.equal(invalidNames.length, 0, "Every migration filename must use the 14-digit timestamp convention");
assert.equal(duplicateVersions.length, 0, "Migration versions must be globally unique within supabase/migrations");
assert.equal(missingRequired.length, 0, "Every required S04 migration source must exist");
