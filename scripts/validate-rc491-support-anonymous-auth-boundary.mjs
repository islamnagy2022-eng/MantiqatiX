import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20261120260000_rc491_support_anonymous_auth_boundary.sql","utf8");
const test=fs.readFileSync("supabase/tests/rc491_support_anonymous_auth_boundary_integration.sql","utf8");
assert.match(migration,/CREATE\s+POLICY\s+mnty_confirmed_auth_support_select[\s\S]*?ON\s+public\.support_tickets[\s\S]*?AS\s+RESTRICTIVE[\s\S]*?FOR\s+SELECT[\s\S]*?TO\s+authenticated[\s\S]*?is_anonymous/i);
assert.match(migration,/relrowsecurity AND c\.relforcerowsecurity/);
assert.match(migration,/has_table_privilege\('authenticated','public\.support_tickets','SELECT'\)/);
assert.match(test,/RC491_ANONYMOUS_SUPPORT_TICKET_READ_SUCCEEDED/);
assert.match(test,/RC491_CONFIRMED_SUPPORT_TICKET_READ_REGRESSED/);
assert.ok(migration.includes("(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE"), "support guard must fail closed on missing claim");
assert.match(test,/RC491_MISSING_ANONYMOUS_CLAIM_READ_SUCCEEDED/);
assert.match(test,/ROLLBACK;/);
console.log("RC491 support anonymous Auth read boundary contract: PASS");
