import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const webhook = read("supabase/functions/paymob-webhook/index.ts");
const paymentIntent = read("supabase/functions/payment-intent/index.ts");
const digitalIntent = read("supabase/functions/digital-page-payment-intent/index.ts");
const subscriptionIntent = read("supabase/functions/subscription-payment-intent/index.ts");
const rc425 = read("supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql");
const rc426 = read("supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql");
const rc428 = read("supabase/migrations/20261009150000_rc428_atomic_provider_failure_webhook.sql");
const rc429 = read("supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql");
const rc430 = read("supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql");
const rc431 = read("supabase/migrations/20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql");
const rc435 = read("supabase/migrations/20261009210000_rc435_subscription_provider_intent_claim.sql");
const rc439 = read("supabase/migrations/20261010010000_rc439_encrypted_checkout_recovery.sql");

const mStart = webhook.indexOf('const {data:mantigo}=await admin.from("mantigo_financial_ledger")');
const mEnd = webhook.indexOf('const {data:intentByRef}=await admin.from("payment_intents")', mStart);
assert.ok(mStart >= 0 && mEnd > mStart, "MantiGo Paymob block must have explicit boundaries");
const mantigoBlock = webhook.slice(mStart, mEnd);
const signatureCheck = webhook.indexOf("verify(obj,order,source,value(raw.hmac??obj.hmac))");
assert.ok(signatureCheck >= 0 && signatureCheck < mStart, "Paymob HMAC verification must happen before payment processing");

for (const [rpc, file] of [
  ["process_verified_mantigo_payment_backend", mantigoBlock],
  ["process_verified_provider_payment_failure", webhook],
  ["process_verified_subscription_payment_failure", webhook],
  ["process_verified_subscription_payment_backend", webhook],
  ["process_verified_digital_page_payment_backend", webhook]
]) {
  assert.ok(file.includes(`rpc("${rpc}"`), "webhook must use atomic RPC " + rpc);
}
for (const field of ["p_ledger_id:mantigo.id", "p_external_event_id:eventId", "p_signature_verified:true", "p_amount:amount", "p_currency:currency", "p_provider_transaction_id:value(obj.id)", "p_raw_payload:mantigoPayload"]) {
  assert.ok(mantigoBlock.includes(field), "missing MantiGo atomic RPC binding: " + field);
}
assert.doesNotMatch(mantigoBlock, /from\("payment_provider_events"\)\.insert/, "MantiGo provider event must not be inserted outside the atomic RPC");
assert.doesNotMatch(mantigoBlock, /from\("mantigo_financial_ledger"\)\.update/, "MantiGo ledger must not be updated outside the atomic RPC");
assert.doesNotMatch(mantigoBlock, /from\("notifications"\)\.insert/, "MantiGo notification must not be inserted outside the atomic RPC");

assert.ok(paymentIntent.includes("provider_order_id: providerOrderId"), "normal payment intent must persist Paymob order correlation");
assert.ok(paymentIntent.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN"), "ambiguous Paymob creation outcomes must fail closed for reconciliation");
assert.ok(digitalIntent.includes("p_provider_order_id:providerOrderId"), "digital-page intent finalization must persist provider order correlation");
assert.ok(digitalIntent.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN"), "digital-page provider ambiguity must not be blindly retried");
assert.ok(subscriptionIntent.includes('rpc("create_subscription_payment_intent_claimable_backend"'), "subscription flow must use the claimable intent RPC");
assert.ok(subscriptionIntent.includes('rpc("claim_subscription_provider_intent_creation_backend"'), "subscription provider creation must be claimed atomically");
assert.ok(subscriptionIntent.includes("provider_creation_state: \"CORRELATED\""), "subscription provider correlation state must be persisted");

for (const [label, source, rpc] of [
  ["RC425", rc425, "process_verified_mantigo_payment_backend"],
  ["RC426", rc426, "finalize_digital_page_payment_intent_backend"],
  ["RC428", rc428, "process_verified_provider_payment_failure"],
  ["RC429", rc429, "process_verified_subscription_payment_failure"],
  ["RC430", rc430, "process_verified_subscription_payment_backend"],
  ["RC431", rc431, "process_verified_digital_page_payment_backend"],
  ["RC435", rc435, "claim_subscription_provider_intent_creation_backend"]
]) assert.ok(source.includes(rpc), label + " migration must define " + rpc);
assert.ok(rc439.includes("client_secret_ciphertext"), "RC439 encrypted checkout storage must be present");
assert.match(rc425, /alter table public\.mantigo_payment_provider_events enable row level security;/);
assert.match(rc425, /alter table public\.mantigo_payment_provider_events force row level security;/);
assert.match(rc425, /set search_path = ''/);
assert.match(rc425, /grant execute on function public\.process_verified_mantigo_payment_backend[\s\S]*to service_role;/);
console.log("RC425-RC439 payment migration wiring contract: PASS");
