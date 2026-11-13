import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261114020000_rc466_business_branch_read_scope_hardening.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc466_business_branch_scope_fixture.sql", "utf8");
const baseline = fs.readFileSync("supabase/tests/rc466_business_branch_scope_baseline.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc466_business_branch_scope_integration.sql", "utf8");

assert.match(migration, /^BEGIN;/m, "migration must be transactional");
assert.match(migration, /^COMMIT;/m, "migration must commit");
assert.match(migration, /relrowsecurity/, "migration must fail closed when RLS is disabled");
assert.match(migration, /has_table_privilege\('authenticated', 'public\.businesses', 'SELECT'\)/, "business read grant must be verified");
assert.match(migration, /has_table_privilege\('authenticated', 'public\.branches', 'SELECT'\)/, "branch read grant must be verified");
assert.match(migration, /has_table_privilege\('anon', 'public\.branches', 'SELECT'\)/, "anonymous branch grant must be checked");
assert.match(migration, /um\.business_id = businesses\.id/, "business-scoped members must match their business");
assert.match(migration, /upper\(um\.role\) = ANY \(ARRAY\['OWNER','ADMIN','MANAGER'\]\)/, "tenant-wide access must be restricted to tenant managers");
assert.match(migration, /upper\(um\.role\) = 'SUPER_ADMIN'[\s\S]*?scope'[\s\S]*?PLATFORM[\s\S]*?full_control/, "platform-wide access must require strict SUPER_ADMIN scope");
assert.match(migration, /um\.business_id = branches\.business_id/, "branch reads must match business scope");
assert.match(migration, /um\.branch_id IS NULL OR um\.branch_id = branches\.id/, "branch-scoped reads must match exact branch");
for (const name of ["authenticated_sessions_only","deny_anonymous_users","mnt_non_anonymous_boundary","non_anonymous_authenticated_guard"]) {
  assert.match(migration, new RegExp("DROP POLICY IF EXISTS " + name + " ON public\\.branches"), "broad permissive branch policy must be removed: " + name);
}
assert.match(migration, /DROP POLICY branches_manager_write[\s\S]*?CREATE POLICY branches_manager_write[\s\S]*?um\.business_id = branches\.business_id[\s\S]*?um\.branch_id IS NULL OR um\.branch_id = branches\.id/,
  "legacy ALL manager policy must not bypass branch scope");
assert.match(migration, /businesses_manager_insert[\s\S]*?um\.business_id IS NULL[\s\S]*?um\.branch_id IS NULL/,
  "business creation must remain tenant-level only");
assert.match(migration, /businesses_manager_update[\s\S]*?um\.business_id = businesses\.id/,
  "business updates must remain scoped to the owned business");
assert.match(migration, /businesses_manager_delete[\s\S]*?um\.business_id = businesses\.id/,
  "business deletion must remain scoped to the owned business");
assert.match(migration, /branches_super_admin_write/, "strict platform super-admin branch policy must be preserved");
assert.match(migration, /Public can view official showcase businesses|businesses_member_select/, "business public showcase and member policies must remain distinct");
assert.doesNotMatch(migration, /^\s*(?:GRANT|REVOKE|ALTER TABLE|INSERT INTO|UPDATE\s+public\.|DELETE FROM)\b/im,
  "migration must not change grants, table structure, or business data");

assert.match(fixture, /CREATE POLICY authenticated_sessions_only[\s\S]*?FOR ALL/, "fixture must reproduce broad permissive branch policy");
assert.match(fixture, /CREATE POLICY branches_member_read[\s\S]*?tenant_id/, "fixture must reproduce original tenant-only branch policy");
assert.match(baseline, /v_branch_count <> 5/, "baseline must reproduce cross-tenant branch enumeration");
for (const scenario of [
  "unscoped OWNER",
  "Branch-scoped OWNER",
  "Business-level MANAGER",
  "Branch-scoped MANAGER",
  "BUSINESS_OWNER",
  "Inactive memberships",
  "unscoped CUSTOMER",
  "unscoped EMPLOYEE",
  "Tenant-B manager",
  "strict platform SUPER_ADMIN",
  "Anonymous sessions"
]) assert.ok(integration.toLowerCase().includes(scenario.toLowerCase()), "integration test must cover " + scenario);

console.log("RC466_BUSINESS_BRANCH_SCOPE_STATIC=PASS (27 assertions)");
