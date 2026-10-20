import assert from "node:assert/strict";
import fs from "node:fs";
import { isValidPaymobAmountCents, matchesPaymobIntention } from "../../supabase/functions/_shared/paymob-intent-correlation.mjs";

const source = fs.readFileSync("supabase/functions/payment-intent/index.ts", "utf8");
assert.ok(source.includes('from "../_shared/paymob-intent-correlation.mjs"'), "normal payment must use the shared Paymob correlation guard");
assert.ok(source.includes("isValidPaymobAmountCents(amount, amountCents)"), "amount must be exactly representable in provider minor units");
assert.ok(source.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "mismatched provider response must fail closed");
assert.ok(source.includes("reconciliationRequired: true"), "mismatched provider response must require reconciliation");

const providerRequestIndex = source.indexOf('fetch("https://accept.paymob.com/v1/intention/"');
const amountGuardIndex = source.indexOf("isValidPaymobAmountCents(amount, amountCents)");
const correlationIndex = source.indexOf("const providerCorrelationMatches = matchesPaymobIntention({");
const persistIndex = source.indexOf('admin.from("payment_intents").update({');
const mismatchIndex = source.indexOf("if (!providerCorrelationMatches)");
const successIndex = source.indexOf("clientSecret: String(provider.client_secret)");
assert.ok(providerRequestIndex > 0 && amountGuardIndex >= 0 && amountGuardIndex < providerRequestIndex, "exact amount guard must run before provider network I/O");
assert.ok(correlationIndex >= 0 && persistIndex > correlationIndex, "provider response must be correlated before binding provider identifiers");
assert.ok(mismatchIndex > persistIndex && successIndex > mismatchIndex, "mismatch quarantine must happen before any successful checkout response");
const mismatchBlock = source.slice(mismatchIndex, successIndex);
assert.ok(mismatchBlock.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "mismatch must return the stable fail-closed error");
assert.ok(mismatchBlock.includes("reconciliationRequired: true"), "mismatch must require reconciliation");
assert.ok(!mismatchBlock.includes("clientSecret"), "mismatch must never return checkout credentials");

const valid = {
  ledgerId: "PAY-INTENT-001",
  amountCents: 25000,
  currency: "EGP",
  provider: {
    special_reference: "PAY-INTENT-001",
    intention_detail: { amount: "25000", currency: "EGP" },
  },
};
assert.equal(isValidPaymobAmountCents(250, 25000), true);
assert.equal(matchesPaymobIntention(valid), true);
for (const provider of [
  { ...valid.provider, intention_detail: { amount: "24999", currency: "EGP" } },
  { ...valid.provider, intention_detail: { amount: "25000", currency: "USD" } },
  { ...valid.provider, special_reference: "OTHER-INTENT" },
  { ...valid.provider, intention_detail: null },
]) {
  assert.equal(matchesPaymobIntention({ ...valid, provider }), false, "mismatched provider echo must be rejected");
}
assert.equal(isValidPaymobAmountCents(250.005, 25001), false);
console.log("Normal payment Paymob intention correlation contract: PASS");
