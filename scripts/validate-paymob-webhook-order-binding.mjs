import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const webhook = read("supabase/functions/paymob-webhook/index.ts");

const verifyStart = webhook.indexOf("async function verify(");
const verifyEnd = webhook.indexOf("Deno.serve(", verifyStart);
assert.ok(verifyStart >= 0 && verifyEnd > verifyStart, "Paymob HMAC verifier must exist before the request handler");
const verifier = webhook.slice(verifyStart, verifyEnd);
assert.ok(verifier.includes("order.id"), "Paymob provider order.id must be covered by HMAC");
assert.doesNotMatch(verifier, /merchant_order_id/, "merchant_order_id is an unsigned lookup hint and must never be treated as an HMAC-authenticated field");

const signatureCall = webhook.indexOf("verify(obj,order,source,value(raw.hmac??obj.hmac))");
const eventExtraction = webhook.indexOf("const eventId=");
const merchantReferenceExtraction = webhook.indexOf("const merchantRef=value(order.merchant_order_id)");
const signedOrderExtraction = webhook.indexOf("const paymobOrderId=value(order.id)");
assert.ok(signatureCall >= 0 && eventExtraction > signatureCall &&
  merchantReferenceExtraction > signatureCall && signedOrderExtraction > signatureCall,
  "HMAC verification must succeed before parsing the event into payment selectors");
assert.ok(merchantReferenceExtraction < signedOrderExtraction,
  "unsigned merchant reference and signed provider order ID must remain distinct values");

const branches = [
  {
    name: "subscription",
    lookup: 'const {data:subByRef}',
    selected: "const sub=subByRef??subByOrder",
    guard: 'if(!paymobOrderId||String(sub.provider_order_id??"")!==paymobOrderId)',
    mismatch: "SUBSCRIPTION_PROVIDER_ORDER_MISMATCH",
    successRpc: 'admin.rpc("process_verified_subscription_payment_backend"',
    failureRpc: 'admin.rpc("process_verified_subscription_payment_failure"',
  },
  {
    name: "digital-page",
    lookup: 'const {data:digitalByRef}',
    selected: "const digital=digitalByRef??digitalByOrder",
    guard: 'if(!paymobOrderId||String(digital.provider_order_id??"")!==paymobOrderId)',
    mismatch: "DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH",
    successRpc: 'admin.rpc("process_verified_digital_page_payment_backend"',
    failureRpc: null,
  },
  {
    name: "standard",
    lookup: 'const {data:intentByRef}',
    selected: "const intent=intentByRef??intentByOrder",
    guard: 'if(!paymobOrderId||String(intent.provider_order_id??"")!==paymobOrderId)',
    mismatch: "PAYMENT_PROVIDER_ORDER_MISMATCH",
    successRpc: 'admin.rpc("process_verified_provider_payment"',
    failureRpc: 'admin.rpc("process_verified_provider_payment_failure"',
  },
];

for (const branch of branches) {
  const lookup = webhook.indexOf(branch.lookup);
  const selected = webhook.indexOf(branch.selected, lookup);
  const guard = webhook.indexOf(branch.guard, selected);
  const mismatchResponse = webhook.indexOf(branch.mismatch, guard);
  const successRpc = webhook.indexOf(branch.successRpc, guard);
  const failureRpc = branch.failureRpc ? webhook.indexOf(branch.failureRpc, guard) : -1;

  assert.ok(lookup >= 0 && selected > lookup && guard > selected,
    branch.name + " lookup must be followed by selecting a candidate then validating its stored provider_order_id");
  assert.ok(mismatchResponse > guard,
    branch.name + " provider-order mismatch must have an explicit fail-closed response");
  assert.ok(successRpc > guard && (!branch.failureRpc || failureRpc > guard),
    branch.name + " success/failure processors must run only after stored provider-order equality is verified");

  const mismatchHandler = webhook.slice(guard, successRpc);
  assert.ok(mismatchHandler.includes("409"), branch.name + " provider-order mismatch must return HTTP 409");
}

console.log("Paymob signed provider-order binding (standard, digital-page, subscription): PASS");
