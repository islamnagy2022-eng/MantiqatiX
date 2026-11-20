import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120250000_rc490_private_crm_notification_read_guards.sql",
  "utf8",
);
const integration = fs.readFileSync(
  "supabase/tests/rc490_private_crm_notification_read_guards_integration.sql",
  "utf8",
);
for (const table of ["marketing_leads","marketing_projects","notifications"]) {
  assert.ok(migration.includes("'" + table + "'"), "missing migration target: " + table);
  assert.ok(integration.includes("'" + table + "'"), "missing integration target: " + table);
}
assert.match(migration,/AS RESTRICTIVE FOR SELECT TO authenticated/i);
assert.match(migration,/auth\.jwt\(\)->>'is_anonymous'/);
assert.match(integration,/RC490_ANONYMOUS_PRIVATE_READ_SUCCEEDED/);
assert.match(integration,/RC490_CONFIRMED_OWNER_READ_REGRESSED/);
console.log("RC490 private CRM/project/notification read contract: PASS");
