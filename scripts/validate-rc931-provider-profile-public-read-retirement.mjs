import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const migrationPath = "supabase/migrations/20261128010000_rc931_provider_profile_public_base_read_retirement.sql";
const migration = read(migrationPath);
const rc479Raw = read("supabase/migrations/20261118190000_rc479_revoke_anon_provider_profile_base_read.sql");
const rc479Forward = read("supabase/migrations/20261120193000_rc479_restrict_anonymous_auth_provider_profile_select.sql");
const rc926 = read("supabase/migrations/20261125110000_rc926_provider_profile_confirmed_identity_strict_guard.sql");
const rc115 = read("supabase/migrations/20261125130000_rc115_crm_business_scoped_reads.sql");
const fixture = read("supabase/tests/rc931_provider_profile_public_read_fixture.sql");
const integration = read("supabase/tests/rc931_provider_profile_public_read_integration.sql");
const workflow = read(".github/workflows/rc931-provider-profile-public-read-retirement.yml");
assert.match(workflow, /validate-marketing-crm-tenant-scope\.mjs/);
assert.match(workflow, /rc452_marketing_crm_scope_fixture\.sql/);
assert.match(workflow, /rc452_marketing_crm_scope_integration\.sql/);
assert.match(workflow, /CREATE DATABASE rc115_test/);
const rc926Integration = read("supabase/tests/rc926_provider_profile_confirmed_identity_strict_integration.sql");
const replayWorkflow = read(".github/workflows/forward-migration-chain-replay.yml");
const contract = read("scripts/production/live-reconciliation-contract.mjs");
const verifier = read("scripts/production/verify-production.mjs");
const gate = read("scripts/validate-production-migration-chain-gate.mjs");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const backupValidator = read("scripts/validate-production-backup-runbook-current.mjs");
const publicExposureValidator = read("scripts/validate-public-marketing-provider-exposure.mjs");
const publicCatalog = read("supabase/functions/public-catalog/index.ts");
const publicDirectory = read("supabase/functions/public-catalog-directory/index.ts");
const webIndex = read("web/index.html");
const webApp = read("web/app.js");

assert.ok(rc479Raw.includes("REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;"));
assert.match(rc479Forward, /AS RESTRICTIVE[\s\S]*?FOR SELECT[\s\S]*?TO authenticated/);
assert.match(rc926, /IS NOT DISTINCT FROM\s*'false'/i);
assert.match(rc115, /um\.tenant_id = b\.tenant_id/);
assert.match(rc115, /b\.id = public\.marketing_provider_profiles\.business_id/);
assert.match(migration, /public\.is_platform_admin\(\)/);
assert.match(migration, /FROM private\.platform_admins/);
assert.match(migration, /RC931_REGISTRY_ONLY_PLATFORM_ADMIN_HELPER_REQUIRED/);
assert.doesNotMatch(migration, /um\.tenant_id\s*=\s*'MNTY-PLATFORM'/i,
  "provider CRM policy must not treat MNTY-PLATFORM membership metadata as platform authority");
assert.ok(fixture.includes("CREATE TABLE private.platform_admins"), "fixture must model the canonical platform registry");
assert.ok(fixture.includes("INSERT INTO private.platform_admins(user_id)"), "fixture must register platform authority only in the protected registry");

assert.match(migration, /RC931_PROVIDER_PROFILE_RLS_REQUIRED/);
assert.match(migration, /RC931_PROVIDER_PROFILE_FORCE_RLS_REQUIRED/);
assert.match(migration, /RC931_RC479_RAW_ANON_REVOKE_REQUIRED/);
assert.match(migration, /RC931_RC926_STRICT_CONFIRMED_AUTH_GUARD_REQUIRED/);
assert.match(migration, /RC931_RC115_TENANT_AND_BUSINESS_SCOPED_CRM_POLICY_REQUIRED/);
assert.match(migration, /DROP POLICY IF EXISTS "Public can view active marketing providers"/i);
assert.match(migration, /RC931_GLOBAL_PROVIDER_PROFILE_READ_POLICY_REMAINS/);
assert.match(migration, /RC931_SERVICE_ROLE_DIRECTORY_READ_REGRESSED/);
assert.match(migration, /RC931_AUTHENTICATED_OWNER_AND_CRM_READ_REGRESSED/);
assert.doesNotMatch(migration, /\b(?:GRANT|REVOKE)\b/i, "RC931 must not change table privileges");
assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE FROM|TRUNCATE)\b/i, "RC931 must not mutate business data");
assert.ok(migration.trim().startsWith("begin;") && migration.trim().endsWith("commit;"));

