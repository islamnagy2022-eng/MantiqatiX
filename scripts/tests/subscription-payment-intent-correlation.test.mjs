import assert from "node:assert/strict";
import fs from "node:fs";
import { isValidPaymobAmountCents, matchesPaymobIntention } from "../../supabase/functions/_shared/paymob-intent-correlation.mjs";

const source = fs.readFileSync("supabase/functions/subscription-payment-intent/index.ts", "utf8");

assert.ok(source.includes('from "../_shared/paymob-intent-correlation.mjs"'), "subscription payment must use the shared Paymob correlation guard");
assert.ok(source.includes("isValidPaymobAmountCents(Number(intent.amount), amountMinor)"), "subscription amount must be representable exactly in minor units");
assert.ok(source.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "provider correlation mismatch must fail closed");
assert.ok(source.includes("reconciliation_required: true"), "mismatched provider responses must require reconciliation");

const guardIndex = source.indexOf("if (!matchesPaymobIntention({");
const persistIndex = source.indexOf("const { data: updated, error: updateError }");
assert.ok(guardIndex >= 0, "subscription provider response must be correlated");
assert.ok(persistIndex > guardIndex, "provider correlation must be checked before persistence");
const guardBlock = source.slice(guardIndex, persistIndex);
assert.ok(guardBlock.includes("MANTIQATIX-SUB-${intent.id}"), "merchant reference must bind to the exact subscription intent");
assert.ok(guardBlock.includes("amountCents: amountMinor"), "merchant amount must be bound to server-calculated minor units");
assert.ok(guardBlock.includes("currency: String(intent.currency)"), "merchant currency must be bound to the authoritative intent currency");
assert.ok(guardBlock.includes("persistUnknownProviderCorrelation"), "mismatch must quarantine provider identifiers for reconciliation");
assert.ok(guardBlock.includes("PAYMENT_PROVIDER_INTENT_MISMATCH"), "mismatch must not return a checkout success");

const valid = {
  ledgerId: "MANTIQATIX-SUB-10000000-0000-4000-8000-000000000001",
  amountCents: 12550,
  currency: "EGP",
  provider: {
    special_reference: "MANTIQATIX-SUB-10000000-0000-4000-8000-000000000001",
    intention_detail: { amount: "12550", currency: "EGP" },
  },
};
assert.equal(isValidPaymobAmountCents(125.5, 12550), true, "exact subscription amount must pass");
assert.equal(matchesPaymobIntention(valid), true, "matching subscription provider response must pass");
for (const provider of [
  { ...valid.provider, intention_detail: { amount: "12549", currency: "EGP" } },
  { ...valid.provider, intention_detail: { amount: "12550", currency: "USD" } },
  { ...valid.provider, special_reference: "OTHER-SUBSCRIPTION" },
  { ...valid.provider, intention_detail: null },
]) {
  assert.equal(matchesPaymobIntention({ ...valid, provider }), false, "mismatched provider response must be rejected");
}
assert.equal(isValidPaymobAmountCents(125.505, 12551), false, "fractional-cent subscription price must be rejected");

console.log("Subscription Paymob intention correlation contract: PASS");
