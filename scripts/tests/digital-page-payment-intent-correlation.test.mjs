import assert from "node:assert/strict";
import fs from "node:fs";
import { isValidPaymobAmountCents, matchesPaymobIntention } from "../../supabase/functions/_shared/paymob-intent-correlation.mjs";

const source = fs.readFileSync("supabase/functions/digital-page-payment-intent/index.ts", "utf8");
assert.ok(source.includes('from "../_shared/paymob-intent-correlation.mjs"'), "digital-page payment must use the shared Paymob correlation guard");
assert.ok(source.includes("isValidPaymobAmountCents(amount,amountCents)"), "digital-page amount must be exactly representable in minor units");
assert.ok(source.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "mismatched provider response must fail closed");
assert.ok(source.includes("reconciliationRequired:true"), "mismatch must require reconciliation");

const requestIndex = source.indexOf('"/v1/intention/"');
const amountGuardIndex = source.indexOf("isValidPaymobAmountCents(amount,amountCents)");
const correlationIndex = source.indexOf("if(!matchesPaymobIntention(");
const finalizerIndex = source.indexOf('admin.rpc("finalize_digital_page_payment_intent_backend"');
assert.ok(requestIndex > 0 && amountGuardIndex >= 0 && amountGuardIndex < requestIndex, "amount precision must be checked before Paymob network I/O");
assert.ok(correlationIndex >= 0 && finalizerIndex > correlationIndex, "provider response must be correlated before finalization");
const mismatchBlock = source.slice(correlationIndex, finalizerIndex);
assert.ok(mismatchBlock.includes("ledgerId:String(row.id)"), "provider reference must bind to the exact digital page order");
assert.ok(mismatchBlock.includes("amountCents,currency,provider:p"), "provider response must match server-calculated amount and currency");
assert.ok(mismatchBlock.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "mismatch must return the fail-closed response");
assert.ok(!mismatchBlock.includes("clientSecret"), "mismatch must not return checkout credentials");
assert.ok(!mismatchBlock.includes("await release()"), "mismatch must retain the claim for reconciliation");

const valid = {
  ledgerId: "DIGITAL-ORDER-001",
  amountCents: 9900,
  currency: "EGP",
  provider: {
    special_reference: "DIGITAL-ORDER-001",
    intention_detail: { amount: "9900", currency: "EGP" },
  },
};
assert.equal(isValidPaymobAmountCents(99, 9900), true);
assert.equal(matchesPaymobIntention(valid), true);
for (const provider of [
  { ...valid.provider, intention_detail: { amount: "9800", currency: "EGP" } },
  { ...valid.provider, intention_detail: { amount: "9900", currency: "USD" } },
  { ...valid.provider, special_reference: "OTHER-ORDER" },
  { ...valid.provider, intention_detail: null },
]) {
  assert.equal(matchesPaymobIntention({ ...valid, provider }), false, "mismatched provider echo must be rejected");
}
assert.equal(isValidPaymobAmountCents(99.005, 9901), false);
console.log("Digital-page Paymob intention correlation contract: PASS");
