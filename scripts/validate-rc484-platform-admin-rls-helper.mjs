import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20261119040000_rc484_registry_backed_is_platform_admin.sql","utf8");
const fixture=readFileSync("supabase/tests/rc484_platform_admin_fixture.sql","utf8");
const integration=readFileSync("supabase/tests/rc484_platform_admin_integration.sql","utf8");
const workflow=readFileSync(".github/workflows/platform-admin-rls-helper.yml","utf8");
const replayWorkflow=readFileSync(".github/workflows/forward-migration-chain-replay.yml","utf8");
const replayOverlay=readFileSync("supabase/tests/baselines/rc484_live_storage_policy_overlay_fixture.sql","utf8");
const gate=readFileSync("scripts/production/live-reconciliation-contract.mjs","utf8");
const chain=readFileSync("scripts/validate-production-migration-chain-gate.mjs","utf8");

const checks=[
  ["RC484 is forward-only and transactional",/BEGIN;[\s\S]*COMMIT;\s*$/.test(migration)],
  ["preflight requires an RLS-protected registry and migration enforces FORCE RLS",/relrowsecurity/.test(migration)&&/RC484_PLATFORM_ADMIN_REGISTRY_RLS_REQUIRED/.test(migration)&&migration.includes("ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY")],
  ["preflight binds helper owner to registry owner with BYPASSRLS",/v_helper_owner IS DISTINCT FROM v_registry_owner/.test(migration)&&/rolbypassrls/.test(migration)],
  ["preflight covers the audited 57 policies and 24 tables",/v_policy_count<57 OR v_policy_table_count<24/.test(migration)],
  ["helper uses only private registry and auth.uid",/FROM private\.platform_admins pa[\s\S]*?pa\.user_id=\(SELECT auth\.uid\(\)\)/.test(migration)&&!/FROM public\.user_memberships/.test(migration)],
  ["helper is SECURITY DEFINER with empty search_path",/SECURITY DEFINER[\s\S]*?SET search_path TO ''/.test(migration)],
  ["migration does not revoke trusted service-role registry operations",!migration.includes("REVOKE ALL ON TABLE private.platform_admins")],
  ["authenticated helper execute is retained",migration.includes("GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated")],
  ["fixture reproduces existing direct service-role registry grant",fixture.includes("GRANT ALL ON TABLE private.platform_admins TO service_role")],
  ["fixture reproduces live 57-policy command mix over 24 tables",fixture.includes("FOR i IN 1..24 LOOP")&&fixture.includes("FOR j IN 1..57 LOOP")&&fixture.includes("WHEN j<=18 THEN 'SELECT'")&&fixture.includes("WHEN j<=35 THEN 'UPDATE'")&&fixture.includes("WHEN j<=50 THEN 'DELETE'")&&fixture.includes("ELSE 'ALL'")],
  ["integration denies tenant ADMIN and SUPER_ADMIN across SELECT/INSERT/UPDATE/DELETE",["SELECT","INSERT","UPDATE","DELETE"].every(op=>integration.includes("CROSSTENANT_"+op+"_BYPASS"))&&integration.includes("RC484_TENANT_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN")&&integration.includes("RC484_TENANT_SUPER_ADMIN_MUST_NOT_BE_PLATFORM_ADMIN")],
  ["integration preserves registered platform-root global access across SELECT/INSERT/UPDATE/DELETE",["GLOBAL_SELECT_FAILED","GLOBAL_UPDATE_FAILED","GLOBAL_DELETE_FAILED"].every(x=>integration.includes(x))&&integration.includes("INSERT INTO public.scope_probe_03")&&integration.includes("RC484_REGISTRY_ONLY_PLATFORM_ADMIN_MUST_PASS")],
  ["tenant-local ADMIN/SUPER_ADMIN membership scope and platform-root-only feature flag writes remain intact",fixture.includes("m.tenant_id=%I.tenant_id")&&fixture.includes("m.business_id=%I.business_id")&&fixture.includes("m.branch_id=%I.branch_id")&&["TENANT_ADMIN_LOCAL_MEMBERSHIP_SELECT_LOST","TENANT_ADMIN_LOCAL_MEMBERSHIP_UPDATE_LOST","TENANT_ADMIN_LOCAL_MEMBERSHIP_DELETE_LOST","TENANT_SUPER_ADMIN_LOCAL_MEMBERSHIP_SELECT_LOST","TENANT_SUPER_ADMIN_LOCAL_MEMBERSHIP_UPDATE_LOST","TENANT_SUPER_ADMIN_LOCAL_MEMBERSHIP_DELETE_LOST"].every(x=>integration.includes(x))&&integration.includes("CROSS_TENANT_ALL_POLICY_BYPASS")&&integration.includes("RC484_TENANT_ADMIN_CROSS_BRANCH_SCOPE_BYPASS")&&integration.includes("RC484_TENANT_ADMIN_CROSS_BUSINESS_SCOPE_BYPASS")&&fixture.includes("j=10")&&fixture.includes("tenant_id IS NULL")&&fixture.includes("policy_command='ALL' AND j<57")&&fixture.includes("USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())")&&integration.includes("RC484_TENANT_ADMIN_FEATURE_FLAG_TENANT_READ_SCOPE_LOST")&&integration.includes("RC484_TENANT_SUPER_ADMIN_FEATURE_FLAG_TENANT_READ_SCOPE_LOST")&&integration.includes("RC484_TENANT_ADMIN_PLATFORM_FLAG_WRITE_BYPASS")&&integration.includes("RC484_TENANT_SUPER_ADMIN_PLATFORM_FLAG_WRITE_BYPASS")&&integration.includes("RC484_REGISTERED_PLATFORM_ADMIN_GLOBAL_FLAG_UPDATE_FAILED")],
  ["workflow applies fixture, migration, then behavior test",workflow.indexOf("-f /tmp/fixture.sql")<workflow.indexOf("-f /tmp/rc484.sql")&&workflow.indexOf("-f /tmp/rc484.sql")<workflow.indexOf("-f /tmp/integration.sql")],
  ["production migration contract includes RC484",/20261119040000/.test(gate)&&/20261119040000_rc484_registry_backed_is_platform_admin\.sql/.test(chain)],
];
for(const [name,ok] of checks) console.log((ok?"PASS ":"FAIL ")+name);
assert.equal(checks.every(([,ok])=>ok),true,"RC484 registry-backed RLS helper source contract failed");
console.log("\n"+checks.length+"/"+checks.length+" RC484 source checks passed.");
