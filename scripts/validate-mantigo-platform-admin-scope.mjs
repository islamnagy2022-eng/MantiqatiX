import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc449_mantigo_platform_admin_integration.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc449_mantigo_platform_admin_fixture.sql", "utf8");
const checks = [];
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
  if (!ok) console.error("FAIL " + name);
}
check("platform-admin guard requires active SUPER_ADMIN membership", migration.includes("upper(m.role) = 'SUPER_ADMIN'") && migration.includes("m.status = 'ACTIVE'") && migration.includes("m.tenant_id = 'MNTY-PLATFORM'"));
check("platform-admin guard requires explicit PLATFORM scope and full control", migration.includes("m.permissions ->> 'scope' = 'PLATFORM'") && migration.includes("(m.permissions ->> 'full_control')::boolean"));
check("guard uses empty search_path and is not public/anon executable", migration.includes("set search_path = ''") && migration.includes("revoke all on function public.mnty_can_platform_admin() from public, anon"));
check("global dashboard checks the platform-admin guard", migration.includes("get_mantigo_admin_dashboard_backend") && migration.includes("if not public.mnty_can_platform_admin()"));
check("global financial report checks the platform-admin guard", migration.includes("get_mantigo_admin_financial_report_backend") && migration.includes("PLATFORM_ADMIN_REQUIRED"));
check("global settlement checks the platform-admin guard", migration.includes("settle_mantigo_captain_backend") && migration.includes("PLATFORM_ADMIN_REQUIRED"));
check("global stale-ride expiration checks the platform-admin guard", migration.includes("expire_stale_mantigo_rides_backend") && migration.includes("PLATFORM_ADMIN_REQUIRED"));
const privilegedRpcGrants = [
  ["get_mantigo_admin_dashboard_backend(uuid)", "get_mantigo_admin_dashboard_backend(uuid)"],
  ["get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)", "get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)"],
  ["settle_mantigo_captain_backend(uuid,text,text)", "settle_mantigo_captain_backend(uuid,text,text)"],
  ["expire_stale_mantigo_rides_backend(uuid,integer)", "expire_stale_mantigo_rides_backend(uuid,integer)"]
];
check("guard and all four privileged RPCs pin search_path to empty",
  (migration.match(/set search_path = ''/g) || []).length >= 5);
check("all four privileged RPCs revoke PUBLIC/anon and retain only the intended authenticated entrypoint",
  privilegedRpcGrants.every(([signature]) =>
    migration.includes("revoke all on function public." + signature + " from public, anon;") &&
    migration.includes("grant execute on function public." + signature + " to authenticated;")));
check("each privileged RPC binds the supplied admin ID to auth.uid before privileged work",
  migration.includes("v_user <> p_admin_user_id") &&
  migration.includes("v_auth <> p_admin_user_id") &&
  (migration.match(/p_admin_user_id <> auth\.uid\(\)/g) || []).length >= 2);

check("settlement and expiration explicitly reject a missing auth.uid instead of relying on NULL comparison",
  (migration.match(/p_admin_user_id is null or auth\.uid\(\) is null or p_admin_user_id <> auth\.uid\(\)/g) || []).length >= 2);

check("integration rejects tenant OWNER, ADMIN, and OPERATIONS_MANAGER", integration.includes("tenant OWNER must not be treated") && integration.includes("tenant ADMIN with admin permission") && integration.includes("tenant OPERATIONS_MANAGER"));
check("integration exercises global dashboard, report, settlement, and expiration", integration.includes("tenant OWNER read platform-wide dashboard") && integration.includes("tenant OWNER read platform-wide financial report") && integration.includes("global settlement mutation") && integration.includes("global ride expiration mutation"));
check("integration allows explicit platform SUPER_ADMIN and checks grants", integration.includes("explicit platform SUPER_ADMIN") && integration.includes("has_function_privilege('anon'"));
check("integration rejects unauthenticated callers on all four privileged RPCs",
  integration.includes("unauthenticated caller read platform dashboard") &&
  integration.includes("unauthenticated caller read platform financial report") &&
  integration.includes("unauthenticated caller reached settlement") &&
  integration.includes("unauthenticated caller reached ride expiration"));
check("integration rejects forged p_admin_user_id on all four privileged RPCs",
  integration.includes("forged admin UUID read platform dashboard") &&
  integration.includes("forged admin UUID read platform financial report") &&
  integration.includes("forged admin UUID reached settlement") &&
  integration.includes("forged admin UUID reached ride expiration"));
