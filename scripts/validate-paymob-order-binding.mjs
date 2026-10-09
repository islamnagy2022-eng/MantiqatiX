import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const webhook = read("supabase/functions/paymob-webhook/index.ts");
const orderPayment = read("supabase/functions/payment-intent/index.ts");
const ridePayment = read("supabase/functions/mantigo-payment-intent/index.ts");
const digitalPayment = read("supabase/functions/digital-page-payment-intent/index.ts");
const digitalMigration = read("supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql");
const rideMigration = read("supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql");
const digitalFinalizeMigration = read("supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql");
const activeIntentMigration = read("supabase/migrations/20261009140000_rc427_one_active_payment_intent_per_order.sql");
const workflow = read(".github/workflows/pages.yml");

const checks = [
  ["HMAC covers Paymob order.id", webhook.includes("order.id") && webhook.includes("obj.owner")],
  ["Normal checkout persists provider order ID", orderPayment.includes("provider_order_id: providerOrderId") && orderPayment.includes("!providerOrderId")],
  ["Normal webhook binds intent to signed provider order", webhook.includes("PAYMENT_PROVIDER_ORDER_MISMATCH") && webhook.includes('eq("provider_order_id",paymobOrderId)')],
  ["Normal webhook rejects a mismatched merchant reference", webhook.includes("PAYMENT_MERCHANT_REFERENCE_MISMATCH")],
  ["Subscription webhook rejects a mismatched merchant reference", webhook.includes("SUBSCRIPTION_MERCHANT_REFERENCE_MISMATCH")],
  ["Digital-page webhook rejects a mismatched merchant reference", webhook.includes("DIGITAL_PAGE_MERCHANT_REFERENCE_MISMATCH")],
  ["MantiGo refuses to reuse an intent without stored order correlation", ridePayment.includes("PAYMENT_INTENT_REQUIRES_RESTART")],
  ["Digital-page finalizer fails closed when provider correlation is absent", digitalFinalizeMigration.includes("PAYMOB_PROVIDER_CORRELATION_REQUIRED")],
  ["Digital-page payment RPC uses an empty search path", digitalMigration.includes("set search_path = ''")],
  ["Subscription webhook binds intent to signed provider order", webhook.includes("SUBSCRIPTION_PROVIDER_ORDER_MISMATCH") && webhook.includes("sub.provider_order_id")],
  ["Digital checkout requires provider order ID", digitalPayment.includes("!providerOrderId")],
  ["Digital checkout persists provider order ID through five-argument RPC", digitalPayment.includes("p_provider_order_id:providerOrderId") && digitalFinalizeMigration.includes("p_provider_order_id text")],
  ["Digital webhook rejects a mismatched provider order", webhook.includes("DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH") && digitalMigration.includes("v_order.provider_order_id <> p_provider_order_id")],
  ["MantiGo checkout requires and stores provider order ID", ridePayment.includes("!providerOrderId") && ridePayment.includes("paymob_intention_order_id:providerOrderId")],
  ["MantiGo RPC binds merchant reference to ledger", rideMigration.includes("p_raw_payload->>'merchant_order_id' is distinct from p_ledger_id")],
  ["MantiGo RPC binds signed provider order to persisted intention order", rideMigration.includes("metadata->>'paymob_intention_order_id'")],
  ["RC426 revokes the legacy finalizer from authenticated", digitalFinalizeMigration.includes("revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from authenticated")],
  ["Active payment intent migration rejects pre-existing duplicates", activeIntentMigration.includes("RC427_DUPLICATE_ACTIVE_PAYMENT_INTENTS_REQUIRE_RECONCILIATION") && activeIntentMigration.includes("uq_payment_intents_one_active_per_order")],
  ["Payment endpoint refuses a second provider intention for a pending idempotent intent", orderPayment.includes("PAYMENT_INTENT_ALREADY_INITIALIZED") && orderPayment.includes('intent.idempotent === true')],
  ["Order-binding validator is part of CI", workflow.includes("node scripts/validate-paymob-order-binding.mjs")]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
if (failed.length) {
  console.error("Paymob order-binding contract failed: " + failed.map(([name]) => name).join("; "));
  process.exit(1);
}
console.log("Paymob signed-order binding contract: PASS (" + checks.length + " checks; source-only, no production mutations).");
