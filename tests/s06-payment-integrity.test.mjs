import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const payment = read("supabase/functions/payment-intent/index.ts");
const webhook = read("supabase/functions/paymob-webhook/index.ts");
const digital = read("supabase/functions/digital-page-payment-intent/index.ts");

test("S06-01 payment intent requires authenticated non-anonymous user", () => {
  assert.match(payment, /admin\.auth\.getUser\(token\)/);
  assert.match(payment, /user\.is_anonymous/);
});
test("S06-02 payment intent requires order and bounded idempotency key", () => {
  assert.match(payment, /const orderId = String\(body\.orderId/);\n  assert.match(payment, /const idempotencyKey = String\(body\.idempotencyKey/);
  assert.match(payment, /idempotencyKey\.length > 200/);
  assert.match(payment, /create_payment_intent_backend/);
});
test("S06-03 payment amount is sourced from authoritative order and backend intent", () => {
  assert.match(payment, /p_amount:\s*order\.total/);
  assert.match(payment, /intent\.amount/);
  assert.match(payment, /order\.total_amount/);
  assert.match(payment, /Authoritative pricing changed/);
});
test("S06-04 payment rejects unavailable pricing authority and non-payable order states", () => {
  assert.match(payment, /pricing_hash.*pricing_version.*pricing_authority/);
  assert.match(payment, /PENDING.*CREATED/);
  assert.match(payment, /Order is not payable/);
});
test("S06-05 payment validates currency through authoritative order and persists provider reference", () => {
  assert.match(payment, /currency:\s*String\(order\.currency/);
  assert.match(payment, /provider_intent_id:\s*String\(provider\.id\)/);
});
test("S06-06 provider webhook verifies HMAC before financial processing", () => {
  assert.match(webhook, /HMAC_SECRET/);
  assert.match(webhook, /hmacSha512Hex/);
  assert.match(webhook, /safeEqual/);
  assert.ok(webhook.indexOf("verify(obj,order,source") < webhook.indexOf("process_verified_provider_payment"));
});
test("S06-07 webhook rejects invalid signatures before processing", () => {
  assert.match(webhook, /INVALID_PROVIDER_SIGNATURE/);
  assert.match(webhook, /return json\(\{error:"INVALID_PROVIDER_SIGNATURE"/);
});
test("S06-08 webhook checks event identity and amount/currency against intent", () => {
  assert.match(webhook, /const eventId=`paymob:\$\{value\(obj\.id\)\}`/);
  assert.match(webhook, /PAYMENT_AMOUNT_CURRENCY_MISMATCH/);
  assert.match(webhook, /external_event_id.*eventId/s);
});
test("S06-09 normal payment processing delegates to verified backend RPC", () => {
  assert.match(webhook, /process_verified_provider_payment/);
  assert.match(webhook, /p_signature_verified:true/);
});
test("S06-10 digital-page flow claims idempotency before provider call and handles in-progress race", () => {
  assert.match(digital, /claim_digital_page_payment_intent_backend/);
  assert.match(digital, /PAYMENT_INTENT_IN_PROGRESS/);
  assert.ok(digital.indexOf("claim_digital_page_payment_intent_backend") < digital.indexOf('fetch(PAYMOB_BASE_URL'));
});
test("S06-11 digital-page provider failure releases claim", () => {
  assert.match(digital, /release_digital_page_payment_intent_claim_backend/);
  assert.match(digital, /PAYMENT_PROVIDER_REJECTED/);
  assert.match(digital, /PAYMENT_PROVIDER_UNAVAILABLE/);
});
test("S06-12 digital-page provider intent is finalized via backend RPC", () => {
  assert.match(digital, /finalize_digital_page_payment_intent_backend/);
  assert.match(digital, /PAYMENT_PERSISTENCE_FAILED/);
});
