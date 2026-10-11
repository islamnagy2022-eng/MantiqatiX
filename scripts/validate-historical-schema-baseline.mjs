import fs from "node:fs";
import path from "node:path";

const migrationDirectory = "supabase/migrations";
const baselinePath = "supabase/tests/baselines/smm_provider_credentials.sql";
const files = fs.readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrations = files.map((name) => ({
  name,
  sql: fs.readFileSync(path.join(migrationDirectory, name), "utf8"),
}));
const firstCredentialReference = migrations.find(({ sql }) =>
  /smm_provider_credentials/i.test(sql)
);
const createsCredentialsTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_provider_credentials"?\b/i.test(sql)
);
const createsProvidersTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_providers"?\b/i.test(sql)
);

if (!fs.existsSync(baselinePath)) {
  console.error("P0 BLOCKED: owner-approved test-only schema baseline is missing at " + baselinePath);
  process.exit(1);
}
const baseline = fs.readFileSync(baselinePath, "utf8");
const baselineChecks = [
  ["provider_id UUID primary key", /provider_id\s+uuid\s+not\s+null/i.test(baseline) && /primary\s+key\s*\(\s*provider_id\s*\)/i.test(baseline)],
  ["encrypted key remains nullable text", /api_key_ciphertext\s+text\s*,/i.test(baseline)],
  ["configured defaults false", /configured\s+boolean\s+not\s+null\s+default\s+false/i.test(baseline)],
  ["updated_at defaults now", /updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(baseline)],
  ["FK references smm_providers with cascade", /foreign\s+key\s*\(\s*provider_id\s*\)[\s\S]*references\s+public\.smm_providers\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i.test(baseline)],
  ["RLS is enabled", /enable\s+row\s+level\s+security/i.test(baseline)],
  ["client access is denied by policy", /to\s+anon\s*,\s*authenticated[\s\S]*using\s*\(\s*false\s*\)[\s\S]*with\s+check\s*\(\s*false\s*\)/i.test(baseline)],
  ["baseline is explicitly test-only", /TEST-ONLY SCHEMA BASELINE/i.test(baseline) && /Never apply this file to production/i.test(baseline)],
];
const failed = baselineChecks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error("P0 BLOCKED: test baseline validation failed: " + name);
  process.exit(1);
}
if (createsCredentialsTable) {
  console.error("P0 BLOCKED: do not add a guessed or backdated production migration for smm_provider_credentials; use the separately approved test-only baseline.");
  process.exit(1);
}
if (!firstCredentialReference) {
  console.error("P0 BLOCKED: no migration references smm_provider_credentials; expected historical privilege migration was not found.");
  process.exit(1);
}
if (!createsProvidersTable) {
  console.error("P0 BLOCKED: the approved credentials baseline has a foreign key to public.smm_providers(id), but no committed migration creates public.smm_providers.");
  console.error("Recover authoritative provider-table DDL or obtain separate explicit approval for a test-only provider baseline. Do not invent a minimal provider table or bypass the dependency.");
  process.exit(1);
}
console.log("Historical schema baseline preflight PASS: approved credentials baseline validated and provider table creation source found.");
