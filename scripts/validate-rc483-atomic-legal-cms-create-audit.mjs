import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261119030000_rc483_atomic_legal_cms_create_audit.sql", "utf8");
const cms = fs.readFileSync("supabase/functions/legal-cms/index.ts", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc483_atomic_legal_cms_create_audit_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc483_atomic_legal_cms_create_audit_integration.sql", "utf8");

for (const fn of [
  "legal_create_document_backend",
  "legal_create_draft_version_backend",
]) {
  const start = migration.indexOf("CREATE FUNCTION public." + fn);
  assert.ok(start >= 0, "missing atomic Legal CMS RPC " + fn);
  const end = migration.indexOf("$function$;", start);
  assert.ok(end > start, "unterminated function " + fn);
  const body = migration.slice(start, end);
  assert.match(body, /SECURITY DEFINER[\s\S]*?SET search_path TO ''/);
  assert.match(body, /public\.legal_assert_admin_backend\(p_actor_user_id\)/);
  assert.match(body, /INSERT INTO public\.consent_audit_log/);
}
assert.match(migration, /REVOKE INSERT \([\s\S]*?\) ON TABLE public\.legal_documents FROM service_role/);
assert.match(migration, /REVOKE INSERT \([\s\S]*?\) ON TABLE public\.legal_document_versions FROM service_role/);
assert.match(migration, /REVOKE INSERT \([\s\S]*?\) ON TABLE public\.consent_audit_log FROM service_role/);

assert.ok(cms.includes('db.rpc("legal_create_document_backend"'));
assert.ok(cms.includes('db.rpc("legal_create_draft_version_backend"'));
assert.doesNotMatch(cms, /from\(["']legal_documents["']\)\.insert/);
assert.doesNotMatch(cms, /from\(["']legal_document_versions["']\)\.insert/);
assert.doesNotMatch(cms, /from\(["']consent_audit_log["']\)\.insert/);
assert.doesNotMatch(cms, /const audit\s*=/);

for (const marker of [
  "RC483_DIRECT_SERVICE_ROLE_INSERT_PRIVILEGE_REMAINS",
  "RC483_ATOMIC_RPC_EXECUTE_ACL_INVALID",
  "RC483_UNAUDITED_DOCUMENT_PERSISTED",
  "RC483_UNAUDITED_VERSION_PERSISTED",
  "RC483_SERVER_CONTENT_HASH_MISMATCH",
  "RC483_TENANT_ACTOR_WAS_ACCEPTED",
  "RC483_DUPLICATE_VERSION_WAS_ACCEPTED",
  "RC483_DUPLICATE_VERSION_PERSISTED",
  "RC483_DOCUMENT_AUDIENCE_NORMALIZATION_MISMATCH",
]) {
  assert.ok(integration.includes(marker), "missing RC483 regression: " + marker);
}
assert.ok(fixture.includes("CREATE EXTENSION pgcrypto WITH SCHEMA extensions"));
assert.ok(fixture.includes("private.platform_admins"));
console.log("RC483 atomic Legal CMS create/audit source contract: PASS");
