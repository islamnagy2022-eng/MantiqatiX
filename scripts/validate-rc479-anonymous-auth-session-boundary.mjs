import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261118190000_rc479_revoke_anon_provider_profile_base_read.sql",
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
const anonymousAuthTest = fs.readFileSync(
  "supabase/tests/rc479_anonymous_auth_session_boundary_integration.sql",
  "utf8",
);

assert.ok(migration.includes(
  "REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;"
), "RC479 must remain a narrow raw-anon privilege revoke");
assert.equal((migration.match(/;/g) || []).length, 1,
  "RC479 historical migration must remain immutable and single-purpose");
assert.ok(fixture.includes(
  "GRANT SELECT ON TABLE public.marketing_provider_profiles TO anon, authenticated, service_role;"
), "fixture must model the pre-RC479 grants");
assert.ok(rawAnonTest.includes("RC479_ANON_DIRECT_READ_SUCCEEDED"),
  "raw anon direct REST read denial must remain tested");
assert.ok(anonymousAuthTest.includes('"role":"authenticated","is_anonymous":true'),
  "anonymous Auth JWT must use the authenticated database role");
assert.ok(anonymousAuthTest.includes("RC479_ANONYMOUS_AUTH_BASELINE_NOT_REPRODUCED"),
  "test must first reproduce the post-RC479 anonymous Auth residual read");
assert.ok(anonymousAuthTest.includes("CREATE POLICY rc479_test_only_anonymous_auth_session_deny")
  && anonymousAuthTest.includes("AS RESTRICTIVE")
  && anonymousAuthTest.includes("FOR SELECT")
  && anonymousAuthTest.includes("TO authenticated"),
  "test-only overlay must model a restrictive guard for anonymous Auth sessions");
assert.ok(anonymousAuthTest.includes("auth.jwt()->>'is_anonymous'"),
  "restrictive guard must bind to the JWT is_anonymous claim");
assert.ok(anonymousAuthTest.includes("RC479_ANONYMOUS_AUTH_PRIVATE_PROFILE_READ_REMAINS"),
  "anonymous Auth session must see zero rows after the test-only guard");
assert.ok(anonymousAuthTest.includes("RC479_CONFIRMED_AUTHENTICATED_PROFILE_READ_REGRESSED"),
  "confirmed authenticated profile reads must remain available");
assert.ok(!migration.includes("CREATE POLICY") && !migration.includes("is_anonymous"),
  "do not mutate the historical RC479 migration; create a forward migration later");

console.log("RC479 anonymous Auth-session residual and target-boundary contract: PASS");
