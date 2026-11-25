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
  "84 exact migration versions",
  "0/84 exact required version identifiers",
  "20261125120000",
  "RC927",
  "not applied to Production",
];
for (const required of runbookRequirements) {
  assert.ok(runbook.includes(required), "Current backup runbook is missing required scope: " + required);
}

const backlogRequirements = [
  "84 required migration IDs",
  "0/84 exact required identifiers",
  "20261125110000",
  "RC926",
  "20261125120000",
  "RC927",
  "RC480",
  "exact-head static and PostgreSQL 17 tests are pending",
];
for (const required of backlogRequirements) {
  assert.ok(backlog.includes(required), "Release backlog is missing current 84-version gate text: " + required);
}
assert.ok(!backlog.includes("76 required migration IDs"), "Release backlog still describes 76 as the current required migration count.");
assert.ok(!backlog.includes("0/76 present") && !backlog.includes("0/78 exact required identifiers"), "Release backlog still uses a superseded migration status.");

assert.equal(ledger.expected_migration_versions, 84, "manifest must use the 84-version contract");
assert.ok(ledger.required_versions.includes("20261125120000"), "manifest must list RC927");
assert.ok(ledger.missing_versions.includes("20261125120000"), "RC927 must remain explicitly unapplied in Production");
assert.equal(ledger.found_in_live_ledger, 0, "do not manufacture or overstate Production migration ledger entries");

console.log("PRODUCTION_BACKUP_RUNBOOK_CURRENT_RELEASE_CONTRACT=PASS");
console.log("BACKUP_COVERAGE_AUTH_STORAGE_EXPLICIT=PASS");
console.log("CURRENT_RELEASE_MIGRATION_COUNT=84");
