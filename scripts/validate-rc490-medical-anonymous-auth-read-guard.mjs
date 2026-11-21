import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync(
  "supabase/migrations/20261120250000_rc490_medical_anonymous_auth_read_guard.sql","utf8");
const test=fs.readFileSync(
  "supabase/tests/rc490_medical_anonymous_auth_read_integration.sql","utf8");

assert.match(migration,/CREATE\s+POLICY\s+mnty_confirmed_auth_medical_read[\s\S]*?ON\s+public\.medical_appointments[\s\S]*?AS\s+RESTRICTIVE[\s\S]*?FOR\s+SELECT[\s\S]*?TO\s+authenticated[\s\S]*?is_anonymous/i);
assert.match(migration,/relrowsecurity AND c\.relforcerowsecurity/);
assert.match(test,/RC490_ANONYMOUS_MEDICAL_APPOINTMENT_READ_SUCCEEDED/);
assert.match(test,/RC490_CONFIRMED_MEDICAL_READ_REGRESSED/);
assert.ok(migration.includes("(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE"), "medical guard must fail closed on missing claim");
assert.match(test,/RC490_MISSING_ANONYMOUS_CLAIM_READ_SUCCEEDED/);
assert.match(test,/ROLLBACK;/);
console.log("RC490 medical anonymous Auth read isolation contract: PASS");
