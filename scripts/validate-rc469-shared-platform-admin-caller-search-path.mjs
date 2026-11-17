import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migration = readFileSync("supabase/migrations/20261117010000_rc469_shared_platform_admin_caller_search_path.sql", "utf8");
const overlay = readFileSync("supabase/tests/baselines/rc469_live_shared_helper_search_path_overlay.sql", "utf8");
const integration = readFileSync("supabase/tests/rc469_shared_platform_admin_caller_search_path.sql", "utf8");
const workflow = readFileSync(".github/workflows/rc469-shared-platform-admin-caller-search-path.yml", "utf8");

assert.match(migration, /BEGIN;[\s\S]*DO \$preflight\$/);
assert.match(migration, /RC469_CANONICAL_PLATFORM_ADMIN_GUARD_NOT_HARDENED/);
assert.match(migration, /RC469_EXPECTS_FOUR_SHARED_PLATFORM_ADMIN_CALLERS/);
assert.match(migration, /RC469_ANON_EXECUTE_MUST_REMAIN_REVOKED/);
assert.match(migration, /RC469_AUTHENTICATED_EXECUTE_MUST_BE_PRESERVED/);
assert.match(migration, /RC469_EMPTY_SEARCH_PATH_POSTCONDITION_FAILED/);
for (const signature of [
  "admin_create_global_ad",
  "fulfill_digital_page_publish",
  "review_mantigo_captain_application",
  "set_mantigo_financial_config_backend",
]) {
  assert.ok(new RegExp("ALTER FUNCTION public\\." + signature + "\\([\\s\\S]*?SET search_path = ''", "i").test(migration),
    signature + " must have an empty search_path");
}
assert.match(overlay, /SET search_path TO 'public', 'pg_temp'/);
assert.match(overlay, /SET search_path TO 'public'/);
assert.ok(overlay.includes("REVOKE ALL ON FUNCTION public.admin_create_global_ad") && overlay.includes("FROM PUBLIC, anon"));
assert.ok(overlay.includes("GRANT EXECUTE ON FUNCTION public.set_mantigo_financial_config_backend") && overlay.includes("TO authenticated"));
assert.match(integration, /RC469_EXPECTED_FOUR_SECURITY_DEFINER_EMPTY_PATH_CALLERS/);
assert.match(integration, /RC469_ANON_EXECUTE_WAS_GRANTED/);
assert.match(integration, /RC469_AUTHENTICATED_EXECUTE_WAS_REMOVED/);
assert.match(workflow, /20261117010000_rc469_shared_platform_admin_caller_search_path.sql/);
assert.match(workflow, /rc469_live_shared_helper_search_path_overlay.sql/);
assert.match(workflow, /rc469_shared_platform_admin_caller_search_path.sql/);
console.log("RC469 shared platform-admin caller search_path contract: PASS");
