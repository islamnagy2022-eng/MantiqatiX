import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261114020000_rc466_business_branch_read_scope_hardening.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc466_business_branch_scope_fixture.sql", "utf8");
const baseline = fs.readFileSync("supabase/tests/rc466_business_branch_scope_baseline.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc466_business_branch_scope_integration.sql", "utf8");
const aclOverlay = fs.readFileSync("supabase/tests/baselines/production_live_business_branch_anon_acl_overlay_fixture.sql", "utf8");
const replayWorkflow = fs.readFileSync(".github/workflows/forward-migration-chain-replay.yml", "utf8");

assert.match(migration, /^BEGIN;/m, "migration must be transactional");
assert.match(migration, /^COMMIT;/m, "migration must commit");
assert.match(migration, /relrowsecurity/, "migration must fail closed when RLS is disabled");
assert.match(migration, /has_table_privilege\('authenticated', 'public\.businesses', 'SELECT'\)/, "business read grant must be verified");
assert.match(migration, /has_table_privilege\('authenticated', 'public\.branches', 'SELECT'\)/, "branch read grant must be verified");
assert.match(migration, /has_table_privilege\('anon', 'public\.branches', 'SELECT'\)/, "anonymous branch grant must be checked");
assert.match(migration, /um\.business_id = businesses\.id/, "business-scoped members must match their business");
assert.match(migration, /upper\(um\.role\) = ANY \(ARRAY\['OWNER','ADMIN','MANAGER'\]\)/, "tenant-wide access must be restricted to tenant managers");
assert.match(migration, /RC466_CANONICAL_PLATFORM_ADMIN_GUARD_MISSING/, "migration must preflight the canonical platform-root helper");
for (const policy of ["businesses_member_select", "branches_member_read", "branches_super_admin_write", "departments_member_read", "warehouses_member_read", "inventory_transactions_member_read"]) {
  const start = migration.indexOf("CREATE POLICY " + policy + "\n");
  assert.notEqual(start, -1, "missing platform/scoped policy " + policy);
  const end = migration.indexOf(";", start);
  const block = migration.slice(start, end + 1);
  assert.match(block, /public\.mnty_can_platform_admin\(\)/, "platform access must use the canonical registry guard in " + policy);
}
assert.doesNotMatch(migration, /upper\(um\.role\)\s*=\s*'SUPER_ADMIN'/, "legacy membership role/permission flags must not bypass the canonical registry");
assert.match(migration, /um\.business_id = branches\.business_id/, "branch reads must match business scope");
assert.match(migration, /um\.branch_id IS NULL OR um\.branch_id = branches\.id/, "branch-scoped reads must match exact branch");
for (const name of ["authenticated_sessions_only","deny_anonymous_users","mnt_non_anonymous_boundary","non_anonymous_authenticated_guard"]) {
  assert.doesNotMatch(migration, new RegExp("DROP POLICY IF EXISTS " + name + " ON public\\.branches"), "restrictive anonymous guard must be preserved: " + name);
  assert.match(fixture, new RegExp("CREATE POLICY " + name + "[\\s\\S]*?AS RESTRICTIVE FOR ALL TO authenticated"), "fixture must model the live restrictive guard: " + name);
}
assert.match(migration, /RC466_RESTRICTIVE_ANONYMOUS_GUARDS_MUST_BE_PRESERVED/, "preflight must fail if restrictive guards are missing");
assert.match(migration, /DROP POLICY branches_manager_write[\s\S]*?CREATE POLICY branches_manager_write[\s\S]*?um\.business_id = branches\.business_id[\s\S]*?um\.branch_id IS NULL OR um\.branch_id = branches\.id/,
  "legacy ALL manager policy must not bypass branch scope");
assert.match(migration, /businesses_manager_insert[\s\S]*?um\.business_id IS NULL[\s\S]*?um\.branch_id IS NULL/,
  "business creation must remain tenant-level only");
assert.match(migration, /businesses_manager_update[\s\S]*?um\.business_id = businesses\.id/,
  "business updates must remain scoped to the owned business");
assert.match(migration, /businesses_manager_delete[\s\S]*?um\.business_id = businesses\.id/,
  "business deletion must remain scoped to the owned business");
assert.match(migration, /CREATE POLICY businesses_manager_update[\s\S]*?um\.business_id = businesses\.id AND um\.branch_id IS NULL/, "branch-scoped managers must not update business-wide profile rows");
assert.match(migration, /CREATE POLICY businesses_manager_delete[\s\S]*?um\.business_id = businesses\.id AND um\.branch_id IS NULL/, "branch-scoped managers must not delete business-wide profile rows");
assert.match(migration, /DROP POLICY branches_super_admin_write[\s\S]*?CREATE POLICY branches_super_admin_write[\s\S]*?public\.mnty_can_platform_admin\(\)/, "legacy branch admin policy must use the canonical registry guard");
assert.match(fixture, /CREATE TABLE IF NOT EXISTS private\.platform_admins[\s\S]*?FORCE ROW LEVEL SECURITY/, "fixture must model the canonical platform admin registry");
assert.match(fixture, /CREATE OR REPLACE FUNCTION public\.mnty_can_platform_admin[\s\S]*?FROM private\.platform_admins/, "fixture helper must read the private registry");
assert.match(integration, /noncanonical SUPER_ADMIN role bypassed the platform registry/, "integration must reject role-only platform access");
assert.match(migration, /Public can view official showcase businesses|businesses_member_select/, "business public showcase and member policies must remain distinct");

