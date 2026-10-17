import assert from "node:assert/strict";
import fs from "node:fs";

const edge = fs.readFileSync("supabase/functions/paymob-webhook/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql", "utf8");
const start = edge.indexOf('const {data:mantigo}=await admin.from("mantigo_financial_ledger")');
const end = edge.indexOf('const {data:intentByRef}=await admin.from("payment_intents")', start);
assert.ok(start >= 0 && end > start, "MantiGo Paymob block must have explicit boundaries");
const block = edge.slice(start, end);
const signatureCheck = edge.indexOf("verify(obj,order,source,value(raw.hmac??obj.hmac))");
assert.ok(signatureCheck >= 0 && signatureCheck < start, "Paymob HMAC verification must happen before MantiGo processing");
assert.match(block, /admin\.rpc\("process_verified_mantigo_payment_backend"/, "MantiGo callback must use the atomic backend RPC");
for (const field of ["p_ledger_id:mantigo.id", "p_external_event_id:eventId", "p_signature_verified:true", "p_amount:amount", "p_currency:currency", "p_provider_transaction_id:value(obj.id)", "p_raw_payload:mantigoPayload"]) {
  assert.ok(block.includes(field), "missing atomic RPC binding: " + field);
}
assert.doesNotMatch(block, /from\("payment_provider_events"\)\.insert/, "MantiGo provider event must not be inserted outside the atomic RPC");
assert.doesNotMatch(block, /from\("mantigo_financial_ledger"\)\.update/, "MantiGo ledger must not be updated outside the atomic RPC");
assert.doesNotMatch(block, /from\("notifications"\)\.insert/, "MantiGo notification must not be inserted outside the atomic RPC");
assert.match(migration, /alter table public\.mantigo_payment_provider_events enable row level security;/);
assert.match(migration, /alter table public\.mantigo_payment_provider_events force row level security;/);
assert.match(migration, /set search_path = ''/);
assert.match(migration, /revoke all on function public\.process_verified_mantigo_payment_backend[\s\S]*from authenticated;/);
assert.match(migration, /grant execute on function public\.process_verified_mantigo_payment_backend[\s\S]*to service_role;/);
console.log("RC425 Paymob atomicity source contract: PASS");
