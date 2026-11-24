import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const rc485 = read("supabase/migrations/20261120200000_rc485_catalog_rpc_registry_root.sql");
const rc923 = read("supabase/migrations/20261124010000_rc923_catalog_anonymous_auth_rpc_guard.sql");
const test = read("supabase/tests/rc923_catalog_anonymous_auth_rpc_guard_integration.sql");
const workflow = read(".github/workflows/forward-migration-chain-replay.yml");

function functionBlock(source, name) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = source.indexOf("$function$;", start);
  assert.notEqual(end, -1, `unterminated ${name}`);
  return source.slice(start, end + "$function$;".length);
}

const repaired = [
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "update_catalog_item_status_backend",
];
for (const name of repaired) {
  const oldBlock = functionBlock(rc485, name);
  const newBlock = functionBlock(rc923, name);
  assert.doesNotMatch(oldBlock, /auth\.jwt\(\)->>\s*'is_anonymous'/i,
    `${name}: immutable RC485 must not be edited`);
  assert.match(newBlock, /auth\.uid\(\)\s+IS\s+NULL\s+OR[\s\S]{0,180}auth\.jwt\(\)->>\s*'is_anonymous'/i,
    `${name}: RC923 must reject Anonymous Auth sessions`);
  assert.match(newBlock, /SECURITY DEFINER/i);
  assert.match(newBlock, /SET search_path TO ''/i);
  assert.equal(
    functionBlock(newBlock, name).split(/\nRETURNS\b/i)[0],
    functionBlock(rc485, name).split(/\nRETURNS\b/i)[0],
    `${name}: signature must remain unchanged`,
  );
}
assert.match(rc923, /RC923_REQUIRED_CATALOG_RPC_MISSING/);
assert.match(rc923, /RC923_CATALOG_RPC_SECURITY_DEFINER_CONTRACT_MISMATCH/);
assert.match(rc923, /BEGIN;/);
assert.match(rc923, /COMMIT;/);

const allRpcNames = [
  "adjust_catalog_stock_backend",
  "create_catalog_warehouse_backend",
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "upsert_catalog_settings_backend",
  "update_catalog_item_status_backend",
  "upsert_catalog_business_profile_backend",
];
for (const name of allRpcNames) {
  assert.ok(test.includes(`public.${name}(`), `missing anonymous integration call for ${name}`);
}
assert.match(test,/set_config\('request\.jwt\.claim',v_claims::text,true\)/);
assert.match(test,/set_config\('request\.jwt\.claims',v_claims::text,true\)/);
assert.match(test,/auth\.jwt\(\)->>'is_anonymous'/);
assert.match(test,/RC923_CONFIRMED_USER_DID_NOT_REACH_TENANT_RBAC/);
assert.ok(workflow.includes("node scripts/validate-rc923-catalog-anonymous-auth-rpc-guard.mjs"));
assert.ok(workflow.includes("supabase/tests/rc923_catalog_anonymous_auth_rpc_guard_integration.sql"));
assert.ok(workflow.includes("RC923_CATALOG_ANONYMOUS_AUTH_RPC_GUARD_INTEGRATION"));

console.log("RC923 catalog Anonymous Auth source contract: PASS (3 forward-only RPC replacements, 7 direct RPC tests).");
