import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const webhook = read("supabase/functions/paymob-webhook/index.ts");
const paymentIntent = read("supabase/functions/payment-intent/index.ts");
const digitalIntent = read("supabase/functions/digital-page-payment-intent/index.ts");
const subscriptionIntent = read("supabase/functions/subscription-payment-intent/index.ts");
const mantigoIntent = read("supabase/functions/mantigo-payment-intent/index.ts");
const rc425 = read("supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql");
const rc426 = read("supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql");
const rc428 = read("supabase/migrations/20261009150000_rc428_atomic_provider_failure_webhook.sql");
const rc429 = read("supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql");
const rc430 = read("supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql");
const rc431 = read("supabase/migrations/20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql");
const rc435 = read("supabase/migrations/20261009210000_rc435_subscription_provider_intent_claim.sql");
const rc439 = read("supabase/migrations/20261010010000_rc439_encrypted_checkout_recovery.sql");
const rc459 = read("supabase/migrations/20261025010000_rc459_exact_cent_payment_rpcs.sql");

const mStart = webhook.indexOf('const {data:mantigo}=await admin.from("mantigo_financial_ledger")');
const mEnd = webhook.indexOf('const {data:intentByRef}=await admin.from("payment_intents")', mStart);
assert.ok(mStart >= 0 && mEnd > mStart, "MantiGo Paymob block must have explicit boundaries");
const mantigoBlock = webhook.slice(mStart, mEnd);
const signatureCheck = webhook.indexOf("verify(obj,order,source,value(raw.hmac??obj.hmac))");
assert.ok(signatureCheck >= 0 && signatureCheck < mStart, "Paymob HMAC verification must happen before payment processing");
assert.ok(webhook.includes('Deno.env.get("PAYMOB_INTEGRATION_ID")') && webhook.includes("UNEXPECTED_PROVIDER_INTEGRATION") && webhook.indexOf("UNEXPECTED_PROVIDER_INTEGRATION") > signatureCheck, "Paymob callback must be bound to the configured integration after HMAC verification");

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

assert.ok(mantigoIntent.includes('from "../_shared/paymob-intent-correlation.mjs"'), "MantiGo payment intent must use shared Paymob correlation checks");
assert.ok(mantigoIntent.includes("isValidPaymobAmountCents(amount,amountCents)"), "MantiGo payment must reject fractional-cent amounts before provider I/O");
assert.ok(mantigoIntent.includes("PAYMENT_INTENT_REQUIRES_RECONCILIATION"), "MantiGo ambiguous provider outcomes must fail closed and block blind retries");
assert.ok(mantigoIntent.includes("matchesPaymobIntention({provider,amountCents,currency,reference:ledger.id})"), "MantiGo provider intention must be bound to exact amount/currency/ledger reference");
assert.ok(mantigoIntent.includes("paymob_intention_order_id:providerOrderId"), "MantiGo must persist the verified provider order ID");
assert.ok(mantigoIntent.includes('.eq("payment_status","REQUIRED").select("id").maybeSingle()') && mantigoIntent.includes("if(updateError||!updated)"), "MantiGo must detect a lost compare-and-set persistence race");
assert.equal((mantigoIntent.match(/\.eq\("payment_status","REQUIRED"\)\.select\("id"\)\.maybeSingle\(\)/g)||[]).length,3,"MantiGo success persistence and both ambiguous-outcome holds must use compare-and-set row confirmation");
assert.ok((mantigoIntent.match(/if\(holdError\|\|!held\)/g)||[]).length===2,"MantiGo ambiguous-outcome holds must detect a zero-row compare-and-set race");
assert.ok(mantigoIntent.includes('String(ledger.payment_status)==="PENDING"') && mantigoIntent.includes("PAYMENT_INTENT_REQUIRES_RECONCILIATION"), "MantiGo must not create duplicate provider intentions from an unresolved pending state");

