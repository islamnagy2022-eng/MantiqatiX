import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const runbook = read("docs/release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md");
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
  "84 exact migration versions",
  "0/84 exact required version identifiers",
  "20261125120000",
  "RC927",
  "20261120193000",
  "20261123010000",
  "20261123221950",
  "20261124121348",
  "20261124140000",
  "20261124150000",
  "20261125110000",
  "20261125120000",
  "RC926",
  "RC927",
  "RC925",
  "RC925 was merged source-only in PR #1069",
  "45477345349",
  "PR #1071",
  "45480436807",
  "53b8be3784790e56775f16bb51c9c3477cfeb536",
  "RC924",
  "RC923",
  "RC922",
  "PR #1013",
];
for (const required of runbookRequirements) {
  assert.ok(runbook.includes(required), `Backup runbook is missing required current-scope text: ${required}`);
}

assert.ok(!runbook.includes("RC925 is a new source candidate"), "Backup runbook still describes completed RC925 CI as pending.");
const backlogRequirements = [
  "PR #1071",
  "45480436807",
  "53b8be3784790e56775f16bb51c9c3477cfeb536",
  "84 required migration IDs",
  "0/84 exact required identifiers",
  "20261120193000",
  "20261123010000",
  "20261123221950",
  "20261124121348",
  "20261124140000",
  "20261124150000",
  "20261125110000",
  "RC926",
  "RC925",
  "RC924",
  "RC923",
];
for (const required of backlogRequirements) {
  assert.ok(backlog.includes(required), `Release backlog is missing current 84-version gate text: ${required}`);
}
assert.ok(!backlog.includes("76 required migration IDs"), "Release backlog still describes 76 as the current required migration count.");
assert.ok(!backlog.includes("0/76 present") && !backlog.includes("0/78 exact required identifiers"), "Release backlog still uses a superseded migration status.");

console.log("PRODUCTION_BACKUP_RUNBOOK_CURRENT_RELEASE_CONTRACT=PASS");
console.log("BACKUP_COVERAGE_AUTH_STORAGE_EXPLICIT=PASS");
console.log("CURRENT_RELEASE_MIGRATION_COUNT=84");
