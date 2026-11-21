import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20261120270000_rc492_indrive_anonymous_auth_write_guard.sql","utf8");
const fixture=fs.readFileSync("supabase/tests/rc492_indrive_anonymous_auth_write_guard_fixture.sql","utf8");
const test=fs.readFileSync("supabase/tests/rc492_indrive_anonymous_auth_write_guard_integration.sql","utf8");
for (const command of ["DELETE"]) {
  const policy=new RegExp(
    "CREATE\\s+POLICY\\s+mnty_confirmed_auth_indrive_"+command.toLowerCase()+
    "[\\s\\S]*?ON\\s+public\.indrive_requests[\\s\\S]*?AS\\s+RESTRICTIVE[\\s\\S]*?FOR\\s+"+
    command+"[\\s\\S]*?TO\\s+authenticated[\\s\\S]*?is_anonymous","i");
  assert.match(migration,policy,"missing confirmed-auth InDrive "+command+" guard");
}
for (const marker of [
  "RC492_ANONYMOUS_INDRIVE_DELETE_SUCCEEDED",
  "RC492_CONFIRMED_OWNER_DELETE_REGRESSED"
]) assert.ok(test.includes(marker),"missing RC492 assertion "+marker);
assert.ok(migration.includes("(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE"), "InDrive guard must fail closed on missing claim");
assert.doesNotMatch(test,/RC492_MISSING_ANONYMOUS_CLAIM_WRITE_SUCCEEDED/);
assert.match(test,/RC492_CONFIRMED_OWNER_DELETE_REGRESSED/);
const authenticatedSection = test.split("SET LOCAL ROLE authenticated;")[1] ?? "";
assert.doesNotMatch(authenticatedSection,/UPDATE public\.indrive_requests|INSERT INTO public\.indrive_requests/i,
  "integration must not assert operations that Production does not grant to authenticated");
assert.match(migration,/relrowsecurity AND c\.relforcerowsecurity/);
assert.doesNotMatch(migration,/has_table_privilege/i,
  "RC492 must not require or widen table grants; existing Production grants remain unchanged");
assert.doesNotMatch(migration,/\bGRANT\b/i,
  "RC492 must not grant new direct table privileges");
assert.ok(migration.includes("mnty_confirmed_auth_indrive_bids_read"),
  "RC492 must fail closed for anonymous and missing-claim bid reads");
assert.ok(test.includes("RC492_MISSING_ANONYMOUS_CLAIM_BID_READ_SUCCEEDED"),
  "RC492 integration must test missing-claim bid-read denial");
assert.match(test,/ROLLBACK;/);
assert.match(fixture,/GRANT SELECT, DELETE ON public\.indrive_requests TO authenticated;/, "request fixture must mirror Production SELECT and DELETE grants");
assert.match(fixture,/GRANT SELECT ON public\.indrive_bids TO authenticated;/, "bid fixture must mirror Production SELECT grant");
assert.doesNotMatch(fixture,/GRANT (?:INSERT|UPDATE) ON public\.indrive_requests|GRANT (?:INSERT|UPDATE|DELETE) ON public\.indrive_bids/, "fixture must not widen Production direct table grants");
console.log("RC492 InDrive anonymous Auth read/delete isolation contract: PASS");
