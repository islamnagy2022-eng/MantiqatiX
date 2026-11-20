import fs from "node:fs";
import assert from "node:assert/strict";

const historicalMigration = fs.readFileSync(
  "supabase/migrations/20261118190000_rc479_revoke_anon_provider_profile_base_read.sql",
  "utf8",
);
const forwardMigration = fs.readFileSync(
  "supabase/migrations/20261120193000_rc479_restrict_anonymous_auth_provider_profile_select.sql",
  "utf8",
);
const fixture = fs.readFileSync(
  "supabase/tests/rc479_provider_profile_anon_read_fixture.sql",
  "utf8",
);
const rawAnonTest = fs.readFileSync(
  "supabase/tests/rc479_provider_profile_anon_read_integration.sql",
  "utf8",
);
const baseline = fs.readFileSync(
  "supabase/tests/rc479_anonymous_auth_session_baseline.sql",
  "utf8",
);
const postMigration = fs.readFileSync(
  "supabase/tests/rc479_anonymous_auth_session_boundary_integration.sql",
  "utf8",
);

assert.ok(historicalMigration.includes(
  "REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;"
), "historical RC479 raw-anon revoke must remain intact");
assert.equal((historicalMigration.match(/;/g) || []).length, 1,
  "historical RC479 migration must remain immutable and single-purpose");
assert.ok(forwardMigration.includes("AS RESTRICTIVE")
  && forwardMigration.includes("FOR SELECT")
  && forwardMigration.includes("TO authenticated")
  && forwardMigration.includes("auth.jwt() ->> 'is_anonymous'"),
  "forward migration must restrict SELECT for anonymous Auth JWTs");
assert.ok(!/FOR (ALL|INSERT|UPDATE|DELETE)/i.test(forwardMigration),
  "forward migration must not change owner DML policy behavior");
assert.ok(fixture.includes(
  "GRANT SELECT ON TABLE public.marketing_provider_profiles TO anon, authenticated, service_role;"
), "fixture must model the pre-RC479 grants");
assert.ok(rawAnonTest.includes("RC479_ANON_DIRECT_READ_SUCCEEDED"),
  "raw anon direct REST read denial must remain tested");
assert.ok(baseline.includes('"role":"authenticated","is_anonymous":true')
  && baseline.includes("RC479_ANONYMOUS_AUTH_BASELINE_NOT_REPRODUCED"),
  "test must reproduce anonymous Auth read before the forward migration");
assert.ok(postMigration.includes("RC479_ANONYMOUS_AUTH_PRIVATE_PROFILE_READ_REMAINS")
  && postMigration.includes("RC479_CONFIRMED_AUTHENTICATED_PROFILE_READ_REGRESSED")
  && postMigration.includes("RC479_FORWARD_RESTRICTIVE_SELECT_POLICY_MISSING"),
  "post-migration tests must verify anonymous denial and confirmed-user compatibility");
console.log("RC479 forward anonymous Auth-session migration contract: PASS");
