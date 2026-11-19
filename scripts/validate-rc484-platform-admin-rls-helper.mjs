import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20261119040000_rc484_registry_backed_is_platform_admin.sql","utf8");
const fixture=readFileSync("supabase/tests/rc484_platform_admin_fixture.sql","utf8");
const integration=readFileSync("supabase/tests/rc484_platform_admin_integration.sql","utf8");
const workflow=readFileSync(".github/workflows/platform-admin-rls-helper.yml","utf8");
const gate=readFileSync("scripts/production/live-reconciliation-contract.mjs","utf8");
const chain=readFileSync("scripts/validate-production-migration-chain-gate.mjs","utf8");

const checks=[
  ["RC484 is forward-only and transactional",/BEGIN;[\s\S]*COMMIT;\s*$/.test(migration)],
  ["preflight requires the protected FORCE-RLS registry",/relforcerowsecurity/.test(migration)&&/RC484_PLATFORM_ADMIN_REGISTRY_RLS_AND_FORCE_RLS_REQUIRED/.test(migration)],
  ["preflight binds helper owner to registry owner with BYPASSRLS",/v_helper_owner IS DISTINCT FROM v_registry_owner/.test(migration)&&/rolbypassrls/.test(migration)],
  ["preflight covers the audited 57 policies and 24 tables",/v_policy_count<57 OR v_policy_table_count<24/.test(migration)],
  ["helper uses only private registry and auth.uid",/FROM private\.platform_admins pa[\s\S]*?pa\.user_id=\(SELECT auth\.uid\(\)\)/.test(migration)&&!/FROM public\.user_memberships/.test(migration)],
  ["helper is SECURITY DEFINER with empty search_path",/SECURITY DEFINER[\s\S]*?SET search_path TO ''/.test(migration)],
  ["client registry access is revoked and authenticated helper execute retained",/REVOKE ALL ON FUNCTION public\.is_platform_admin\(\) FROM PUBLIC,anon,service_role/.test(migration)&&/GRANT EXECUTE ON FUNCTION public\.is_platform_admin\(\) TO authenticated/.test(migration)],
  ["fixture reproduces 57 policies over 24 tables",/1\.\.24/.test(fixture)&&/1\.\.33/.test(fixture)],
  ["integration denies tenant ADMIN and SUPER_ADMIN",/RC484_TENANT_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN/.test(integration)&&/RC484_TENANT_SUPER_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN/.test(integration)],
  ["integration preserves registered platform-root global access",/RC484_REGISTRY_ONLY_PLATFORM_ADMIN_MUST_PASS/.test(integration)&&/RC484_REGISTERED_PLATFORM_ADMIN_MUST_RETAIN_GLOBAL_POLICY_ACCESS/.test(integration)],
  ["workflow applies fixture, migration, then behavior test",workflow.indexOf("-f /tmp/fixture.sql")<workflow.indexOf("-f /tmp/rc484.sql")&&workflow.indexOf("-f /tmp/rc484.sql")<workflow.indexOf("-f /tmp/integration.sql")],
  ["production migration contract includes RC484",/20261119040000/.test(gate)&&/20261119040000_rc484_registry_backed_is_platform_admin\.sql/.test(chain)],
];
for(const [name,ok] of checks) console.log((ok?"PASS ":"FAIL ")+name);
assert.equal(checks.every(([,ok])=>ok),true,"RC484 registry-backed RLS helper source contract failed");
console.log("\n"+checks.length+"/"+checks.length+" RC484 source checks passed.");
