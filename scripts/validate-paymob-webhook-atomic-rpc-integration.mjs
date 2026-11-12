import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/paymob-webhook/index.ts", "utf8");
const rc425 = fs.readFileSync("supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql", "utf8");
const rc428 = fs.readFileSync("supabase/migrations/20261009150000_rc428_atomic_provider_failure_webhook.sql", "utf8");
const rc429 = fs.readFileSync("supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql", "utf8");
const rc430 = fs.readFileSync("supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql", "utf8");

const verifyAt = edge.indexOf("verify(obj,order,source");
assert.ok(verifyAt >= 0, "Paymob HMAC verification must exist");
const subStart = edge.indexOf("const sub=subByRef??subByOrder");
const digitalStart = edge.indexOf('const {data:digitalByRef}', subStart);
assert.ok(subStart >= 0 && digitalStart > subStart, "subscription branch must be identifiable");
const sub = edge.slice(subStart, digitalStart);
const mantigoStart = edge.indexOf('const {data:mantigo}=');
const intentStart = edge.indexOf("const intent=intentByRef??intentByOrder;", mantigoStart);
assert.ok(mantigoStart > subStart && intentStart > mantigoStart, "MantiGO branch must be identifiable");
const mantigo = edge.slice(mantigoStart, intentStart);
const successStart = edge.indexOf('const {data:processed,error:e}=await admin.rpc("process_verified_provider_payment"', intentStart);
assert.ok(successStart > intentStart, "ordinary payment success branch must be identifiable");
const ordinaryFailure = edge.slice(intentStart, successStart);

assert.ok(sub.includes('admin.rpc("process_verified_subscription_payment_failure"'), "subscription failure must use RC429");
assert.ok(sub.includes('admin.rpc("process_verified_subscription_payment_backend"'), "subscription success must use RC430");
assert.ok(sub.includes("p_provider_order_id:paymobOrderId"), "subscription callbacks must bind provider order id");
assert.ok(!sub.includes('.from("subscription_payment_intents").update'), "subscription branch must not update intent separately");
assert.ok(mantigo.includes('admin.rpc("process_verified_mantigo_payment_backend"'), "MantiGO must use RC425");
for (const field of ["provider:", "transaction_id:", "merchant_order_id:", "provider_order_id:", "amount_cents:", "currency,", "success:"]) {
  assert.ok(mantigo.includes(field), `MantiGO provider payload must bind ${field}`);
}
assert.ok(!mantigo.includes('.from("payment_provider_events").insert'), "MantiGO must not write generic provider events separately");
assert.ok(!mantigo.includes('.from("mantigo_financial_ledger").update'), "MantiGO must not update ledger separately");
assert.ok(!mantigo.includes('.from("notifications").insert'), "MantiGO notification must be part of the atomic RC425 RPC");
assert.ok(ordinaryFailure.includes('admin.rpc("process_verified_provider_payment_failure"'), "ordinary failure must use RC428");
assert.ok(ordinaryFailure.includes("p_provider_transaction_id:value(obj.id)"), "ordinary failure must bind provider transaction id");
assert.ok(ordinaryFailure.includes("p_provider_order_id:paymobOrderId"), "ordinary failure must bind provider order id");
assert.ok(!ordinaryFailure.includes('.from("payment_provider_events").insert'), "ordinary failure must not insert event separately");
assert.ok(!ordinaryFailure.includes('.from("payment_intents").update'), "ordinary failure must not update intent separately");

assert.ok(rc425.includes("create table if not exists public.mantigo_payment_provider_events"), "RC425 must persist MantiGO events in a dedicated table");
assert.ok(rc425.includes("p_raw_payload->>'provider_order_id'"), "RC425 must bind provider order to locked ledger");
assert.ok(rc428.includes("create or replace function public.process_verified_provider_payment_failure"), "RC428 failure RPC missing");
assert.ok(rc428.includes("p_provider_order_id text"), "RC428 must validate provider order binding");
assert.ok(rc429.includes("create or replace function public.process_verified_subscription_payment_failure"), "RC429 failure RPC missing");
assert.ok(rc430.includes("create or replace function public.process_verified_subscription_payment_backend"), "RC430 success RPC missing");
assert.ok(rc430.includes("p_provider_order_id text"), "RC430 must validate provider order binding");

console.log("Paymob webhook-to-RC425/RC428/RC429/RC430 atomic RPC contract PASS.");
