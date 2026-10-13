import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/paymob-webhook/index.ts", "utf8");
const subscriptionStart = source.indexOf("if(sub){");
const digitalStart = source.indexOf("const {data:digitalByRef}", subscriptionStart);
const mantigoStart = source.indexOf("if(mantigo){");
const normalStart = source.indexOf("const {data:intentByRef}");
assert(subscriptionStart >= 0 && digitalStart > subscriptionStart, "subscription branch must be identifiable");
assert(mantigoStart > digitalStart && normalStart > mantigoStart, "payment branches must remain ordered");
const subscription = source.slice(subscriptionStart, digitalStart);
const digital = source.slice(digitalStart, mantigoStart);
const mantigo = source.slice(mantigoStart, normalStart);
const normal = source.slice(normalStart);

function check(label, condition) {
  assert.ok(condition, label);
  console.log("PASS " + label);
}

check("subscription failure uses atomic RC429 RPC", subscription.includes('admin.rpc("process_verified_subscription_payment_failure"'));
check("subscription success uses atomic RC430 RPC", subscription.includes('admin.rpc("process_verified_subscription_payment_backend"'));
check("subscription RPC binds provider order ID", subscription.includes("p_provider_order_id:paymobOrderId"));
check("subscription RPC passes signature and raw payload", subscription.includes("p_signature_verified:true") && subscription.includes("p_raw_payload:raw"));
check("subscription success does not echo raw RPC result or internal legal error", !subscription.includes("result:processed"));
check("subscription branch does not pre-read event ledger or directly mutate intent", !subscription.includes('.from("payment_provider_events")') && !subscription.includes('.from("subscription_payment_intents").update'));

check("digital page transitions remain in atomic RC424/RC431 RPC", digital.includes('admin.rpc("process_verified_digital_page_payment_backend"'));
check("digital page RPC binds provider order ID", digital.includes("p_provider_order_id:paymobOrderId"));

check("MantiGO transitions use atomic RC425 RPC", mantigo.includes('admin.rpc("process_verified_mantigo_payment_backend"'));
check("MantiGO payload binds transaction, merchant, provider order, amount, currency and result", ["transaction_id:value(obj.id)", "merchant_order_id:merchantRef", "provider_order_id:paymobOrderId", "amount_cents:value(obj.amount_cents)", "success:success?\"true\":\"false\""].every(x => mantigo.includes(x)));
check("MantiGO branch has no direct event, ledger or notification writes", !mantigo.includes('.from("payment_provider_events")') && !mantigo.includes('.from("mantigo_financial_ledger").update') && !mantigo.includes('.from("notifications").insert'));

check("normal payment resolves and compares provider_order_id before processing", normal.includes("provider_order_id") && normal.includes("String(intent.provider_order_id)!==paymobOrderId"));
check("normal failure uses atomic RC428 RPC", normal.includes('admin.rpc("process_verified_provider_payment_failure"'));
check("normal success remains server-authoritative RPC", normal.includes('admin.rpc("process_verified_provider_payment"'));
check("normal success does not echo raw RPC result", !normal.includes("result:processed"));
check("normal failure does not write event ledger or intent directly", !normal.includes('.from("payment_provider_events").insert') && !normal.includes('.from("payment_intents").update'));
check("normal payment branch delegates replay binding to its atomic RPC", !normal.includes('.from("payment_provider_events").select') && !normal.includes('.from("payment_provider_events").insert'));

console.log("Paymob webhook atomic transition contract: PASS (static source checks only; SQL/HTTP E2E is separate).");
