import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migrationPath = "supabase/migrations/20261126020000_preserve_marketing_service_image_provenance.sql";
const migration = read(migrationPath);
const historical = read("supabase/migrations/20261027070000_rc117_default_images_and_activity_admin.sql");
const test = read("supabase/tests/rc117_marketing_service_image_provenance_forward_repair.sql");
const contract = read("scripts/production/live-reconciliation-contract.mjs");
const productionVerifier = read("scripts/production/verify-production.mjs");
const migrationGate = read("scripts/validate-production-migration-chain-gate.mjs");
const backupValidator = read("scripts/validate-production-backup-runbook-current.mjs");
const forwardReplay = read(".github/workflows/forward-migration-chain-replay.yml");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const ledger = manifest.required_release_migration_ledger_check;

assert.match(migration, /set image_source = 'owner'/);
assert.match(migration, /nullif\(trim\(coalesce\(image_url,''\)\),''\)\s+is not null/i,
  "non-empty URLs with missing provenance must be classified as owner-supplied");
assert.match(migration, /nullif\(trim\(coalesce\(image_source,''\)\),''\)\s+is null/i,
  "only missing provenance may be updated");
assert.match(migration, /where nullif\(trim\(coalesce\(image_url,''\)\),''\)\s+is null/i,
  "default images may only be generated when the URL is blank");
assert.ok(migration.includes("public.mnty_default_image_url("));
assert.match(historical, /where coalesce\(image_url,''\)='' or coalesce\(image_source,''\)=''/i,
  "the historical RC117 migration must remain immutable; repair stays forward-only");
assert.ok(test.includes("\\i " + migrationPath), "integration test must execute the exact committed migration file");

for (const token of [
  "MNTY-RC117-OWNER",
  "MNTY-RC117-LEGACY-NULL",
  "MNTY-RC117-LEGACY-BLANK",
  "MNTY-RC117-BLANK-IMAGE",
  "MNTY-RC117-AI",
  "MNTY-RC117-AUTO",
  "RC117_NULL_PROVENANCE_CUSTOM_URL_NOT_PRESERVED",
  "RC117_BLANK_PROVENANCE_CUSTOM_URL_NOT_PRESERVED",
  "RC117_BLANK_IMAGE_DEFAULT_NOT_GENERATED",
  "RC117_AI_IMAGE_PROVENANCE_NOT_PRESERVED",
  "RC117_IMAGE_PROVENANCE_REPAIR_NOT_IDEMPOTENT"
]) assert.ok(test.includes(token), "missing RC117 forward-repair case: " + token);

assert.ok(contract.includes('"20261126020000"'), "live release contract must include the repair version");
assert.ok(productionVerifier.includes("20261126020000_preserve_marketing_service_image_provenance.sql"));
assert.ok(migrationGate.includes("20261126020000_preserve_marketing_service_image_provenance.sql"));
assert.match(migrationGate, /required\.length,\s*86/);
assert.equal(ledger.expected_migration_versions, 87);
assert.ok(ledger.required_versions.includes("20261126020000"));
assert.ok(ledger.missing_versions.includes("20261126020000"));
assert.equal(ledger.found_in_live_ledger, 0, "never manufacture a Production ledger entry");
assert.ok(backupValidator.includes("CURRENT_RELEASE_MIGRATION_COUNT=87"));
assert.ok(forwardReplay.includes("node scripts/validate-rc117-image-provenance-forward-repair.mjs"));
assert.ok(forwardReplay.includes("supabase/tests/rc117_marketing_service_image_provenance_forward_repair.sql"));
assert.ok(forwardReplay.includes('psql "$db_url" -v ON_ERROR_STOP=1 -v mantiqati_disposable=on -f supabase/tests/rc117_marketing_service_image_provenance_forward_repair.sql'));

assert.deepEqual(ledger.required_versions, [...ledger.required_versions].sort(),
  "all exact source versions must remain chronologically ordered");
console.log("RC117 image-provenance forward repair source contract: PASS (87-version gate)");
