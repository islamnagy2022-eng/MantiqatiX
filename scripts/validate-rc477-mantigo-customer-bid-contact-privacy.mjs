import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql");
const integration = read("../supabase/tests/rc477_mantigo_customer_bid_contact_privacy_integration.sql");
const fixture = read("../supabase/tests/rc446_mantigo_open_ride_fixture.sql");
const workflow = read("../.github/workflows/mantigo-open-ride-privacy.yml");

for (const marker of [
  "auth.uid()",
  "v_user IS DISTINCT FROM p_user_id",
  "b.status='ACCEPTED'",
  "captain_phone",
  "vehicle_plate",
  "SET search_path TO ''",
  "REVOKE ALL ON FUNCTION public.list_mantigo_customer_rides_backend(uuid,text) FROM PUBLIC,anon",
  "GRANT EXECUTE ON FUNCTION public.list_mantigo_customer_rides_backend(uuid,text) TO authenticated",
  "RC477_CUSTOMER_RIDE_READ_DEPENDENCY_MISSING",
]) assert.ok(migration.includes(marker), "RC477 migration missing: " + marker);

assert.ok(migration.includes("to_jsonb(b)-'captain_phone'-'vehicle_plate'"));
assert.ok(migration.includes("'captain_phone',CASE WHEN b.status='ACCEPTED'"));
assert.ok(migration.includes("'vehicle_plate',CASE WHEN b.status='ACCEPTED'"));

for (const marker of [
  "RC477_UNACCEPTED_BID_CONTACT_LEAKED",
  "RC477_ACCEPTED_BID_CONTACT_NOT_AVAILABLE",
  "RC477_NON_SENSITIVE_OFFER_FIELDS_CHANGED",
  "RC477_CUSTOMER_RIDE_ACTOR_MISMATCH_NOT_REJECTED",
  "RC477_CUSTOMER_RIDE_RPC_GRANT_DRIFT",
  "RC477_CUSTOMER_RIDE_RPC_SEARCH_PATH_NOT_EMPTY",
]) assert.ok(integration.includes(marker), "RC477 integration test missing: " + marker);

for (const marker of [
  "captain_phone text",
  "vehicle_plate text",
  "create table public.mantigo_financial_ledger",
  "create table public.mantigo_ride_ratings",
]) assert.ok(fixture.includes(marker), "RC477 fixture missing: " + marker);

assert.ok(workflow.includes("20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql"));
assert.ok(workflow.includes("rc477_mantigo_customer_bid_contact_privacy_integration.sql"));
assert.ok(workflow.indexOf("/tmp/rc477_migration.sql") < workflow.indexOf("/tmp/rc477_test.sql"));
console.log("RC477 MantiGO customer bid privacy static contract: PASS");
