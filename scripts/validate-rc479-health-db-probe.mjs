import fs from "node:fs";
import assert from "node:assert/strict";

const health = fs.readFileSync("supabase/functions/health/index.ts", "utf8");
const monitor = fs.readFileSync(".github/workflows/production-health-monitor.yml", "utf8");

assert.ok(health.includes('createClient(supabaseUrl, serviceRoleKey'),
  "health function must use its server-side service-role client");
assert.ok(health.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'),
  "health function must read service-role credentials only from Edge environment");
assert.ok(health.includes('db.from("businesses").select("id").limit(1).maybeSingle()'),
  "health function must execute a minimal read against a table verified readable by service_role");
assert.ok(health.includes('database: { status: "ok", mode: "service_role_read_only" }'),
  "health response must positively identify a successful DB-backed probe");
assert.ok(health.includes("status: 503") && health.includes('database: { status: "error", mode: "service_role_read_only" }'),
  "health function must return 503 when the DB probe fails");
assert.ok(health.includes('status: "degraded"') && health.includes('service: "mantiqatix-health"'),
  "database failure response must be generic and identify only the health service");
assert.ok(!health.includes("error.message") && !health.includes("error.details") &&
  !health.includes("serviceRoleKey,") && !health.includes("supabaseUrl,"),
  "public response must not disclose raw database errors or credentials");
assert.ok(health.includes('Cache-Control: "no-store"'),
  "health responses must not be cached");

assert.ok(monitor.includes("id: supabase_health"),
  "monitor must expose the health probe mode to the following step");
assert.ok(monitor.includes("database_probe_mode=service_role"),
  "monitor must recognize the DB-aware Edge response");
assert.ok(monitor.includes("database_probe_mode=legacy_anon"),
  "monitor must retain a fallback until the new Edge Function is deployed");
assert.ok(monitor.includes("DATABASE_PROBE_MODE: ${{ steps.supabase_health.outputs.database_probe_mode }}"),
  "monitor must pass the health probe mode to the DB check");
assert.ok(monitor.includes('if [[ "$DATABASE_PROBE_MODE" == "service_role" ]]'),
  "monitor must stop using anonymous REST when the DB-aware Edge check is active");
assert.ok(monitor.includes("/rest/v1/marketing_provider_profiles"),
  "legacy fallback must remain available before Edge deployment");
assert.ok(monitor.includes('grep -Fq "MantiqatiX"'),
  "Pages root probe must retain the canonical site title check");
assert.ok(!monitor.includes('\\\\.(js|css)') && !monitor.includes('\\\\2'),
  "asset matching must retain valid grep/sed escapes");
console.log("RC479-compatible Production health probe contract: PASS");