check("unauthenticated and forged-identity attempts assert no settlement/expiration side effects",
  integration.includes("unauthenticated calls caused settlement/expiration side effects") &&
  integration.includes("forged admin UUID calls caused settlement/expiration side effects"));
check("auth regressions assert expected rejection identifiers rather than accepting arbitrary errors",
  integration.includes("sqlerrm in ('USER_CONTEXT_MISMATCH','AUTH_REQUIRED')") &&
  integration.includes("sqlerrm='USER_CONTEXT_MISMATCH'"));
check("multi-identity test session forces fresh plans and restores planner setting",
  integration.includes("SET plan_cache_mode = force_custom_plan;") &&
  integration.includes("RESET plan_cache_mode;"));
check("disposable auth.uid fixture reads the current simulated JWT subject on every invocation without changing production auth",
  fixture.includes("disposable fixture only") &&
  /create or replace function auth\.uid\(\)[\s\S]*?language plpgsql\s+volatile/i.test(fixture) &&
  fixture.includes("execute 'select nullif(current_setting") &&
  fixture.includes("Each invocation must read the current request GUC"));




check("integration denies anon on ride expiration and preserves authenticated entrypoint grants",
  integration.includes("anon must not execute platform ride expiration") &&
  integration.includes("authenticated role must retain intended RPC entrypoint grants") &&
  integration.includes("has_function_privilege('authenticated','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE')"));
check("integration verifies authorized settlement persistence and replay safety", integration.includes("authorized platform admin settlement failed") && integration.includes("settlement replay did not return idempotent success") && integration.includes("settlement replay duplicated audit or notification"));
const rc523 = fs.readFileSync("supabase/migrations/20261013200000_rc523_mantigo_financial_report_canonical_columns.sql", "utf8");
check("RC523 canonical financial report reads JWT identity at execution time and rejects NULL actor IDs",
  rc523.includes("v_auth := auth.uid();") &&
  !rc523.includes("v_auth uuid := auth.uid();") &&
  rc523.includes("if v_auth is null or p_admin_user_id is null or v_auth <> p_admin_user_id then"));

const rc462 = fs.readFileSync("supabase/migrations/20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql", "utf8");
const rc462Test = fs.readFileSync("supabase/tests/rc462_mantigo_platform_admin_malformed_permissions.sql", "utf8");
const adminWorkflow = fs.readFileSync(".github/workflows/mantigo-platform-admin-scope.yml", "utf8");
check("RC462 platform-admin guard re-evaluates request-scoped identity on every call",
  rc462.includes("create or replace function public.mnty_can_platform_admin()") && rc462.includes("language plpgsql\nvolatile\nsecurity definer") && rc462.includes("return exists ("));
check("RC462 malformed JSON guard must use JSON containment rather than unsafe text-to-boolean casts",
  rc462.includes("m.permissions @> '{\"scope\":\"PLATFORM\",\"full_control\":true}'::jsonb") &&
  !rc462.includes("(m.permissions ->> 'full_control')::boolean"));
check("RC462 regression covers malformed string, false, and valid true permissions",
  rc462Test.includes('"full_control":"not-a-boolean"') &&
  rc462Test.includes('"full_control":false') &&
  rc462Test.includes('"full_control":true') &&
  rc462Test.includes("without raising for malformed full_control"));
check("RC462 malformed-permission regression is selected by the platform-admin workflow and run after its migration",
  adminWorkflow.includes("supabase/migrations/20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql") &&
  adminWorkflow.includes("supabase/tests/rc462_mantigo_platform_admin_malformed_permissions.sql") &&
  adminWorkflow.includes('docker cp supabase/tests/rc462_mantigo_platform_admin_malformed_permissions.sql "$pg_container:/tmp/rc462-test.sql"') &&
  adminWorkflow.indexOf("-f /tmp/rc462.sql") < adminWorkflow.indexOf("-f /tmp/rc462-test.sql") &&
  adminWorkflow.indexOf("-f /tmp/rc462-test.sql") < adminWorkflow.indexOf("-f /tmp/rc523.sql"));

const failed = checks.filter(x => !x.ok);
if (failed.length) process.exit(1);
console.log("MantiGO platform-admin scope contract PASS: " + checks.length + "/" + checks.length + " checks.");
