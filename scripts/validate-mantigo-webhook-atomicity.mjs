import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/paymob-webhook/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261013080000_atomic_mantigo_paymob_webhook_processing.sql", "utf8");
const tests = fs.readFileSync("supabase/tests/rc_atomic_mantigo_paymob_webhook.sql", "utf8");

const branchStart = edge.indexOf('if(mantigo){');
const branchEnd = edge.indexOf('const {data:intentByRef}', branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "MantiGO webhook branch must remain identifiable");
const branch = edge.slice(branchStart, branchEnd);

assert.ok(edge.indexOf("verify(obj,order,source") < branchStart, "provider HMAC must be verified before MantiGO processing");
assert.ok(branch.includes('admin.rpc("process_verified_mantigo_payment_backend"'), "MantiGO must use the atomic database RPC");
assert.ok(!branch.includes('.from("payment_provider_events").insert'), "MantiGO Edge Function must not insert provider events separately");
assert.ok(!branch.includes('.from("mantigo_financial_ledger").update'), "MantiGO Edge Function must not update the ledger separately");
assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS financial_ledger_id"), "event-to-ledger correlation must have a dedicated column");
assert.ok(migration.includes("FOR UPDATE"), "ledger must be locked during callback processing");
assert.ok(/ON CONFLICT\s*\(provider,\s*external_event_id\)\s*DO NOTHING/i.test(migration), "provider event idempotency must be concurrency-safe");
assert.ok(migration.includes("REVOKE ALL ON FUNCTION public.process_verified_mantigo_payment_backend"), "RPC must revoke default/client execute");
assert.ok(migration.includes("GRANT EXECUTE ON FUNCTION public.process_verified_mantigo_payment_backend"), "RPC must grant service_role only");
assert.ok(tests.includes("TEST_FORCED_LEDGER_WRITE_FAILURE"), "test must prove event rollback when ledger write fails");
assert.ok(tests.includes("PAYMOB_EVENT_IDEMPOTENCY_CONFLICT"), "test must cover cross-ledger event-key reuse");
assert.ok(tests.includes("legacy event correlation was not repaired"), "test must cover recovery of the known legacy event shape");

console.log("MantiGO Paymob webhook atomicity source contract PASS.");
