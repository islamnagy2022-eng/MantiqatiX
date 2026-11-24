import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261124140000_rc924_agreement_participant_read_scope.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc924_agreement_participant_read_scope_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc924_agreement_participant_read_scope_integration.sql", "utf8");

assert.match(migration,/DROP POLICY IF EXISTS agreements_participant_read ON public\.agreements/i);
assert.match(migration,/CREATE POLICY agreements_participant_read[\s\S]*?ON public\.agreements[\s\S]*?FOR SELECT\\s+TO authenticated/i);
assert.match(migration,/ap\.agreement_id\s*=\s*agreements\.id/i);
assert.match(migration,/ap\.user_id\s*=\s*\(SELECT auth\.uid\(\)\)/i);
assert.match(migration,/private\.legal_is_admin\(\(SELECT auth\.uid\(\)\)\)/i);
assert.match(migration,/COALESCE\([\s\S]*?is_anonymous[\s\S]*?false/i);
assert.doesNotMatch(migration,/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+ON\s+TABLE/i);
assert.doesNotMatch(migration,/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM/i);

for (const marker of [
  "ap.agreement_id = ap.id",
  "RC924_PARTICIPANT_A_SCOPE_FAILURE",
  "RC924_PARTICIPANT_B_SCOPE_FAILURE",
  "RC924_UNRELATED_USER_READS_AGREEMENTS",
  "RC924_ANONYMOUS_AUTH_USER_READS_AGREEMENTS",
  "RC924_PLATFORM_ADMIN_SCOPE_FAILURE",
]) assert.ok(fixture.includes(marker) || integration.includes(marker), "missing RC924 regression case: "+marker);

assert.match(integration,/agreements\.id/);
assert.match(integration,/is_anonymous":true/);
assert.match(fixture,/private\.legal_is_admin/);
console.log("RC924 agreement participant read-scope contract: PASS");
