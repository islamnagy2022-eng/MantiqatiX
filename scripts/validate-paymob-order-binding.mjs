import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const webhook = read("supabase/functions/paymob-webhook/index.ts");
const orderPayment = read("supabase/functions/payment-intent/index.ts");
const ridePayment = read("supabase/functions/mantigo-payment-intent/index.ts");
const digitalPayment = read("supabase/functions/digital-page-payment-intent/index.ts");
const digitalMigration = read("supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql");
const digitalHardeningMigration = read("supabase/migrations/20261010170700_rc431_harden_deployed_digital_page_payment_rpc.sql");
const rideMigration = read("supabase/migrations/20261010170100_rc425_atomic_mantigo_paymob_payment.sql");
const digitalFinalizeMigration = read("supabase/migrations/20261010170200_rc426_digital_page_provider_order_binding.sql");
const activeIntentMigration = read("supabase/migrations/20261010170300_rc427_one_active_payment_intent_per_order.sql");
const failureMigration = read("supabase/migrations/20261010170400_rc428_atomic_provider_failure_webhook.sql");
const subscriptionFailureMigration = read("supabase/migrations/20261010170500_rc429_atomic_subscription_failure_webhook.sql");
const subscriptionSuccessMigration = read("supabase/migrations/20261010170600_rc430_atomic_subscription_success_webhook.sql");
const failureStart = webhook.indexOf('if(!success){\n   const {data:failureResult,error:failureError}=await admin.rpc("process_verified_provider_payment_failure"');
const failureEnd = failureStart < 0 ? -1 : webhook.indexOf('const {data:processed,error:e}=await admin.rpc("process_verified_provider_payment"', failureStart);
const normalFailureBlock = failureStart >= 0 && failureEnd > failureStart ? webhook.slice(failureStart, failureEnd) : "";
const workflow = read(".github/workflows/payment-hardening.yml");
const subscriptionBlockStart = webhook.indexOf("const sub=subByRef??subByOrder");
const subscriptionMutationStart = webhook.indexOf('admin.rpc("process_verified_subscription_payment_failure"', subscriptionBlockStart);
const digitalBlockStart = webhook.indexOf("const digital=digitalByRef??digitalByOrder");
const digitalMutationStart = webhook.indexOf('admin.rpc("process_verified_digital_page_payment_backend"', digitalBlockStart);

