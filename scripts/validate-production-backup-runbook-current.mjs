import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const runbook = read("docs/runbooks/PRODUCTION_BACKUP_RESTORE_RC484_20261119.md");
const backlog = read("docs/release/WEBSITE_FIRST_LAUNCH_AND_POST_LAUNCH_BACKLOG_20261122.md");

const runbookRequirements = [
  "v2.122.0",
  "supabase --version",
  "https://supabase.com/docs/reference/cli/supabase-db-dump",
  "`auth`",
  "`storage`",
  "auth.users",
  "auth.identities",
  "storage.buckets",
  "storage.objects",
  "NOT INCLUDED / NOT VERIFIED",
  "79-version",
  "20261120193000",
  "20261123010000",
  "20261123221950",
  "RC922",
  "PR #1013",
];
for (const required of runbookRequirements) {
  assert.ok(runbook.includes(required), `Backup runbook is missing required current-scope text: ${required}`);
}

const backlogRequirements = [
  "79 required migration IDs",
  "0/79 exact required identifiers",
  "20261120193000",
  "20261123010000",
  "20261123221950",
];
for (const required of backlogRequirements) {
  assert.ok(backlog.includes(required), `Release backlog is missing current 79-version gate text: ${required}`);
}
assert.ok(!backlog.includes("76 required migration IDs"), "Release backlog still describes 76 as the current required migration count.");
assert.ok(!backlog.includes("0/76 present") && !backlog.includes("0/78 exact required identifiers"), "Release backlog still uses a superseded migration status.");

console.log("PRODUCTION_BACKUP_RUNBOOK_CURRENT_RELEASE_CONTRACT=PASS");
console.log("BACKUP_COVERAGE_AUTH_STORAGE_EXPLICIT=PASS");
console.log("CURRENT_RELEASE_MIGRATION_COUNT=79");