for (const table of ["departments","warehouses","stock_balances","inventory_transactions"]) {
  assert.ok(migration.includes("to_regclass('public." + table + "')"), "preflight must require " + table);
  assert.ok(migration.includes("v_" + table + "_rls"), "preflight must verify RLS on " + table);
  assert.ok(migration.includes("has_table_privilege('authenticated', 'public." + table + "', 'SELECT')"), "preflight must preserve authenticated SELECT on " + table);
  assert.ok(fixture.includes("CREATE TABLE public." + table), "fixture must include " + table);
}
assert.ok(migration.includes("CREATE POLICY departments_member_read") && migration.includes("um.business_id = departments.business_id"), "department reads must be business-scoped");
assert.ok(migration.includes("CREATE POLICY departments_manager_write") && migration.includes("um.branch_id = departments.branch_id"), "department writes must be branch-scoped");
assert.ok(migration.includes("CREATE POLICY warehouses_member_read") && migration.includes("um.business_id = warehouses.business_id"), "warehouse reads must be business-scoped");
assert.ok(migration.includes("CREATE POLICY warehouses_manager_insert") && migration.includes("um.branch_id = warehouses.branch_id"), "warehouse inserts must be branch-scoped");
assert.ok(migration.includes("CREATE POLICY warehouses_manager_update") && migration.includes("CREATE POLICY warehouses_manager_delete"), "warehouse updates/deletes must be scoped");
assert.ok(migration.includes("CREATE POLICY stock_balances_member_read") && migration.includes("FROM public.warehouses w"), "stock balances must inherit parent warehouse visibility");
assert.ok(migration.includes("CREATE POLICY inventory_transactions_member_read") && migration.includes("CREATE POLICY inventory_transactions_manager_insert"), "inventory transactions must have scoped read/write policies");
assert.ok(migration.includes("RC466_RESTRICTIVE_ANONYMOUS_GUARDS_MUST_BE_PRESERVED"), "preflight must preserve restrictive session guards");

assert.doesNotMatch(migration, /^\s*(?:GRANT|REVOKE|ALTER TABLE|INSERT INTO|UPDATE\s+public\.|DELETE FROM)\b/im,
  "migration must not change grants, table structure, or business data");

assert.match(fixture, /CREATE POLICY authenticated_sessions_only[\s\S]*?FOR ALL/, "fixture must reproduce broad permissive branch policy");
assert.match(fixture, /CREATE POLICY branches_member_read[\s\S]*?tenant_id/, "fixture must reproduce original tenant-only branch policy");
assert.match(baseline, /v_branch_count <> 4/, "baseline must reproduce tenant-wide branch enumeration without inventing cross-tenant access");
assert.ok(baseline.includes("v_department_count <> 4"), "baseline must reproduce tenant-wide department visibility");
assert.ok(baseline.includes("v_warehouse_count <> 4"), "baseline must reproduce tenant-wide warehouse visibility");
assert.ok(baseline.includes("v_stock_count <> 4"), "baseline must reproduce tenant-wide stock visibility");
assert.ok(baseline.includes("v_inventory_count <> 4"), "baseline must reproduce tenant-wide inventory transaction visibility");
assert.match(aclOverlay, /REVOKE SELECT[\s\S]*?FROM anon/, "test overlay must align checkpoint anon grants to live ACL");
assert.match(aclOverlay, /LIVE_ACL_OVERLAY_FAILED/, "test overlay must fail closed if anon SELECT remains");
for (const table of ["branches","departments","warehouses","stock_balances","inventory_transactions"]) {
  assert.ok(aclOverlay.includes("public." + table), "test-only live ACL overlay must cover " + table);
}
assert.match(replayWorkflow, /RESTORE_TEST_ONLY_KNOWN_LIVE_BUSINESS_BRANCH_ANON_ACL_OVERLAY[\s\S]*?REPLAY_MIGRATION=\$filename/, "forward replay must apply ACL overlay before RC466");
assert.match(integration, /has_table_privilege\(current_user, 'public\.branches', 'SELECT'\)/, "integration test must assert anon grants");
assert.match(integration, /Public can view official showcase businesses/, "integration test must preserve public showcase policy");
assert.ok(integration.includes("DO $inventory_test$"), "integration tests must exercise inventory scope");
for (const scenario of [
  "branch OWNER department scope incorrect",
  "branch OWNER warehouse scope incorrect",
  "branch OWNER stock scope incorrect",
  "branch OWNER inventory transaction scope incorrect",
  "business manager department scope incorrect",
  "business manager warehouse scope incorrect",
  "branch manager updated sibling department",
  "branch manager inserted sibling department",
  "unscoped CUSTOMER received private inventory visibility",
  "platform admin department scope incorrect",
  "BUSINESS_OWNER stock scope incorrect",
  "BUSINESS_OWNER inventory transaction scope incorrect",
  "tenant-B stock scope incorrect",
  "tenant-B inventory transaction scope incorrect",
  "platform admin stock scope incorrect",
  "platform admin inventory transaction scope incorrect"
]) assert.ok(integration.includes(scenario), "integration test must cover " + scenario);
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

console.log("RC466_BUSINESS_BRANCH_SCOPE_STATIC=PASS (migration, live ACL overlay, and anonymous boundary)");
