import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const runbook = read("docs/release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md");
const backlog = read("docs/release/WEBSITE_FIRST_LAUNCH_AND_POST_LAUNCH_BACKLOG_20261122.md");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const ledger = manifest.required_release_migration_ledger_check;

const runbookRequirements = [
  "supabase --version",
  "https://supabase.com/docs/reference/cli/supabase-db-dump",
  "excludes Supabase-managed schemas",
  'auth',
  'storage',
  "UNKNOWN / NOT EVIDENCED",
  "Restore to a new project",
  "Storage object bytes",
  "90 exact migration versions",
  "0/90 exact required version identifiers",
  "20261125120000",
  "RC927",
  "20261125130000",
  "RC115",
  "20261126010000",
  "RC928",
  "20261126020000",
  "RC117",
  "20261126030000",
  "RC929",
  "20261128010000",
  "RC931",
  "20261127010000",
  "RC930",
  "20261128010000",
  "RC931",
  "not applied to Production",
];
for (const required of runbookRequirements) {
  assert.ok(runbook.includes(required), "Current backup runbook is missing required scope: " + required);
}

const backlogRequirements = [
  "90 required migration IDs",
  "0/90 exact required identifiers",
  "20261125110000",
  "RC926",
  "20261125130000",
  "RC115",
  "20261125120000",
  "RC927",
  "20261126010000",
  "RC928",
  "20261126020000",
  "RC117",
  "20261126030000",
  "RC929",
  "RC480",
  "RC927 is merged source-only",
];
for (const required of backlogRequirements) {
  assert.ok(backlog.includes(required), "Release backlog is missing current 90-version gate text: " + required);
}
assert.ok(!backlog.includes("76 required migration IDs"), "Release backlog still describes 76 as the current required migration count.");
assert.ok(!backlog.includes("0/76 present") && !backlog.includes("0/78 exact required identifiers"), "Release backlog still uses a superseded migration status.");

assert.equal(ledger.expected_migration_versions, 90, "manifest must use the 90-version contract");
assert.ok(ledger.required_versions.includes("20261125120000"), "manifest must list RC927");
assert.ok(ledger.missing_versions.includes("20261125120000"), "RC927 must remain explicitly unapplied in Production");
assert.ok(ledger.required_versions.includes("20261126010000"), "manifest must list RC928");
assert.ok(ledger.missing_versions.includes("20261126010000"), "RC928 must remain explicitly unapplied in Production");
assert.ok(ledger.required_versions.includes("20261126020000"), "manifest must list the RC117 image provenance repair");
assert.ok(ledger.missing_versions.includes("20261126020000"), "RC117 image provenance repair must remain unapplied in Production");
assert.ok(ledger.required_versions.includes("20261126030000"), "manifest must list RC929 orders confirmed-Auth guard");
assert.ok(ledger.missing_versions.includes("20261126030000"), "RC929 must remain unapplied to Production until coordinated release approval");
assert.ok(ledger.required_versions.includes("20261127010000"), "manifest must list RC930");
assert.ok(ledger.missing_versions.includes("20261127010000"), "RC930 must remain unapplied to Production until coordinated release approval");
assert.ok(ledger.required_versions.includes("20261125130000"), "manifest must list RC115 tenant/business-scoped marketing CRM reads");
assert.ok(ledger.missing_versions.includes("20261125130000"), "RC115 must remain unapplied to Production until coordinated release approval");
assert.ok(ledger.required_versions.includes("20261128010000"), "manifest must list RC931 provider-profile public-read retirement");
assert.ok(ledger.missing_versions.includes("20261128010000"), "RC931 must remain unapplied to Production until coordinated release approval");
assert.equal(ledger.found_in_live_ledger, 0, "do not manufacture or overstate Production migration ledger entries");

console.log("PRODUCTION_BACKUP_RUNBOOK_CURRENT_RELEASE_CONTRACT=PASS");
console.log("BACKUP_COVERAGE_AUTH_STORAGE_EXPLICIT=PASS");
console.log("CURRENT_RELEASE_MIGRATION_COUNT=90");