assert.match(fixture, /ALTER TABLE public\.marketing_provider_profiles FORCE ROW LEVEL SECURITY/);
assert.match(fixture, /CREATE POLICY "Public can view active marketing providers"/);
assert.match(fixture, /'TENANT-A'[\s\S]*?'TENANT-B'[\s\S]*?'TENANT-C'/);
assert.match(fixture, /public-customer/);
assert.match(fixture, /provider-a/);
for (const marker of [
  "RC931_GLOBAL_PUBLIC_PROVIDER_POLICY_REMAINS",
  "RC931_UNRELATED_CONFIRMED_USER_READ_PROVIDER_PROFILES",
  "RC931_MANAGER_A_SCOPE_REGRESSED",
  "RC931_MANAGER_B_SCOPE_REGRESSED",
  "RC931_TENANT_ADMIN_OWN_TENANT_READ_REGRESSED",
  "RC931_BUSINESS_OWNER_SCOPED_READ_REGRESSED",
  "RC931_PROFILE_OWNER_READ_REGRESSED",
  "RC931_PROFILE_OWNER_UPDATE_REGRESSED",
  "RC931_TENANT_SUPER_ADMIN_GAINED_CROSS_TENANT_READ",
  "RC931_PLATFORM_ADMIN_GLOBAL_READ_REGRESSED",
  "RC931_UNREGISTERED_MNTY_PLATFORM_MEMBERSHIP_GAINED_GLOBAL_READ",
  "RC931_ANONYMOUS_AUTH_PROVIDER_READ_SUCCEEDED",
  "RC931_MISSING_ANONYMOUS_CLAIM_PROVIDER_READ_SUCCEEDED",
  "RC931_SERVICE_ROLE_READ_REGRESSED",
]) assert.ok(integration.includes(marker), "Missing RC931 integration assertion: " + marker);

assert.match(rc926Integration, /f7914ac7-4b03-4456-afdd-e386f2ac6a5b/);
assert.match(rc926Integration, /RC926_CONFIRMED_USER_READ_REGRESSED/);
assert.match(workflow, /20261118190000_rc479_revoke_anon_provider_profile_base_read\.sql/);
assert.match(workflow, /20261120193000_rc479_restrict_anonymous_auth_provider_profile_select\.sql/);
assert.match(workflow, /20261125110000_rc926_provider_profile_confirmed_identity_strict_guard\.sql/);
assert.match(workflow, /20261125130000_rc115_crm_business_scoped_reads\.sql/);
assert.match(workflow, /20261128010000_rc931_provider_profile_public_base_read_retirement\.sql/);
assert.match(workflow, /rc926_provider_profile_confirmed_identity_strict_integration\.sql/);
assert.match(workflow, /rc931_provider_profile_public_read_integration\.sql/);
assert.match(replayWorkflow, /validate-rc931-provider-profile-public-read-retirement\.mjs/);
assert.match(replayWorkflow, /rc931-provider-profile-public-read-retirement\.yml/);

const projection = "business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured";
for (const [source, label] of [[publicCatalog, "public-catalog"], [publicDirectory, "public-catalog-directory"]]) {
  assert.ok(source.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'), label + " must keep trusted server-side access");
  assert.ok(source.includes('.select("' + projection + '")'), label + " must retain the reviewed public column allowlist");
}
assert.ok(publicExposureValidator.includes("PUBLIC_PROVIDER_COLUMNS"));
assert.ok(publicExposureValidator.includes("primary catalog frontend must not query the provider profile base table directly"));
assert.match(webIndex, /window\.location\.replace\('\/MantiqatiX\/catalog-app\/'\)/);
assert.match(webIndex, /if \(window\.location\.pathname !== '\/MantiqatiX\/catalog-app\/'\) return/);
assert.match(webApp, /\.from\(['"]marketing_provider_profiles['"]\)[^\n]*\.eq\(['"]owner_user_id['"],uid\)/,
  "legacy owner CRM profile read must remain restricted to the authenticated owner");

const required = contract.match(/REQUIRED_RELEASE_MIGRATION_VERSIONS\s*=\s*\[([\s\S]*?)\n\];/);
assert.ok(required, "canonical migration contract array must exist");
const versions = [...required[1].matchAll(/"([0-9]{14})"/g)].map((match) => match[1]);
assert.equal(versions.length, 90, "canonical contract must include RC115 and RC931 as 90 total source versions");
assert.equal(new Set(versions).size, 90, "required migration version list must be unique");
assert.deepEqual(versions, [...versions].sort(), "required migration versions must be strictly timestamp ordered");
for (const version of ["20261125130000", "20261128010000"]) {
  assert.ok(versions.includes(version), "canonical contract missing " + version);
  assert.ok(verifier.includes(version), "Production verifier missing " + version);
  assert.ok(gate.includes(version), "strict migration gate missing " + version);
  assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes(version), "manifest required_versions missing " + version);
  assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes(version), "manifest must keep " + version + " unapplied to Production");
}
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 90);
assert.equal(manifest.required_release_migration_ledger_check.found_in_live_ledger, 0);
assert.equal(backupValidator.includes("CURRENT_RELEASE_MIGRATION_COUNT=90"), true);
assert.match(backupValidator, /20261128010000/);
assert.match(backupValidator, /20261125130000/);

console.log("RC931_PROVIDER_PROFILE_PUBLIC_READ_RETIREMENT_STATIC=PASS");
console.log("RC931_PUBLIC_EDGE_PROJECTION_AND_OWNER_CRM_COMPATIBILITY=PASS");
console.log("RC931_90_VERSION_RELEASE_CONTRACT=PASS");
