import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const migrationDir = "supabase/migrations";
const recoveredDir = "supabase/recovered-migrations";
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

function inventory(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(name => name.endsWith(".sql"))
    .sort()
    .map(name => {
      const filePath = path.join(directory, name);
      const match = /^(\d{14})_(.+)\.sql$/.exec(name);
      return {
        name,
        path: filePath,
        version: match?.[1] ?? null,
        validName: Boolean(match),
        sha256: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
      };
    });
}

const migrationFiles = inventory(migrationDir);
const recoveredFiles = inventory(recoveredDir);
const allFiles = [...migrationFiles, ...recoveredFiles];
const invalidNames = allFiles.filter(file => !file.validName);
function groupByVersion(files) {
  const byVersion = new Map();
  for (const file of files) {
    if (!file.version) continue;
    byVersion.set(file.version, [...(byVersion.get(file.version) ?? []), file]);
  }
  return byVersion;
}
function duplicateGroups(files) {
  return [...groupByVersion(files).entries()]
    .filter(([, grouped]) => grouped.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([version, grouped]) => ({ version, files: grouped.map(file => ({path:file.path,name:file.name,sha256:file.sha256})) }));
}
const duplicateVersions = duplicateGroups(migrationFiles);
const recoveredDuplicateVersions = duplicateGroups(recoveredFiles);
const migrationVersions = groupByVersion(migrationFiles);
const recoveredVersions = groupByVersion(recoveredFiles);
const crossDirectoryVersionCollisions = [...migrationVersions.entries()]
  .filter(([version]) => recoveredVersions.has(version))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([version, migrationGroup]) => ({
    version,
    migrations: migrationGroup.map(file => ({path:file.path,name:file.name,sha256:file.sha256})),
    recovered: recoveredVersions.get(version).map(file => ({path:file.path,name:file.name,sha256:file.sha256}))
  }));

const byName = new Map();
for (const file of allFiles) byName.set(file.name, [...(byName.get(file.name) ?? []), file]);
const duplicateNames = [...byName.entries()].filter(([, files]) => files.length > 1);
const conflictingCopies = duplicateNames
  .filter(([, files]) => new Set(files.map(file => file.sha256)).size > 1)
  .map(([name, files]) => ({name, copies:files.map(file => ({path:file.path,sha256:file.sha256}))}));

const missingRequired = required.filter(name => !fs.existsSync(path.join(migrationDir, name)));
const rc433 = allFiles.filter(file => /rc433/i.test(file.name)).map(file => file.path);
const report = {
  schema_version: 2,
  audit: "MANTIQATIX S04 migration-chain source audit",
  scope: "Read-only source inventory; recovered-migrations is archival and is not automatically executable.",
  migration_file_count: migrationFiles.length,
  recovered_archive_file_count: recoveredFiles.length,
  recovered_archive_is_executable: false,
  total_sql_file_count: allFiles.length,
  invalid_filename_count: invalidNames.length,
  executable_unique_filename_version_count: groupByVersion(migrationFiles).size,
  executable_duplicate_version_groups: duplicateVersions,
  recovered_archive_unique_filename_version_count: groupByVersion(recoveredFiles).size,
  recovered_archive_duplicate_version_groups: recoveredDuplicateVersions,
  cross_directory_version_collisions: crossDirectoryVersionCollisions,
  duplicate_basename_groups: duplicateNames.map(([name, files]) => ({name,paths:files.map(file=>file.path)})),
  conflicting_duplicate_copies: conflictingCopies,
  missing_required_sources: missingRequired,
  rc433_sources: rc433,
  rc433_status: rc433.length ? "SOURCE_PRESENT" : "NOT_FOUND_NOT_VERIFIED_GAP",
  required_source_sha256: Object.fromEntries(required
    .filter(name => fs.existsSync(path.join(migrationDir, name)))
    .map(name => [name, migrationFiles.find(file => file.name === name)?.sha256])),
  first_12_migration_files: migrationFiles.slice(0, 12).map(file => file.name),
  latest_12_migration_files: migrationFiles.slice(-12).map(file => file.name),
  result: invalidNames.length || duplicateVersions.length || conflictingCopies.length || missingRequired.length ? "FAIL" : "PASS"
};
console.log(JSON.stringify(report, null, 2));
if (invalidNames.length) console.error("Invalid migration filenames:", invalidNames.map(file=>file.path).join(", "));
if (duplicateVersions.length) {
  for (const {version,files} of duplicateVersions) console.error(`Duplicate executable migration version ${version}: ${files.map(file=>file.path).join(" | ")}`);
}
if (recoveredDuplicateVersions.length) {
  console.warn("Recovered archive contains duplicate versions; archive is not executable and needs source reconciliation:", JSON.stringify(recoveredDuplicateVersions));
}
if (crossDirectoryVersionCollisions.length) {
  console.warn("Version prefixes occur in both executable and archival directories; compare exact content and keep recovered archive non-executable:", JSON.stringify(crossDirectoryVersionCollisions));
}
if (conflictingCopies.length) {
  for (const item of conflictingCopies) console.error(`Same filename with different content: ${item.name}`);
}
if (missingRequired.length) console.error("Missing required migration sources:", missingRequired.join(", "));
assert.equal(invalidNames.length, 0, "Every migration filename in both source directories must use the 14-digit timestamp convention");
assert.equal(duplicateVersions.length, 0, "Migration versions must be unique within supabase/migrations; recovered archive versions are reported separately because that directory is non-executable");
assert.equal(conflictingCopies.length, 0, "Same-name copies across source directories must have identical SHA-256");
assert.equal(missingRequired.length, 0, "Every required S04 migration source must exist in supabase/migrations");
