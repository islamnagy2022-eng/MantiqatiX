import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20261120260000_rc491_support_anonymous_auth_boundary.sql","utf8");
const test=fs.readFileSync("supabase/tests/rc491_support_anonymous_auth_boundary_integration.sql","utf8");
for (const marker of [
  "mnty_confirmed_auth_support_select","mnty_confirmed_auth_support_insert",
  "mnty_confirmed_auth_support_update","mnty_confirmed_auth_ticket_messages_select",
  "mnty_confirmed_auth_ticket_messages_insert"
]) assert.ok(migration.includes(marker),"missing restrictive support boundary "+marker);
assert.match(migration,/relrowsecurity AND c\.relforcerowsecurity/);
for (const marker of [
  "RC491_ANONYMOUS_SUPPORT_TICKET_READ_SUCCEEDED",
  "RC491_ANONYMOUS_SUPPORT_MESSAGE_READ_SUCCEEDED",
  "RC491_ANONYMOUS_SUPPORT_MESSAGE_INSERT_SUCCEEDED",
  "RC491_CONFIRMED_SUPPORT_TICKET_READ_REGRESSED",
  "RC491_CONFIRMED_SUPPORT_MESSAGE_READ_REGRESSED"
]) assert.ok(test.includes(marker),"missing RC491 assertion "+marker);
assert.match(test,/ROLLBACK;/);
console.log("RC491 support anonymous Auth boundary contract: PASS");
