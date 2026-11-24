import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120280000_rc493_private_crm_notification_read_guards.sql",
  "utf8",
);
const fixture = fs.readFileSync(
  "supabase/tests/rc490_private_crm_notification_read_guards_fixture.sql",
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
assert.ok(migration.includes("auth.jwt()") && migration.includes("IS FALSE"), "missing fail-closed confirmed Auth claim guard");
assert.match(
  migration,
  /CREATE POLICY rc493_confirmed_auth_select_guard ON public\.%I AS RESTRICTIVE FOR SELECT TO authenticated USING/i,
  "RC493 must create a restrictive SELECT policy; a permissive policy would OR with existing owner policies"
);
assert.match(fixture,/AS PERMISSIVE FOR SELECT TO authenticated USING/);
assert.match(fixture,/GRANT SELECT ON public\.%I TO authenticated/);
assert.match(integration,/is_anonymous":true/);
assert.match(integration,/is_anonymous":false/);
assert.ok(migration.includes("auth.jwt()") && migration.includes("is_anonymous"), "missing anonymous Auth claim guard");
assert.match(integration,/RC493_ANONYMOUS_PRIVATE_READ_SUCCEEDED/);
assert.match(integration,/RC493_CONFIRMED_OWNER_READ_REGRESSED/);
assert.match(integration,/RC493_MISSING_ANONYMOUS_CLAIM_READ_SUCCEEDED/);
console.log("RC493 private CRM/project/notification read contract: PASS");