assert.ok(paymentIntent.includes("provider_order_id: providerOrderId"), "normal payment intent must persist Paymob order correlation");
assert.ok(paymentIntent.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN"), "ambiguous Paymob creation outcomes must fail closed for reconciliation");
assert.ok(paymentIntent.includes('.select("id").maybeSingle()') && paymentIntent.includes('updateError?.code ?? "COMPARE_AND_SET_NO_ROW"') && paymentIntent.includes("PAYMENT_INTENT_REQUIRES_RECONCILIATION"), "normal payment must detect a zero-row provider intent persistence race and fail closed");
assert.ok(paymentIntent.includes('.eq("id", paymentIntentId).eq("pricing_hash", pricingHash).eq("pricing_version", pricingVersion).eq("status", "CREATED").select("id").maybeSingle()'), "normal payment status finalization must confirm its pricing-bound compare-and-set row");
assert.ok((paymentIntent.match(/if \((?:holdError|failError) \|\| !(?:held|failed)\)/g) || []).length === 4, "normal payment ambiguous holds and explicit provider rejection must fail closed on all ambiguous holds and explicit provider rejection zero-row races");
assert.ok(paymentIntent.includes("[400, 401, 403, 404, 422].includes(response.status)") && paymentIntent.includes("!providerIntentId && !providerClientSecret && !providerOrderId"), "normal payment may mark FAILED only for explicit identifier-free provider rejections");
assert.ok(digitalIntent.includes("[400,401,403,404,422].includes(providerResponseStatus)") && digitalIntent.includes("!providerIntentId&&!providerClientSecret&&!providerOrderId"), "digital-page payment may release a claim only for explicit identifier-free provider rejections");
assert.ok(paymentIntent.includes('from "../_shared/paymob-intent-correlation.mjs"'), "normal payment provider response must use the shared Paymob correlation guard");
assert.ok(paymentIntent.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "normal payment provider mismatch must fail closed");
assert.ok(paymentIntent.indexOf("isValidPaymobAmountCents(amount, amountCents)") < paymentIntent.indexOf('fetch("https://accept.paymob.com/v1/intention/"'), "normal payment amount precision must be checked before provider network I/O");
assert.ok(paymentIntent.includes("matchesCurrencyAmounts(amount, order.total_amount)") && paymentIntent.includes("matchesCurrencyAmounts(amount, order.total)") && paymentIntent.includes("matchesCurrencyAmounts } from"), "normal payment order pricing must match exactly to the cent");
assert.doesNotMatch(paymentIntent, /Math\.abs\(amount - Number\(order\.total(?:_amount)?\)\) > 0\.01/, "normal payment pricing must not tolerate a one-cent mismatch");
assert.ok(paymentIntent.indexOf("const providerCorrelationMatches = matchesPaymobIntention({") >= 0 && paymentIntent.indexOf("const providerCorrelationMatches = matchesPaymobIntention({") < paymentIntent.indexOf('admin.from("payment_intents").update({'), "normal payment response correlation must precede provider ID persistence");
assert.ok(digitalIntent.includes("p_provider_order_id:providerOrderId"), "digital-page intent finalization must persist provider order correlation");
assert.ok(digitalIntent.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN"), "digital-page provider ambiguity must not be blindly retried");
assert.ok(digitalIntent.includes('from "../_shared/paymob-intent-correlation.mjs"') && digitalIntent.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "digital-page Paymob response must be correlated and mismatches must fail closed");
assert.ok(digitalIntent.indexOf("isValidPaymobAmountCents(amount,amountCents)") < digitalIntent.indexOf('"/v1/intention/"'), "digital-page exact-cent validation must run before provider network I/O");
assert.ok(digitalIntent.indexOf("if(!matchesPaymobIntention(") >= 0 && digitalIntent.indexOf("if(!matchesPaymobIntention(") < digitalIntent.indexOf('userClient.rpc("finalize_digital_page_payment_intent_backend"'), "digital-page response correlation must precede trusted finalization");
assert.ok(digitalIntent.includes("return !error&&data===true") && digitalIntent.includes("PAYMENT_REJECTION_REQUIRES_RECONCILIATION"), "digital-page claim release must be verified and fail closed if it fails");
assert.ok(subscriptionIntent.includes('rpc("create_subscription_payment_intent_claimable_backend"'), "subscription flow must use the claimable intent RPC");
assert.ok(subscriptionIntent.includes('rpc("claim_subscription_provider_intent_creation_backend"'), "subscription provider creation must be claimed atomically");
assert.ok(subscriptionIntent.includes('from "../_shared/paymob-intent-correlation.mjs"'), "subscription provider response must use the shared Paymob correlation guard");
assert.ok(subscriptionIntent.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "subscription provider mismatch must fail closed for reconciliation");
assert.ok(subscriptionIntent.indexOf("if (!matchesPaymobIntention({") >= 0 && subscriptionIntent.indexOf("if (!matchesPaymobIntention({") < subscriptionIntent.indexOf("const { data: updated, error: updateError }"), "subscription amount/currency/reference must be verified before provider IDs and checkout secret are persisted");
assert.ok(subscriptionIntent.includes("provider_creation_state: \"CORRELATED\""), "subscription provider correlation state must be persisted");
assert.ok(subscriptionIntent.includes("stage:\"encrypt_checkout_secret\"") && subscriptionIntent.includes("provider_creation_state:\"RECONCILIATION_REQUIRED\""), "checkout encryption failure must enter reconciliation state");
assert.ok(subscriptionIntent.includes("provider_intent_id:providerIntentId,provider_order_id:providerOrderId,provider_creation_state:\"RECONCILIATION_REQUIRED\""), "checkout encryption failure must retain provider correlation identifiers for reconciliation");

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
assert.ok(subscriptionIntent.includes("encryptCheckoutSecretPayload"), "subscription checkout secrets must be encrypted before persistence");
assert.ok(subscriptionIntent.includes("PAYMOB_CHECKOUT_ENCRYPTION_KEY_"), "subscription checkout encryption key must come from server-side secrets");
assert.ok(subscriptionIntent.indexOf("try{await checkoutCryptoKey();}") >= 0 && subscriptionIntent.indexOf("try{await checkoutCryptoKey();}") < subscriptionIntent.indexOf('rpc("create_subscription_payment_intent_claimable_backend"'), "subscription encryption key material must be validated before intent creation or provider network I/O");
assert.ok(webhook.includes("SUBSCRIPTION_PROVIDER_ORDER_MISMATCH") && webhook.includes("DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH"), "subscription and digital-page webhooks must enforce exact Paymob provider-order binding");
assert.ok(webhook.includes('import { matchesPaymobAmountCents, matchesPaymobEventOutcome, matchesPaymobSubscriptionEventType } from "../_shared/paymob-intent-correlation.mjs"') && (webhook.match(/matchesPaymobAmountCents\((?:sub\.amount|digital\.amount|mantigo\.gross_amount|intent\.amount),obj\.amount_cents\)/g)||[]).length===4, "all Paymob webhook payment families must use the shared exact-cent correlation guard");
assert.doesNotMatch(webhook, /Math\.abs\(Number\((?:sub\.amount|digital\.amount|mantigo\.gross_amount|intent\.amount)\)-amount\)>0\.01/, "Paymob webhook correlation must not allow a one-cent amount discrepancy");
assert.ok(webhook.includes('select("id,payment_intent_id,status")') && webhook.includes("PAYMENT_EVENT_INTENT_MISMATCH") && webhook.includes('String(existing.payment_intent_id??"")!==String(intent.id)'), "normal-payment webhook replay must not be acknowledged against a different payment intent");
assert.ok(webhook.includes('select("id,payment_intent_id,status")') && webhook.includes("matchesPaymobEventOutcome(existing.status,success)") && webhook.includes("PAYMENT_EVENT_OUTCOME_CONFLICT"), "normal payment webhook replay must reject contradictory success/failure outcomes");
assert.ok(webhook.includes("existingIntentId!==String(sub.id)||existingOrderId!==paymobOrderId||existingTransactionId!==value(obj.id)") && webhook.includes("SUBSCRIPTION_EVENT_CORRELATION_MISMATCH"), "subscription webhook replay must match original intent, provider order, and transaction");
assert.ok(webhook.includes("subscription_payment_intent_id:sub.id,provider_transaction_id:value(obj.id)") && webhook.includes("existingPayload.subscription_payment_intent_id") && webhook.includes("existingPayload.provider_transaction_id"), "subscription event payload must persist the exact keys used by replay correlation");
assert.ok(webhook.includes("existingPayload.subscription_payment_intent_id??existingPayload.merchant_order_id") && webhook.includes("existingPayload.provider_transaction_id??existingPayload.transaction_id"), "subscription replay correlation must remain compatible with previously stored payload key names");
assert.ok(webhook.includes('select("id,event_type,raw_payload")') && webhook.includes("matchesPaymobSubscriptionEventType(existing.event_type,success)") && webhook.includes("SUBSCRIPTION_EVENT_TYPE_CONFLICT"), "subscription webhook replay must reject conflicting success/failure event types");
assert.ok(subscriptionIntent.includes("client_secret_ciphertext"), "subscription checkout secret persistence must use ciphertext fields");
assert.match(rc425, /alter table public\.mantigo_payment_provider_events enable row level security;/);
assert.match(rc425, /alter table public\.mantigo_payment_provider_events force row level security;/);
assert.match(rc425, /set search_path = ''/);
assert.match(rc425, /grant execute on function public\.process_verified_mantigo_payment_backend[\s\S]*to service_role;/);

for (const [label, rpc] of [
  ["RC459 MantiGo", "process_verified_mantigo_payment_backend"],
  ["RC459 regular payment failure", "process_verified_provider_payment_failure"],
  ["RC459 subscription failure", "process_verified_subscription_payment_failure"],
  ["RC459 subscription success", "process_verified_subscription_payment_backend"],
  ["RC459 digital page", "process_verified_digital_page_payment_backend"],
  ["RC459 payment intent creation", "create_payment_intent_backend"]
]) assert.ok(rc459.includes("create or replace function public." + rpc), label + " must override the authoritative RPC with exact-cent validation");
assert.ok(rc459.includes("v_payload_amount is distinct from p_amount") && rc459.includes("v_ledger.gross_amount is distinct from p_amount"), "RC459 MantiGo RPC must reject any payload/ledger amount mismatch");
assert.ok(rc459.includes("v_intent.amount is distinct from v_order.total") && rc459.includes("v_intent.amount is distinct from v_order.total_amount") && rc459.includes("v_order.total_amount is distinct from v_order.total") && rc459.includes("p_provider_confirmed_amount is distinct from v_order.total_amount"), "RC459 provider failure RPC must require exact equality across both persisted order totals, intent amount, and provider amount");
assert.ok(rc459.includes("v_intent.amount is distinct from p_provider_confirmed_amount") && rc459.includes("v.amount is distinct from p_provider_confirmed_amount"), "RC459 subscription RPCs must compare persisted and provider amounts exactly");
assert.ok(rc459.includes("v_order.amount is distinct from p_amount"), "RC459 digital-page RPC must compare persisted and provider amounts exactly");
assert.ok(rc459.includes("v_ledger.currency is null or upper(v_ledger.currency) is distinct from upper(p_currency)") && rc459.includes("v_order.currency is null or upper(v_order.currency) is distinct from upper(p_currency)"), "RC459 MantiGo and digital-page RPCs must fail closed on missing or mismatched persisted currency");

for (const rpc of [
  "process_verified_mantigo_payment_backend",
  "process_verified_provider_payment_failure",
  "process_verified_subscription_payment_failure",
  "process_verified_subscription_payment_backend",
  "process_verified_digital_page_payment_backend"
]) {
  const start = rc459.indexOf("create or replace function public." + rpc);
  const end = start < 0 ? -1 : rc459.indexOf("$function$;", start);
  assert.ok(start >= 0 && end > start, rpc + " must have a complete RC459 function body");
  const body = rc459.slice(start, end);
  assert.ok(body.toLowerCase().includes("security definer") && body.toLowerCase().includes("set search_path = ''"), rpc + " must remain SECURITY DEFINER with an empty search_path");
}
assert.ok(rc459.includes("v_payload_amount is distinct from p_amount") && rc459.includes("round(p_amount, 2)"), "RC459 must reject fractional-cent MantiGo payload values");
assert.ok(rc459.includes("p_provider_confirmed_amount is distinct from round(p_provider_confirmed_amount, 2)"), "RC459 must reject fractional-cent provider-confirmed values");

const intentRpcStart = rc459.indexOf("create or replace function public.create_payment_intent_backend");
const intentRpcEnd = intentRpcStart < 0 ? -1 : rc459.indexOf("$function$;", intentRpcStart);
assert.ok(intentRpcStart >= 0 && intentRpcEnd > intentRpcStart, "RC459 payment intent creation RPC must have a complete override body");
const intentRpc = rc459.slice(intentRpcStart, intentRpcEnd);
assert.ok(intentRpc.includes("p_amount is distinct from v_order.total_amount") && intentRpc.includes("p_amount is distinct from v_order.total"), "RC459 payment intent creation must require exact equality with both persisted order totals");

assert.ok(intentRpc.toLowerCase().includes("security definer") && intentRpc.toLowerCase().includes("set search_path = public, pg_temp"), "RC459 payment intent creation must preserve SECURITY DEFINER and the hardened RC336 search_path");
assert.ok(!/abs\s*\([^)]*(?:amount|gross_amount)[^)]*\)\s*>\s*0\.01/i.test(intentRpc), "RC459 payment intent creation must not retain one-cent amount tolerance");
assert.ok(intentRpc.includes("v_existing.amount is distinct from v_order.total_amount") && intentRpc.includes("set search_path = public, pg_temp"), "RC459 idempotency replay must compare exact persisted amount and preserve RC336 search_path hardening");

assert.ok(intentRpc.includes("v_order.currency is null or upper(coalesce(p_currency,'')) is distinct from upper(v_order.currency)") && intentRpc.includes("v_existing.pricing_hash is distinct from v_order.pricing_hash"), "RC459 payment intent creation must fail closed on null currency and pricing replay mismatch");


assert.ok(!rc459.split("\n").some(line => /abs\(/.test(line) && /amount|gross_amount/i.test(line) && />\s*0\.01/i.test(line)), "RC459 must not preserve one-cent tolerance in authoritative payment RPCs");

console.log("RC425-RC459 payment migration wiring contract: PASS");
