import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120200000_rc485_catalog_rpc_registry_root.sql",
  "utf8",
);
const prior = fs.readFileSync(
  "supabase/migrations/20261026092940_rc107_catalog_manager_business_branch_scope.sql",
  "utf8",
);
const profilePrior = fs.readFileSync(
  "supabase/migrations/20261027111500_preserve_catalog_profile_metadata.sql",
  "utf8",
);

const functions = [
  "adjust_catalog_stock_backend",
  "create_catalog_warehouse_backend",
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "upsert_catalog_settings_backend",
  "update_catalog_item_status_backend",
  "upsert_catalog_business_profile_backend",
];

function functionBlock(source, name) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = source.indexOf("$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return source.slice(start, end + "$function$;".length);
}

function signatureHeader(source, name) {
  return functionBlock(source, name).split(/\nRETURNS\b/i)[0];
}

for (const name of functions) {
  const oldSource = name === "upsert_catalog_business_profile_backend" ? profilePrior : prior;
  const oldBlock = functionBlock(oldSource, name);
  const newBlock = functionBlock(migration, name);

  assert.equal(signatureHeader(migration, name), signatureHeader(oldSource, name),
    `${name} signature must remain unchanged`);
  assert.match(newBlock, /SECURITY DEFINER/i, `${name} must remain SECURITY DEFINER`);
  assert.match(newBlock, /public\.is_platform_admin\(\)/,
    `${name} platform-root path must use the RC484 registry helper`);
  assert.doesNotMatch(newBlock, /permissions\s*->>\s*'scope'|permissions\s*->>\s*'full_control'/i,
    `${name} must not trust mutable tenant membership metadata for platform-root authority`);
  assert.match(newBlock, /'OWNER'|'BUSINESS_OWNER'|'ADMIN'/,
    `${name} must preserve tenant-local owner/admin permissions`);
  assert.ok(oldBlock.length > 0);
}

assert.match(migration, /RC485_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_REQUIRED/);
assert.match(migration, /private\.platform_admins/);
assert.match(migration, /search_path=""/);
assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);

console.log("RC485 catalog RPC registry-root source contract: PASS (7 functions, signatures preserved, tenant-local roles retained)");
