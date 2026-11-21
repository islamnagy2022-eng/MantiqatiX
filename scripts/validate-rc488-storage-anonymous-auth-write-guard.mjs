import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120230000_rc488_storage_anonymous_auth_write_guard.sql",
  "utf8",
);
const integration = fs.readFileSync(
  "supabase/tests/rc488_storage_anonymous_auth_write_guard_integration.sql",
  "utf8",
);
const fixture = fs.readFileSync(
  "supabase/tests/rc488_storage_anonymous_auth_write_guard_fixture.sql",
  "utf8",
);

for (const [command, policyName] of [
  ["INSERT", "storage_objects_confirmed_auth_insert"],
  ["UPDATE", "storage_objects_confirmed_auth_update"],
  ["DELETE", "storage_objects_confirmed_auth_delete"],
]) {
  const policy = new RegExp(
    "CREATE\\s+POLICY\\s+" +
      policyName +
      "[\\s\\S]*?AS\\s+RESTRICTIVE[\\s\\S]*?FOR\\s+" +
      command +
      "[\\s\\S]*?TO\\s+authenticated[\\s\\S]*?is_anonymous",
    "i",
  );
  assert.match(migration, policy, "missing restrictive anonymous-auth guard for " + command);
}
assert.ok(migration.includes("(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE"), "Storage guards must fail closed when is_anonymous is missing");
assert.ok(integration.includes("RC488_MISSING_ANONYMOUS_CLAIM_WRITE_SUCCEEDED"), "missing Storage missing-claim regression");
assert.ok(fixture.includes("CREATE TABLE private.platform_admins"), "RC488 fixture must model RC484's authoritative platform-admin registry");
assert.ok(fixture.includes("public.is_platform_admin()"), "platform branding policy must use registry-backed platform authority");
assert.ok(integration.includes("INSERT INTO private.platform_admins(user_id)"), "confirmed platform-admin branding regression must seed the authoritative registry");
assert.ok(integration.includes("VALUES (v_anon),(v_owner)"), "anonymous branding denial must be tested against an otherwise-authorized legacy permissive policy");
assert.doesNotMatch(migration, /FOR\s+SELECT/i,
  "RC488 must not restrict public profile-media reads");
assert.ok(migration.includes("mantiqatix-profile-media") === false,
  "migration must be bucket-agnostic so it protects all authenticated Storage writes");
for (const marker of [
  "RC488_PUBLIC_PROFILE_MEDIA_READ_REGRESSED",
  "RC488_ANONYMOUS_PRIVATE_MEDIA_READ_SUCCEEDED",
  "RC488_ANONYMOUS_PROFILE_MEDIA_UPDATE_SUCCEEDED",
  "RC488_ANONYMOUS_PROFILE_MEDIA_DELETE_SUCCEEDED",
  "RC488_RESTRICTIVE_DELETE_POLICY_MISSING",
  "RC488_ANONYMOUS_PLATFORM_BRAND_INSERT_SUCCEEDED",
  "RC488_CONFIRMED_OWNER_UPDATE_REGRESSED",
  "RC488_CONFIRMED_OWNER_DELETE_REGRESSED",
  "RC488_RAW_ANON_PUBLIC_PROFILE_READ_REGRESSED",
]) {
  assert.ok(integration.includes(marker), "missing RC488 behavioral assertion: " + marker);
}
assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
console.log("RC488 Storage anonymous Auth write-guard contract: PASS");
