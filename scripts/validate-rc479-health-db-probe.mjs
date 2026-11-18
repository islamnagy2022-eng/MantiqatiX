import fs from "node:fs";
import assert from "node:assert/strict";

const health = fs.readFileSync("supabase/functions/health/index.ts", "utf8");
const monitor = fs.readFileSync(".github/workflows/production-health-monitor.yml", "utf8");

assert.match(health, /createClient\\(supabaseUrl, serviceRoleKey/,
  "health function must use its server-side service-role client");
assert.match(health, /Deno\\.env\\.get\\(["']SUPABASE_SERVICE_ROLE_KEY["']\\)/,
  "health function must read service-role credentials only from Edge environment");
assert.match(health, /from\\(["']businesses["']\\)\\.select\\(["']id["']\\)\\.limit\\(1\\)\\.maybeSingle\\(\\)/,
  "health function must execute a minimal read against a table verified readable by service_role");
assert.match(health, /database: \\{ status: ["']ok["'], mode: ["']service_role_read_only["'] \\}/,
  "health response must positively identify a successful DB-backed probe");
assert.match(health, /status: 503[\\s\\S]*database: \\{ status: ["']error["']/,
  "health function must return 503 when the DB probe fails");
assert.doesNotMatch(health, /JSON\\.stringify\\(\\{[\\s\\S]{0,300}(?:error\\.message|serviceRoleKey|supabaseUrl)/,
  "public health response must not disclose internal errors or credentials");

assert.match(monitor, /id: supabase_health/,
  "monitor must expose the health probe mode to the following step");
assert.match(monitor, /database_probe_mode=service_role/,
  "monitor must recognize the DB-backed Edge health response");
assert.match(monitor, /database_probe_mode=legacy_anon/,
  "monitor must retain a fallback until the new Edge Function is deployed");
assert.match(monitor, /DATABASE_PROBE_MODE: \\$\\{\\{ steps\\.supabase_health\\.outputs\\.database_probe_mode \\}\\}/,
  "monitor must pass the health probe mode to the DB check");
assert.match(monitor, /if \\[\\[ "\\$DATABASE_PROBE_MODE" == "service_role" \\]\\]/,
  "monitor must stop using anonymous REST when the DB-backed Edge check is active");
assert.match(monitor, /rest\\/v1\\/marketing_provider_profiles/,
  "legacy fallback must remain available before Edge deployment");
console.log("RC479-compatible Production health probe contract: PASS");
