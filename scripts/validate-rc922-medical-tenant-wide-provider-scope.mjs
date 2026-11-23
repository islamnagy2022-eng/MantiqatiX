import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationDir = "supabase/migrations";
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(name => /^\d{14}_rc922_medical_appointment_tenant_wide_provider_scope\.sql$/.test(name));
assert.equal(migrationFiles.length, 1, "RC922 must have one timestamped migration filename produced by Supabase CLI");
assert.ok(migrationFiles.includes("20261123221950_rc922_medical_appointment_tenant_wide_provider_scope.sql"), "RC922 migration must use the exact CLI-generated timestamped filename included in the release contract");

const sql = fs.readFileSync(path.join(migrationDir, migrationFiles[0]), "utf8");
const tests = fs.readFileSync("supabase/tests/rc922_medical_status_integration.sql", "utf8");

assert.match(sql, /um\.business_id\s*=\s*v_appointment\.business_id[\s\S]*or\s*\([\s\S]*um\.business_id\s+is\s+null[\s\S]*upper\(um\.role\)\s*=\s*'SERVICE_PROVIDER'[\s\S]*\)/i);
assert.match(sql, /mp\.owner_user_id\s*=\s*v_uid/i);
assert.match(sql, /mp\.business_id\s*=\s*v_appointment\.business_id/i);
assert.match(sql, /b\.tenant_id\s*=\s*v_appointment\.tenant_id/i);
assert.match(sql, /upper\(mp\.status\)\s*=\s*'ACTIVE'/i);
assert.match(sql, /for\s+update/i);
assert.match(sql, /set\s+search_path\s+to\s+''/i);
assert.match(sql, /revoke\s+all\s+on\s+function[\s\S]*from\s+public,\s*anon,\s*authenticated/i);
assert.match(sql, /grant\s+execute\s+on\s+function[\s\S]*to\s+authenticated/i);
assert.doesNotMatch(sql, /drop\s+(?:function|table|policy)|alter\s+table[\s\S]*drop/i);
assert.doesNotMatch(sql, /or\s+um\.business_id\s+is\s+null\s*(?:\n|$)/i);

for (const token of [
  "RC922_TENANT_WIDE_PROVIDER_ASSIGNED_PROFILE_DID_NOT_CONFIRM",
  "RC922_TENANT_WIDE_PROVIDER_CHANGED_UNOWNED_CROSS_BUSINESS_PROFILE",
  "RC922_TENANT_WIDE_MANAGER_RECEIVED_PROVIDER_EXCEPTION",
  "RC922_TENANT_WIDE_ADMIN_RECEIVED_PROVIDER_EXCEPTION",
  "RC922_TENANT_WIDE_OWNER_RECEIVED_PROVIDER_EXCEPTION",
  "ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED",
  "ASSIGNED_PROVIDER_REQUIRED"
]) assert.ok(tests.includes(token), `RC922 integration test missing ${token}`);

console.log(`RC922 medical tenant-wide provider scope source contract: PASS (${migrationFiles[0]})`);
