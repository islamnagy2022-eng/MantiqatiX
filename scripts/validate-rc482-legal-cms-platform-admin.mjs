import assert from "node:assert/strict";
import fs from "node:fs";

const edge = fs.readFileSync("supabase/functions/legal-cms/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261119020000_rc482_legal_cms_platform_admin_registry.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc482_legal_cms_platform_admin_integration.sql", "utf8");

assert.match(edge, /auth\.getUser\(a\.slice\(7\)\)/);
assert.match(edge, /rpc\("legal_cms_is_platform_admin",\{p_user_id:user\.id\}\)/);
assert.match(edge, /isPlatformAdmin!==true/);
assert.doesNotMatch(edge, /from\("user_memberships"\)/);

assert.match(migration, /FROM\s+private\.platform_admins\s+AS\s+pa/i);
assert.match(migration, /pa\.user_id\s*=\s*p_user_id/i);
assert.match(migration, /SECURITY\s+DEFINER/i);
assert.match(migration, /SET\s+search_path\s*=\s*''/i);
assert.match(migration, /REVOKE\s+ALL\s+ON\s+FUNCTION[\s\S]*FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
assert.match(migration, /GRANT\s+EXECUTE[\s\S]*TO\s+service_role/i);
assert.doesNotMatch(migration, /INSERT\s+INTO\s+private\.platform_admins|UPDATE\s+private\.platform_admins|DELETE\s+FROM\s+private\.platform_admins/i);

for (const marker of [
  "RC482_UNTRUSTED_EXECUTE_GRANTED",
  "RC482_SEARCH_PATH_NOT_EMPTY",
  "RC482_TENANT_ADMIN_WITHOUT_REGISTRY_ALLOWED",
  "RC482_MEMBERSHIP_ROLE_WITHOUT_REGISTRY_ALLOWED",
  "RC482_UNKNOWN_USER_ALLOWED",
]) assert.ok(integration.includes(marker), "Missing RC482 regression: " + marker);

console.log("RC482 Legal CMS platform-admin registry contract: PASS");
