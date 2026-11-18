import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql");
const integration = read("../supabase/tests/rc476_mantigo_captain_earnings_integration.sql");
const fixture = read("../supabase/tests/rc449_mantigo_platform_admin_fixture.sql");
const workflow = read("../.github/workflows/mantigo-platform-admin-scope.yml");

const start = migration.indexOf("CREATE OR REPLACE FUNCTION public.get_mantigo_captain_earnings_backend");
const end = migration.indexOf("$function$;", start);
assert.ok(start >= 0 && end > start, "RC476 must replace the existing captain earnings RPC");
const body = migration.slice(start, end);

for (const marker of [
  "l.gross_amount",
  "l.commission_amount",
  "l.captain_net_amount",
  "l.settlement_status='SETTLED'",
  "l.payment_status IN ('PAID','CASH_CONFIRMED')",
  "auth.uid()",
  "CAPTAIN_PROFILE_REQUIRED",
  "SET search_path TO ''",
  "REVOKE ALL ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) FROM PUBLIC,anon",
  "GRANT EXECUTE ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) TO authenticated",
  "RC476_LEDGER_COLUMNS_MISSING",
]) assert.ok(migration.includes(marker), "RC476 migration missing contract: " + marker);

assert.doesNotMatch(body, /l\.amount\b|l\.captain_amount\b/, "RPC must not reference legacy ledger column names");
for (const marker of [
  "RC476_EARNINGS_AGGREGATE_MISMATCH",
  "RC476_USER_CONTEXT_MISMATCH_NOT_REJECTED",
  "RC476_MISSING_CAPTAIN_PROFILE_NOT_REJECTED",
  "RC476_EARNINGS_RPC_GRANT_DRIFT",
  "RC476_EARNINGS_RPC_SEARCH_PATH_NOT_EMPTY",
  "999,888",
  "777,666",
  "gross_amount",
  "captain_net_amount",
]) assert.ok(integration.includes(marker), "RC476 integration test missing: " + marker);

assert.ok(fixture.includes("create table public.mantigo_captain_profiles"), "disposable fixture needs captain profiles");
assert.ok(fixture.includes("create table public.mantigo_bids"), "disposable fixture needs bids");
assert.ok(workflow.includes("20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql"));
assert.ok(workflow.includes("rc476_mantigo_captain_earnings_integration.sql"));
assert.ok(workflow.includes("node scripts/validate-rc476-captain-earnings-live-columns.mjs"));
assert.ok(workflow.indexOf("/tmp/rc476.sql") > workflow.indexOf("/tmp/rc471.sql"));
assert.ok(workflow.indexOf("/tmp/rc476-test.sql") > workflow.indexOf("/tmp/rc476.sql"));

console.log("RC476 captain earnings static contract: PASS");
