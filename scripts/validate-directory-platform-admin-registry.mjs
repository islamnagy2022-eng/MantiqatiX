import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const helper = readFileSync("supabase/functions/directory-listings/platform-admin-registry.mjs", "utf8");
const helperTests = readFileSync("supabase/functions/directory-listings/platform-admin-registry.test.mjs", "utf8");
const registryMigration = readFileSync("supabase/migrations/20261119040000_rc484_registry_backed_is_platform_admin.sql", "utf8");

const verifiedUser = edge.indexOf("if (userError || !user || user.is_anonymous)");
const userClient = edge.indexOf("const userClient = createClient(supabaseUrl, serviceKey");
const registryCall = edge.indexOf('userClient.rpc("is_platform_admin")');
const registryGate = edge.indexOf("if (!resolveDirectoryPlatformAdmin(registryResult, registryError))");
const importAction = edge.indexOf('if (action === "IMPORT_DOCTOR_BATCH")');

assert.ok(verifiedUser >= 0 && userClient > verifiedUser,
  "the caller must be verified before creating the JWT-bound registry client");
assert.ok(userClient < registryCall && registryCall < registryGate && registryGate < importAction,
  "registry authorization must run before every platform-admin directory action");
assert.match(edge, /global:\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`/,
  "registry RPC must receive the verified caller JWT, never the service-role identity");
assert.match(edge, /PLATFORM_ADMIN_CHECK_UNAVAILABLE/,
  "registry errors must fail closed with an unavailable response");
assert.match(edge, /PLATFORM_ADMIN_REQUIRED/,
  "non-registry users must be denied");
assert.doesNotMatch(edge, /mnty_can_platform_admin/,
  "membership-derived legacy helper must not authorize platform administration");
assert.doesNotMatch(edge, /some\(platformAdmin\)/,
  "tenant membership rows must not substitute for the private platform-admin registry");

assert.match(helper, /!registryError && registryResult === true/,
  "only an exact successful boolean registry result may authorize");
assert.match(helperTests, /resolveDirectoryPlatformAdmin\(true, null\)/);
assert.match(helperTests, /registry unavailable/);
assert.match(registryMigration, /function public\.is_platform_admin\(\)/i);
assert.match(registryMigration, /security definer/i);
assert.match(registryMigration, /set search_path(?:=|to)\s*''/i);
assert.match(registryMigration, /private\.platform_admins/i);
assert.match(registryMigration, /grant execute on function public\.is_platform_admin\(\) to authenticated/i);

console.log("DIRECTORY_PLATFORM_ADMIN_REGISTRY_BOUNDARY=PASS");
