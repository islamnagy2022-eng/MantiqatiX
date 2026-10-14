import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql", "utf8");
const guardFix = fs.readFileSync("supabase/migrations/20261012040000_rc462_mantigo_platform_admin_guard_malformed_permissions.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc449_mantigo_platform_admin_integration.sql", "utf8");
const malformedPermissionsTest = fs.readFileSync("supabase/tests/rc462_mantigo_platform_admin_malformed_permissions.sql", "utf8");
const liveContract = fs.readFileSync("scripts/verify-mantigo-high-risk-definers.sql", "utf8");
const checks = [];
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
  if (!ok) console.error("FAIL " + name);
}
check("platform-admin guard requires active SUPER_ADMIN membership", migration.includes("upper(m.role) = 'SUPER_ADMIN'") && migration.includes("m.status = 'ACTIVE'") && migration.includes("m.tenant_id = 'MNTY-PLATFORM'"));
check("historical RC449 permission predicate remains identified for forward-only correction", migration.includes("m.permissions ->> 'scope' = 'PLATFORM'") && migration.includes("(m.permissions ->> 'full_control')::boolean"));
check("RC462 uses exact JSON Boolean containment for platform scope and full control", guardFix.includes("m.permissions @> '{\"scope\":\"PLATFORM\",\"full_control\":true}'::jsonb"));
check("RC462 does not cast JSON text into a Boolean", !guardFix.includes("->> 'full_control'") && !guardFix.includes("->> 'scope'"));
check("RC462 guard uses empty search_path and is not public/anon executable", guardFix.includes("set search_path = ''") && guardFix.includes("revoke all on function public.mnty_can_platform_admin() from public, anon"));
check("global dashboard checks the platform-admin guard", migration.includes("get_mantigo_admin_dashboard_backend") && migration.includes("if not public.mnty_can_platform_admin()"));
check("global financial report checks the platform-admin guard", migration.includes("get_mantigo_admin_financial_report_backend") && migration.includes("PLATFORM_ADMIN_REQUIRED"));
check("global settlement checks the platform-admin guard", migration.includes("settle_mantigo_captain_backend") && migration.includes("PLATFORM_ADMIN_REQUIRED"));
check("global stale-ride expiration checks the platform-admin guard", migration.includes("expire_stale_mantigo_rides_backend") && migration.includes("PLATFORM_ADMIN_REQUIRED"));
check("integration rejects tenant OWNER, ADMIN, and OPERATIONS_MANAGER", integration.includes("tenant OWNER must not be treated") && integration.includes("tenant ADMIN with admin permission") && integration.includes("tenant OPERATIONS_MANAGER"));
check("integration exercises global dashboard, report, settlement, and expiration", integration.includes("tenant OWNER read platform-wide dashboard") && integration.includes("tenant OWNER read platform-wide financial report") && integration.includes("global settlement mutation") && integration.includes("global ride expiration mutation"));
check("integration allows explicit platform SUPER_ADMIN and checks grants", integration.includes("explicit platform SUPER_ADMIN") && integration.includes("has_function_privilege('anon'"));
check("integration denies anon on ride expiration and preserves authenticated entrypoint grants",
  integration.includes("anon must not execute platform ride expiration") &&
  integration.includes("authenticated role must retain intended RPC entrypoint grants") &&
  integration.includes("has_function_privilege('authenticated','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE')"));
check("integration verifies authorized settlement persistence and replay safety", integration.includes("authorized platform admin settlement failed") && integration.includes("settlement replay did not return idempotent success") && integration.includes("settlement replay duplicated audit or notification"));
check("RC462 regression rejects malformed, Boolean-false, and string-true permissions", malformedPermissionsTest.includes("malformed string full_control") && malformedPermissionsTest.includes("boolean false full_control") && malformedPermissionsTest.includes("JSON string true must not grant platform access"));
check("RC462 regression checks actual financial report and settlement RPCs fail closed", malformedPermissionsTest.includes("JSON string true reached platform-wide financial report") && malformedPermissionsTest.includes("JSON string true reached platform-wide settlement RPC"));
check("RC462 regression preserves explicit JSON Boolean true", malformedPermissionsTest.includes('"full_control":true') && malformedPermissionsTest.includes("valid explicit platform permission must continue to allow access"));
check("read-only live contract normalizes RPC signatures without argument names",
  liveContract.includes("oidvectortypes(p.proargtypes)") &&
  liveContract.includes("replace(pg_catalog.oidvectortypes(p.proargtypes), ', ', ',')"));
check("read-only live contract only permits reviewed empty search_path on RC449 functions",
  liveContract.includes("allow_empty_search_path") &&
  liveContract.includes("e.allow_empty_search_path and x in ('search_path=\"\\"','search_path=')"));
const failed = checks.filter(x => !x.ok);
if (failed.length) process.exit(1);
console.log("MantiGO platform-admin scope contract PASS: " + checks.length + "/" + checks.length + " checks.");
