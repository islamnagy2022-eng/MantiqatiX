import assert from "node:assert/strict";
import fs from "node:fs";

const normal = fs.readFileSync("supabase/functions/payment-intent/index.ts", "utf8");
const digital = fs.readFileSync("supabase/functions/digital-page-payment-intent/index.ts", "utf8");
const definitiveStatuses = [400, 401, 403, 404, 422];

const normalReject = normal.indexOf("if ([400, 401, 403, 404, 422].includes(response.status)");
const normalFailWrite = normal.indexOf('admin.from("payment_intents")', normalReject);
const normalUnknown = normal.indexOf("if (!response.ok || !provider?.id", normalReject);
assert.ok(normalReject >= 0 && normalFailWrite > normalReject, "normal payment must only mark definitive identifier-free provider rejection as FAILED");
assert.ok(normalUnknown > normalFailWrite, "non-definitive 4xx responses must fall through to the ambiguous outcome gate");
const normalRejectBlock = normal.slice(normalReject, normalUnknown);
assert.ok(normalRejectBlock.includes("!providerIntentId && !providerClientSecret && !providerOrderId"), "normal payment rejection must require absence of provider identifiers");
assert.ok(!normalRejectBlock.includes("response.status >= 400 && response.status < 500"), "normal payment must not treat all 4xx responses as definitive");

const digitalReject = digital.indexOf("if([400,401,403,404,422].includes(providerResponseStatus)");
const releaseIndex = digital.indexOf("await release()", digitalReject);
const digitalUnknown = digital.indexOf("if(providerResponseStatus<200||providerResponseStatus>=300", digitalReject);
assert.ok(digitalReject >= 0 && releaseIndex > digitalReject && digitalUnknown > releaseIndex, "digital-page claim release must be limited to definitive rejection statuses");
const digitalRejectBlock = digital.slice(digitalReject, digitalUnknown);
assert.ok(digitalRejectBlock.includes("!providerIntentId&&!providerClientSecret&&!providerOrderId"), "digital-page release must require absence of provider identifiers");
assert.ok(!digitalRejectBlock.includes("providerResponseStatus>=400&&providerResponseStatus<500"), "digital-page must not release on every 4xx");
assert.ok(digital.slice(digitalUnknown).includes("reconciliationRequired:true"), "ambiguous digital-page outcomes must require reconciliation");
assert.ok(digital.includes("return !error&&data===true"), "digital-page claim release must verify the RPC result");
assert.ok(digital.includes("PAYMENT_REJECTION_REQUIRES_RECONCILIATION"), "failed claim release must be surfaced as reconciliation-required");

function canRelease(status, identifiers = {}) {
  return definitiveStatuses.includes(status)
    && !identifiers.intentId
    && !identifiers.clientSecret
    && !identifiers.orderId;
}
for (const status of [400, 401, 403, 404, 422]) assert.equal(canRelease(status), true);
for (const status of [408, 409, 425, 429, 500, 502, 503]) assert.equal(canRelease(status), false);
for (const identifiers of [
  { intentId: "intent-1" },
  { clientSecret: "secret" },
  { orderId: "order-1" },
]) assert.equal(canRelease(400, identifiers), false);

console.log("Paymob ambiguous provider outcome contract: PASS");
