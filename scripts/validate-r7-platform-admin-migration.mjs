import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261113020000_harden_mantigo_platform_financial_report.sql");
const callers = read("../supabase/tests/r7_platform_admin_helper_callers_fixture.sql");
const integration = read("../supabase/tests/r7_platform_admin_helper_callers_integration.sql");
const workflow = read("../.github/workflows/mantigo-platform-admin-scope.yml");

const checks = [
  ["migration uses canonical private platform registry", /FROM\s+private\.platform_admins\s+pa[\s\S]*?pa\.user_id\s*=\s*auth\.uid\(\)/i.test(migration)],
  ["migration does not fall back to membership roles or generic RBAC", !/FROM\s+public\.user_memberships/i.test(migration) && !/public\.mnty_can\s*\(/i.test(migration)],
  ["migration preflight checks exact argument types for all four helper callers", ["character varying, text, text, timestamp with time zone, timestamp with time zone","uuid, uuid, uuid","uuid, uuid, text, text, text, text, jsonb","uuid, numeric, text"].every((sig) => migration.includes(sig)) && migration.includes("pg_catalog.oidvectortypes(p.proargtypes)")],
  ["migration contains the five expected function replacements", ["get_mantigo_admin_dashboard_backend","get_mantigo_admin_financial_report_backend","mnty_can_platform_admin","expire_stale_mantigo_rides_backend","settle_mantigo_captain_backend"].every((name) => migration.includes("FUNCTION public."+name))],
  ["all five replaced definers pin an empty search path", (migration.match(/SECURITY DEFINER SET search_path TO ''/gi) || []).length === 5],
  ["the four fixture functions call the shared helper", ["admin_create_global_ad","fulfill_digital_page_publish","review_mantigo_captain_application","set_mantigo_financial_config_backend"].every((name) => callers.includes("FUNCTION public."+name)) && (callers.match(/public\.mnty_can_platform_admin\(\)/g) || []).length === 4],
  ["integration denies tenant OWNER and ADMIN on all four helper callers", integration.includes("assert_r7_helper_callers_denied(tenant_owner") && integration.includes("assert_r7_helper_callers_denied(tenant_admin") && integration.includes("PLATFORM_ADMIN_REQUIRED")],
  ["integration permits registered platform admin through all four helper callers", integration.includes("registered platform admin could not create test global ad") && integration.includes("registered platform admin could not pass digital publish guard") && integration.includes("registered platform admin could not pass captain review guard") && integration.includes("registered platform admin could not pass commission config guard")],
  ["integration verifies anonymous EXECUTE denial for the four helper callers", integration.includes("anon must not execute the four global helper callers")],
  ["migration pins all four helper-dependent SECURITY DEFINER callers to an empty search_path", [
    "ALTER FUNCTION public.admin_create_global_ad",
    "ALTER FUNCTION public.fulfill_digital_page_publish",
    "ALTER FUNCTION public.review_mantigo_captain_application",
    "ALTER FUNCTION public.set_mantigo_financial_config_backend"
  ].every((marker) => migration.includes(marker))],
  ["PostgreSQL integration verifies all four helper callers have empty search_path", integration.includes("R7_HELPER_CALLER_SEARCH_PATH_NOT_HARDENED") && integration.includes("p.proconfig @> ARRAY['search_path=\"\"']")],

  ["workflow applies RC449 then RC462 then caller fixture then R7 migration and both integration suites", workflow.indexOf("/tmp/rc449.sql") < workflow.indexOf("/tmp/rc462.sql") && workflow.indexOf("/tmp/r7-callers.sql") < workflow.indexOf("/tmp/r7-platform-admin.sql") && workflow.indexOf("/tmp/r7-platform-admin.sql") < workflow.indexOf("/tmp/rc449-test.sql") && workflow.indexOf("/tmp/rc449-test.sql") < workflow.indexOf("/tmp/r7-helper-callers-test.sql")],
];

for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
assert.equal(checks.every(([, ok]) => ok), true, "R7 platform-admin migration CI contract failed");
console.log("\n" + checks.length + "/" + checks.length + " R7 platform-admin migration CI source checks passed.");
