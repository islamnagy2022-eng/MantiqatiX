import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql");
const fixture = read("../supabase/tests/rc446_mantigo_open_ride_fixture.sql");
const rc446Integration = read("../supabase/tests/rc446_mantigo_open_ride_integration.sql");
const integration = read("../supabase/tests/rc478_mantigo_open_ride_forward_privacy_integration.sql");
const workflow = read("../.github/workflows/mantigo-open-ride-privacy.yml");

for (const marker of [
  "RC478_OPEN_RIDE_SCHEMA_DEPENDENCY_MISSING",
  "auth.jwt()->>'is_anonymous'",
  "MANTIGO_AUTH_REQUIRED",
  "MANTIGO_CAPTAIN_PROFILE_REQUIRED",
  "cp.status='ACTIVE'",
  "cp.verification_status='VERIFIED'",
  "cp.availability_status='AVAILABLE'",
  "r.vehicle_category=v_vehicle_category",
  "SET search_path = pg_catalog",
  "REVOKE ALL ON FUNCTION public.list_open_mantigo_rides_backend(uuid) FROM PUBLIC,anon",
  "GRANT EXECUTE ON FUNCTION public.list_open_mantigo_rides_backend(uuid) TO authenticated"
]) assert.ok(migration.includes(marker), "RC478 migration missing: "+marker);

assert.ok(fixture.includes("create or replace function auth.jwt()"), "fixture must model JWT anonymity");
assert.ok(fixture.includes("vehicle_category text"), "fixture must include captain vehicle category");
assert.ok(rc446Integration.includes("vehicle_category"), "RC446 regression must remain schema compatible");

for (const marker of [
  "RC478 anon must not execute open-ride RPC",
  "MANTIGO_AUTH_REQUIRED",
  "MANTIGO_CAPTAIN_PROFILE_REQUIRED",
  "RC478 sedan captain expected one eligible ride",
  "RC478 SUV category scope failed",
  "search_path=pg_catalog"
]) assert.ok(integration.includes(marker), "RC478 integration missing: "+marker);

for (const marker of [
  "20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql",
  "rc478_mantigo_open_ride_forward_privacy_integration.sql",
  "/tmp/rc478_migration.sql",
  "/tmp/rc478_test.sql"
]) assert.ok(workflow.includes(marker), "RC478 workflow missing: "+marker);
assert.ok(workflow.indexOf("/tmp/rc477_test.sql") < workflow.indexOf("/tmp/rc478_migration.sql"));
assert.ok(workflow.indexOf("/tmp/rc478_migration.sql") < workflow.indexOf("/tmp/rc478_test.sql"));
console.log("RC478 MantiGO open-ride forward privacy static contract: PASS");
