import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const migration = readFileSync("supabase/migrations/20261113214500_rc463_platform_admin_live_registry_hardening.sql", "utf8");
const baseline = readFileSync("supabase/tests/rc463_platform_admin_live_baseline.sql", "utf8");
const workflow = readFileSync(".github/workflows/rc463-platform-admin-live-hardening.yml", "utf8");
const fixture = readFileSync("supabase/tests/rc449_mantigo_platform_admin_fixture.sql", "utf8");
const integration = readFileSync("supabase/tests/rc449_mantigo_platform_admin_integration.sql", "utf8");
const sharedCallers = readFileSync("supabase/tests/rc463_platform_admin_shared_helper_callers.sql", "utf8");

const migrationLower = migration.toLowerCase();
const helperStart = migrationLower.indexOf("create or replace function public.mnty_can_platform_admin()");
const helperEnd = migrationLower.indexOf("create or replace function public.get_mantigo_admin_dashboard_backend", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "canonical helper must appear before MantiGO RPC replacements");
const helper = migration.slice(helperStart, helperEnd);

assert.match(migration, /BEGIN;[\s\S]*DO \$preflight\$/);
assert.match(migration, /to_regclass\('private\.platform_admins'\)/);
assert.match(migration, /relrowsecurity/);
assert.match(migration, /ALTER TABLE private[.]platform_admins FORCE ROW LEVEL SECURITY;/i);
assert.match(migration, /has_table_privilege\('anon',[\s\S]*private\.platform_admins/);
assert.match(migration, /has_table_privilege\('authenticated',[\s\S]*private\.platform_admins/);
assert.match(helper, /FROM private\.platform_admins pa/);
assert.match(helper, /WHERE pa\.user_id = auth\.uid\(\)/);
assert.doesNotMatch(helper, /mnty_can\s*\(/i);
assert.match(helper, /SECURITY DEFINER/);
assert.match(helper, /SET search_path = ''/);
assert.match(helper, /REVOKE ALL ON FUNCTION public\.mnty_can_platform_admin\(\) FROM PUBLIC, anon/);
assert.match(helper, /GRANT EXECUTE ON FUNCTION public\.mnty_can_platform_admin\(\) TO authenticated/);

for (const fn of [
  "get_mantigo_admin_dashboard_backend",
  "get_mantigo_admin_financial_report_backend",
  "settle_mantigo_captain_backend",
  "expire_stale_mantigo_rides_backend",
]) {
  const start = migration.indexOf("create or replace function public." + fn);
  assert.ok(start >= 0, "missing replacement for " + fn);
  const next = migration.indexOf("create or replace function public.", start + 20);
  const body = migration.slice(start, next > 0 ? next : migration.length);
  assert.match(body, /auth\.uid\(\)/, fn + " must bind to verified user");
  assert.match(body, /mnty_can_platform_admin\(\)/, fn + " must use canonical platform guard");
  assert.match(body, /search_path = ''/, fn + " must pin empty search_path");
  assert.doesNotMatch(body, /upper\(.*role.*\) IN \('ADMIN','SUPER_ADMIN','OWNER'/i, fn + " must not use generic tenant roles for platform access");
}
assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_mantigo_admin_dashboard_backend\(uuid\) FROM PUBLIC, anon/i);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.settle_mantigo_captain_backend\(uuid,text,text\) FROM PUBLIC, anon/i);
assert.match(migration, /COMMIT;/);

assert.match(baseline, /public\.mnty_can\('admin', NULL, NULL, NULL\)/);
assert.match(baseline, /RC463_BASELINE_DID_NOT_REPRODUCE_WEAK_NULL_SCOPE_HELPER/);
assert.match(baseline, /RC463_BASELINE_FINANCE_NOT_REACHABLE/);
assert.match(baseline, /RC463_BASELINE_SETTLEMENT_NOT_REACHABLE/);
assert.match(baseline, /RC463_BASELINE_EXPIRATION_NOT_REACHABLE/);
assert.match(baseline, /ROLLBACK;/);

assert.match(fixture, /private\.platform_admins/);
assert.match(fixture, /ENABLE ROW LEVEL SECURITY/i);
assert.match(integration, /MNTY-PLATFORM membership without (private )?registry entry must be denied/);
assert.match(integration, /private registry platform admin without tenant membership should pass/);
assert.match(integration, /assert_mantigo_global_rpcs_denied/);
for (const caller of ["admin_create_global_ad", "fulfill_digital_page_publish", "review_mantigo_captain_application", "set_mantigo_financial_config_backend"]) {
  assert.match(sharedCallers, new RegExp(caller));
}
assert.match(sharedCallers, /tenant OWNER created a platform global advertisement/);
assert.match(sharedCallers, /platform registry admin could not update global MantiGO configuration/);
assert.match(workflow, /rc463_platform_admin_live_baseline\.sql/);
assert.match(workflow, /20261113214500_rc463_platform_admin_live_registry_hardening\.sql/);
assert.match(workflow, /rc449_mantigo_platform_admin_integration\.sql/);
console.log("RC463 static platform-admin hardening contract: PASS");
