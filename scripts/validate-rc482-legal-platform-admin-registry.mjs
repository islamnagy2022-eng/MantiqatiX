import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261119020000_rc482_legal_platform_admin_registry_guard.sql", "utf8");
const cms = fs.readFileSync("supabase/functions/legal-cms/index.ts", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc482_legal_platform_admin_registry_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc482_legal_platform_admin_registry_integration.sql", "utf8");

assert.equal((migration.match(/CREATE OR REPLACE FUNCTION private\\.legal_is_admin/g) || []).length, 2,
  "RC482 must harden both private legal admin helper signatures");
assert.equal((migration.match(/FROM private\\.platform_admins/g) || []).length, 2,
  "both private helper signatures must consult the canonical platform-admin registry");
assert.doesNotMatch(migration, /FROM public\\.user_memberships/i,
  "global legal authorization must not rely on tenant membership role labels");
assert.match(migration, /CREATE OR REPLACE FUNCTION public\\.legal_assert_admin_backend\\(p_actor_user_id uuid\\)[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path TO ''/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\\.legal_assert_admin_backend\\(uuid\\) FROM PUBLIC/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\\.legal_assert_admin_backend\\(uuid\\) FROM anon/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\\.legal_assert_admin_backend\\(uuid\\) FROM authenticated/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\\.legal_assert_admin_backend\\(uuid\\) TO service_role/);
assert.doesNotMatch(migration, /GRANT\\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\\s+ON\\s+TABLE/i);

assert.ok(cms.includes('db.rpc("legal_assert_admin_backend",{p_actor_user_id:user.id})'),
  "Legal CMS must validate the authenticated actor through the service-only backend assertion");
assert.doesNotMatch(cms, /from\\(["']user_memberships["']\\)/,
  "Legal CMS must not grant global legal authority from an arbitrary membership role");

for (const marker of [
  "'ADMIN'",
  "'LEGAL_ADMIN'",
  "'SUPER_ADMIN'",
  "RC482_BUSINESS_ADMIN_ESCALATED_TO_GLOBAL_LEGAL_ADMIN",
  "RC482_LEGAL_ADMIN_LABEL_ESCALATED_WITHOUT_ROOT_REGISTRY",
  "RC482_TENANT_SUPER_ADMIN_ESCALATED_TO_GLOBAL_LEGAL_ADMIN",
  "RC482_PLATFORM_ADMIN_REGISTRY_ACTOR_REJECTED",
  "RC482_AUTHENTICATED_ACTOR_IMPERSONATED_PLATFORM_ADMIN",
  "RC482_BUSINESS_ADMIN_EDGE_ASSERTION_SUCCEEDED",
  "RC482_LEGAL_ADMIN_LABEL_EDGE_ASSERTION_SUCCEEDED",
  "RC482_BACKEND_ASSERTION_RPC_ACL_INVALID",
]) {
  assert.ok(fixture.includes(marker) || integration.includes(marker),
    "missing RC482 adversarial fixture/assertion: " + marker);
}
assert.match(fixture, /REVOKE ALL ON FUNCTION private\\.legal_is_admin\\(\\) FROM PUBLIC/);
assert.match(fixture, /REVOKE ALL ON FUNCTION private\\.legal_is_admin\\(uuid\\) FROM PUBLIC/);
console.log("RC482 legal platform-admin registry authorization contract: PASS");