const checks = [
  ["HMAC covers Paymob order.id", webhook.includes("order.id") && webhook.includes("obj.owner")],
  ["Normal checkout persists provider order ID", orderPayment.includes("provider_order_id: providerOrderId") && orderPayment.includes("!providerOrderId")],
  ["Normal Paymob network ambiguity preserves the active intent for reconciliation", orderPayment.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN") && orderPayment.includes("outcome: \"UNKNOWN\"") && orderPayment.includes("Keep the DB intent active")],
  ["Normal Paymob checkout marks an intent FAILED only after explicit HTTP 4xx rejection", orderPayment.includes("response.status >= 400 && response.status < 500") && orderPayment.includes("PAYMENT_PROVIDER_REJECTED") && orderPayment.includes("persist_definitive_provider_rejection")],
  ["Normal Paymob 5xx or incomplete responses do not release the active intent", orderPayment.includes("HTTP 5xx, malformed JSON, or missing provider identifiers are ambiguous") && orderPayment.includes("reconciliationRequired: true") && orderPayment.indexOf("if (response.status >= 400 && response.status < 500)") < orderPayment.indexOf("if (!response.ok || !provider?.id || !provider?.client_secret || !providerOrderId)") && !orderPayment.slice(orderPayment.indexOf("if (!response.ok || !provider?.id || !provider?.client_secret || !providerOrderId)")).includes("update({ status: \"FAILED\"")],
  ["Normal provider-intent persistence checks the state transition and affected row", orderPayment.includes('.eq("status", "CREATED").is("provider_intent_id", null)') && orderPayment.includes('.select("id").maybeSingle()') && orderPayment.includes("PAYMENT_INTENT_PERSISTENCE_UNKNOWN")],
  ["Normal webhook binds intent to signed provider order", webhook.includes("PAYMENT_PROVIDER_ORDER_MISMATCH") && webhook.includes('eq("provider_order_id",paymobOrderId)')],
  ["Normal failure and success callbacks do not short-circuit replay validation", !webhook.includes('admin.from("payment_provider_events").select("id,payment_intent_id").eq("provider","PAYMOB").eq("external_event_id",eventId).maybeSingle();if(existing)return json({ok:true,idempotent:true,requestId},200,requestId)')],
  ["Subscription success webhook uses the hardened atomic backend RPC", webhook.includes('admin.rpc("process_verified_subscription_payment_backend"') && webhook.includes("p_provider_order_id:paymobOrderId") && webhook.includes("p_raw_payload:raw")],
  ["Subscription success no longer calls the legacy unbound RPC", !webhook.includes('admin.rpc("process_verified_subscription_payment"')],
  ["RC430 binds success replay to subscription intent/order/transaction", subscriptionSuccessMigration.includes("SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH") && subscriptionSuccessMigration.includes("subscription_payment_intent_id") && subscriptionSuccessMigration.includes("provider_order_id") && subscriptionSuccessMigration.includes("provider_transaction_id")],
  ["RC430 atomically records success before subscription activation", subscriptionSuccessMigration.includes("insert into public.payment_provider_events") && subscriptionSuccessMigration.includes("update public.subscription_payment_intents") && subscriptionSuccessMigration.includes("for update")],
  ["RC430 is service-role-only with empty search path", subscriptionSuccessMigration.includes("set search_path = ''") && subscriptionSuccessMigration.includes("revoke all on function public.process_verified_subscription_payment_backend") && subscriptionSuccessMigration.includes("to service_role;")],
  ["Subscription failure webhook uses the atomic failure RPC", webhook.includes('admin.rpc("process_verified_subscription_payment_failure"') && webhook.includes("p_provider_order_id:paymobOrderId") && webhook.includes("p_subscription_payment_intent_id:sub.id")],
  ["Subscription failure path no longer updates the intent directly", !webhook.includes('admin.from("subscription_payment_intents").update({status:"FAILED"')],
  ["RC429 binds subscription failure event to intent, provider order, and transaction", subscriptionFailureMigration.includes("SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH") && subscriptionFailureMigration.includes("subscription_payment_intent_id") && subscriptionFailureMigration.includes("provider_order_id") && subscriptionFailureMigration.includes("provider_transaction_id")],
  ["RC429 atomically records subscription failure and transitions state", subscriptionFailureMigration.includes("insert into public.payment_provider_events") && subscriptionFailureMigration.includes("update public.subscription_payment_intents") && subscriptionFailureMigration.includes("for update")],
  ["RC429 is service-role-only with empty search path", subscriptionFailureMigration.includes("set search_path = ''") && subscriptionFailureMigration.includes("revoke all on function public.process_verified_subscription_payment_failure") && subscriptionFailureMigration.includes("to service_role;")],
  ["Normal payment failure webhook uses the atomic backend RPC", normalFailureBlock.includes('admin.rpc("process_verified_provider_payment_failure"') && normalFailureBlock.includes("p_provider_order_id:paymobOrderId") && normalFailureBlock.includes("p_provider_transaction_id:value(obj.id)")],
  ["Normal payment failure webhook contains no split event or intent writes", normalFailureBlock.length > 0 && !normalFailureBlock.includes('admin.from("payment_provider_events").insert(') && !normalFailureBlock.includes('admin.from("payment_intents").update(')],
  ["RC428 failure RPC is service-role-only with an empty search path", failureMigration.includes("set search_path = ''") && failureMigration.includes("revoke all on function public.process_verified_provider_payment_failure") && failureMigration.includes("to service_role;")],
  ["Normal webhook rejects a mismatched merchant reference", webhook.includes("PAYMENT_MERCHANT_REFERENCE_MISMATCH")],
  ["Subscription webhook rejects a mismatched merchant reference", webhook.includes("SUBSCRIPTION_MERCHANT_REFERENCE_MISMATCH")],
  ["Digital-page webhook rejects a mismatched merchant reference", webhook.includes("DIGITAL_PAGE_MERCHANT_REFERENCE_MISMATCH")],
  ["MantiGo refuses to reuse an intent without stored order correlation", ridePayment.includes("PAYMENT_INTENT_REQUIRES_RESTART")],
  ["Digital-page finalizer fails closed when provider correlation is absent", digitalFinalizeMigration.includes("PAYMOB_PROVIDER_CORRELATION_REQUIRED")],
  ["RC431 digital-page payment RPC uses an empty search path", digitalHardeningMigration.includes("set search_path = ''")],
  ["RC431 hardens the already-deployed digital payment RPC", digitalHardeningMigration.includes("RC431") && digitalHardeningMigration.includes("set search_path = ''")],
  ["RC431 validates stored provider-order binding", digitalHardeningMigration.includes("v_order.provider_order_id <> p_provider_order_id")],
  ["RC431 rejects NULL status and conflicting replay status", digitalHardeningMigration.includes("if p_status is null or p_status not in ('SUCCEEDED', 'FAILED')") && digitalHardeningMigration.includes("DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH")],
  ["RC431 digital-page payment RPC rejects a null status", digitalHardeningMigration.includes("if p_status is null or p_status not in ('SUCCEEDED', 'FAILED')")],
  ["RC431 digital-page callback rejects conflicting status on replay", digitalHardeningMigration.includes("DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH") && digitalHardeningMigration.includes("v_event.status is distinct from p_status")],
  ["Subscription webhook binds intent to signed provider order", webhook.includes("SUBSCRIPTION_PROVIDER_ORDER_MISMATCH") && webhook.includes("sub.provider_order_id")],
  ["Subscription callback arriving before provider-order persistence is retryable", webhook.includes("SUBSCRIPTION_PROVIDER_CORRELATION_PENDING") && webhook.includes("retryable:true") && webhook.includes('sub.status==="PENDING"')],
  ["Normal payment callback arriving before provider-order persistence is retryable", webhook.includes("PAYMENT_PROVIDER_CORRELATION_PENDING") && webhook.includes("retryable:true") && webhook.includes('intent.status==="CREATED"')],
  ["Digital checkout requires provider order ID", digitalPayment.includes("!providerOrderId")],
  ["Digital Paymob network ambiguity does not release the intention claim", digitalPayment.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN") && digitalPayment.includes("The provider may have created an intention") && !digitalPayment.includes('catch{await release();return json({error:"PAYMENT_PROVIDER_UNAVAILABLE"}') ],
  ["Digital Paymob incomplete or 5xx responses retain the claim for reconciliation", digitalPayment.includes("reconciliationRequired:true") && digitalPayment.includes("retain the claim for reconciliation")],
  ["Digital Paymob claim is released only for explicit 4xx rejection", digitalPayment.includes("providerResponseStatus>=400&&providerResponseStatus<500") && digitalPayment.includes("await release();")],
  ["Digital checkout persists provider order ID through five-argument RPC", digitalPayment.includes("p_provider_order_id:providerOrderId") && digitalFinalizeMigration.includes("p_provider_order_id text")],
  ["Digital webhook rejects a mismatched provider order", webhook.includes("DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH") && digitalHardeningMigration.includes("v_order.provider_order_id <> p_provider_order_id")],
  ["Digital provider-order and merchant-reference binding run before payment mutation", digitalBlockStart >= 0 && digitalMutationStart > digitalBlockStart && webhook.indexOf("DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH", digitalBlockStart) < digitalMutationStart && webhook.slice(digitalBlockStart, digitalMutationStart).includes("String(digital.provider_order_id)!==paymobOrderId") && webhook.slice(digitalBlockStart, digitalMutationStart).includes("DIGITAL_PAGE_MERCHANT_REFERENCE_MISMATCH")],
  ["Subscription provider-order and merchant-reference binding run before payment mutation", subscriptionBlockStart >= 0 && subscriptionMutationStart > subscriptionBlockStart && webhook.indexOf("SUBSCRIPTION_PROVIDER_ORDER_MISMATCH", subscriptionBlockStart) < subscriptionMutationStart && webhook.slice(subscriptionBlockStart, subscriptionMutationStart).includes("String(sub.provider_order_id)!==paymobOrderId") && webhook.slice(subscriptionBlockStart, subscriptionMutationStart).includes("SUBSCRIPTION_MERCHANT_REFERENCE_MISMATCH")],
  ["Digital webhook returns retryable status while a claimed intent lacks provider-order persistence", webhook.includes("DIGITAL_PAGE_PROVIDER_CORRELATION_PENDING") && webhook.includes("retryable:true") && webhook.includes('payment_status,provider_order_id,metadata')],
  ["MantiGo claims the ledger before creating a Paymob intention", ridePayment.indexOf("paymob_intention_claim:requestId") > 0 && ridePayment.indexOf("paymob_intention_claim:requestId") < ridePayment.indexOf('fetch("https://accept.paymob.com/v1/intention/"')],
  ["MantiGo intention persistence must own the claim token", ridePayment.includes('.filter("metadata->>paymob_intention_claim","eq",requestId)')],
  ["MantiGo refuses retrying a pending ledger without a stored intention", ridePayment.includes('if(String(ledger.payment_status)==="PENDING")return json({error:"PAYMENT_INTENT_REQUIRES_RESTART"},409,requestId)')],
  ["MantiGo intent persistence checks the affected ledger row", ridePayment.includes(".select(\"id\").maybeSingle()") && ridePayment.includes("!updatedLedger")],
  ["MantiGo intent persistence is compare-and-set to avoid overwriting a concurrent intent", ridePayment.includes('.eq("payment_status","REQUIRED").is("provider_intent_id",null)')],
  ["MantiGo checkout requires and stores provider order ID", ridePayment.includes("!providerOrderId") && ridePayment.includes("paymob_intention_order_id:providerOrderId")],
  ["MantiGo RPC binds merchant reference to ledger", rideMigration.includes("p_raw_payload->>'merchant_order_id' is distinct from p_ledger_id")],
  ["MantiGo provider-order correlation is checked against the locked ledger row", rideMigration.includes("p_raw_payload->>'provider_order_id' is distinct from coalesce(v_ledger.metadata->>'paymob_intention_order_id', '')") && rideMigration.indexOf("for update") < rideMigration.indexOf("p_raw_payload->>'provider_order_id' is distinct from coalesce(v_ledger.metadata->>'paymob_intention_order_id', '')")],
  ["MantiGo RPC binds signed provider order to persisted intention order", rideMigration.includes("metadata->>'paymob_intention_order_id'")],
  ["RC426 revokes the legacy finalizer from authenticated", digitalFinalizeMigration.includes("revoke all on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text) from authenticated")],
  ["Active payment intent migration rejects pre-existing duplicates", activeIntentMigration.includes("RC427_DUPLICATE_ACTIVE_PAYMENT_INTENTS_REQUIRE_RECONCILIATION") && activeIntentMigration.includes("uq_payment_intents_one_active_per_order")],
  ["Payment endpoint refuses a second provider intention for a pending idempotent intent", orderPayment.includes("PAYMENT_INTENT_ALREADY_INITIALIZED") && orderPayment.includes('intent.idempotent === true') && orderPayment.includes('["CREATED", "PENDING", "SUCCEEDED"]')],
  ["Order-binding validator is part of CI", workflow.includes("node scripts/validate-paymob-order-binding.mjs")]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
if (failed.length) {
  console.error("Paymob order-binding contract failed: " + failed.map(([name]) => name).join("; "));
  process.exit(1);
}
console.log("Paymob signed-order binding contract: PASS (" + checks.length + " checks; source-only, no production mutations).");
