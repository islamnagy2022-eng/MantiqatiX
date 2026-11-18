import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20261118190000_rc479_revoke_anon_provider_profile_base_read.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const fixture = fs.readFileSync("supabase/tests/rc479_provider_profile_anon_read_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc479_provider_profile_anon_read_integration.sql", "utf8");
const directory = fs.readFileSync("supabase/functions/public-catalog-directory/index.ts", "utf8");
const catalog = fs.readFileSync("supabase/functions/public-catalog/index.ts", "utf8");
const publicExposure = fs.readFileSync("scripts/validate-public-marketing-provider-exposure.mjs", "utf8");

assert.match(migration, /^REVOKE SELECT ON TABLE public\.marketing_provider_profiles FROM anon;$/m,
  "RC479 must revoke only the explicit anon SELECT grant");
assert.doesNotMatch(migration, /FROM\\s+(?:authenticated|service_role|PUBLIC)\\s*;/i,
  "RC479 must not revoke authenticated, service_role, or PUBLIC grants");
assert.equal((migration.match(/;/g) || []).length, 1,
  "RC479 must remain a single-purpose privilege-only migration");
assert.match(fixture, /GRANT SELECT ON TABLE public\.marketing_provider_profiles TO anon, authenticated, service_role;/,
  "fixture must model the existing explicit grants before applying RC479");
for (const marker of [
  "RC479_ANON_SELECT_STILL_GRANTED",
  "RC479_AUTHENTICATED_SELECT_WAS_REMOVED",
  "RC479_SERVICE_ROLE_SELECT_WAS_REMOVED",
  "RC479_ANON_DIRECT_READ_SUCCEEDED",
  "RC479_AUTHENTICATED_ACTIVE_PROFILE_READ_REGRESSED",
  "RC479_SERVICE_ROLE_READ_REGRESSED"
]) assert.ok(integration.includes(marker), "missing RC479 integration assertion: " + marker);
for (const [source,label] of [[directory,"public-catalog-directory"],[catalog,"public-catalog"]]) {
  assert.ok(source.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'),
    label + " must retain server-side service-role access");
  assert.ok(source.includes('.from("marketing_provider_profiles")'),
    label + " must continue using the canonical provider profile table");
}
assert.ok(publicExposure.includes("PUBLIC_PROVIDER_COLUMNS"),
  "existing public response projection validator must remain in place");
console.log("RC479 static provider-profile anonymous read contract: PASS");
