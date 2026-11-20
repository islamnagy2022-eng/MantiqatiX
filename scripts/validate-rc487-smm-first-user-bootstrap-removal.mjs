import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120220000_rc487_remove_smm_first_user_admin_bootstrap.sql",
  "utf8",
);
const test = fs.readFileSync(
  "supabase/tests/rc487_smm_first_user_bootstrap_removal_integration.sql",
  "utf8",
);

assert.match(migration, /DROP TRIGGER IF EXISTS trg_smm_bootstrap_admin ON auth\.users/i);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.smm_bootstrap_first_admin\(\)/i);
assert.match(migration, /RC487_UNEXPECTED_SMM_BOOTSTRAP_TRIGGER_DEPENDENCY/);
assert.doesNotMatch(migration, /\b(delete|truncate)\s+from\s+public\.smm_admins/i,
  "existing trusted SMM admin allowlist rows must be preserved");
assert.match(test, /RC487_FIRST_USER_BOOTSTRAP_FUNCTION_STILL_EXISTS/);
assert.match(test, /RC487_FIRST_USER_BOOTSTRAP_TRIGGER_STILL_EXISTS/);
assert.match(test, /RC487_CLIENT_SMM_ADMIN_TABLE_PRIVILEGE_EXPOSURE/);
assert.match(test, /RC487_SERVICE_ROLE_MUST_NOT_MUTATE_SMM_ADMIN_ALLOWLIST/);
console.log("RC487 source contract: PASS (removes signup privilege bootstrap, preserves allowlist, retains backend-only ACL)");
