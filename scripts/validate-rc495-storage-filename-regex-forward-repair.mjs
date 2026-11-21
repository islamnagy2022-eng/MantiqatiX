import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261121020000_rc495_storage_filename_regex_forward_repair.sql", "utf8");
const test = readFileSync("supabase/tests/rc495_storage_filename_regex_forward_repair.sql", "utf8");
const storageGuard = readFileSync("supabase/migrations/20261120230000_rc488_storage_anonymous_auth_write_guard.sql", "utf8");

for (const policy of [
  "mnty_platform_brand_insert",
  "mnty_platform_brand_update",
  "mnty_platform_brand_delete",
  "mnty_profile_media_owner_insert",
  "mnty_profile_media_owner_update",
]) {
  assert.match(migration, new RegExp("DROP POLICY " + policy + " ON storage\\.objects"));
  assert.match(migration, new RegExp("CREATE POLICY " + policy + "[\\s\\S]*?ON storage\\.objects"));
  assert.ok(test.includes(policy), "RC495 SQL test must inspect " + policy);
}
assert.match(migration, /public\.mnty_can_platform_admin\(\)/);
assert.doesNotMatch(migration, /user_memberships|SUPER_ADMIN/);
assert.match(migration, /\[\.\]/, "filename suffix separators must use a literal character class");
assert.equal(migration.includes("\\\\."), false, "over-escaped filename suffix predicates must not return");
assert.match(migration, /\(SELECT \(auth\.jwt\(\)->>'is_anonymous'\)::boolean\) IS FALSE/);
assert.match(storageGuard, /\(SELECT \(auth\.jwt\(\)->>'is_anonymous'\)::boolean\) IS FALSE/);
for (const marker of [
  "RC495_PLATFORM_BRAND_INSERT_REGISTRY_OR_REGEX_REGRESSED",
  "RC495_PLATFORM_BRAND_UPDATE_USING_REGRESSED",
  "RC495_PLATFORM_BRAND_DELETE_REGISTRY_OR_REGEX_REGRESSED",
  "RC495_PROFILE_MEDIA_OWNER_INSERT_REGEX_OR_AUTH_REGRESSED",
  "RC495_PROFILE_MEDIA_OWNER_UPDATE_REGEX_OR_AUTH_REGRESSED",
]) assert.ok(test.includes(marker), "missing RC495 assertion " + marker);
assert.match(test, /RC495_PROVIDER_PROFILE_FILENAME_REGEX_REGRESSED/);
console.log("RC495 Storage filename regex and platform-root registry contract: PASS");
