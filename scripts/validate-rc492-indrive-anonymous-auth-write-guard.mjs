import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20261120270000_rc492_indrive_anonymous_auth_write_guard.sql","utf8");
const test=fs.readFileSync("supabase/tests/rc492_indrive_anonymous_auth_write_guard_integration.sql","utf8");
for (const command of ["INSERT","UPDATE","DELETE"]) {
  const policy=new RegExp(
    "CREATE\\s+POLICY\\s+mnty_confirmed_auth_indrive_"+command.toLowerCase()+
    "[\\s\\S]*?ON\\s+public\\.indrive_requests[\\s\\S]*?AS\\s+RESTRICTIVE[\\s\\S]*?FOR\\s+"+
    command+"[\\s\\S]*?TO\\s+authenticated[\\s\\S]*?is_anonymous","i");
  assert.match(migration,policy,"missing confirmed-auth InDrive "+command+" guard");
}
for (const marker of [
  "RC492_ANONYMOUS_INDRIVE_UPDATE_SUCCEEDED",
  "RC492_ANONYMOUS_INDRIVE_DELETE_SUCCEEDED",
  "RC492_ANONYMOUS_INDRIVE_INSERT_SUCCEEDED",
  "RC492_CONFIRMED_OWNER_UPDATE_REGRESSED",
  "RC492_CONFIRMED_OWNER_DELETE_REGRESSED"
]) assert.ok(test.includes(marker),"missing RC492 assertion "+marker);
assert.match(migration,/relrowsecurity AND c\.relforcerowsecurity/);
assert.match(test,/ROLLBACK;/);
console.log("RC492 InDrive anonymous Auth write isolation contract: PASS");
