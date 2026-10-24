import assert from "node:assert/strict";
import { isValidPaymobAmountCents, matchesPaymobIntention } from "../supabase/functions/_shared/paymob-intent-correlation.mjs";

assert.equal(isValidPaymobAmountCents(10.25, 1025), true, "exact currency cents should pass");
assert.equal(isValidPaymobAmountCents(10.255, 1026), false, "fractional-cent amount should fail");
assert.equal(isValidPaymobAmountCents(0, 0), false, "zero amount should fail");
assert.equal(isValidPaymobAmountCents(-1, -100), false, "negative amount should fail");
assert.equal(isValidPaymobAmountCents(10, 1.5), false, "non-integer cents should fail");

const valid = {
  id: "intention-123",
  intention_order_id: "order-456",
  amount: 1025,
  currency: "EGP",
  special_reference: "intent-789",
  client_secret: "opaque-checkout-secret",
};
const expected = { provider: valid, amountCents: 1025, currency: "egp", reference: "intent-789" };
assert.equal(matchesPaymobIntention(expected), true, "matching provider response should pass");
assert.equal(matchesPaymobIntention({ ...expected, amountCents: 1026 }), false, "amount mismatch should fail");
assert.equal(matchesPaymobIntention({ ...expected, currency: "USD" }), false, "currency mismatch should fail");
assert.equal(matchesPaymobIntention({ ...expected, reference: "other-intent" }), false, "reference mismatch should fail");
assert.equal(matchesPaymobIntention({ ...expected, provider: { ...valid, intention_order_id: "" } }), false, "missing provider order ID should fail");
assert.equal(matchesPaymobIntention({ ...expected, provider: { ...valid, client_secret: "" } }), false, "missing client secret should fail");
assert.equal(matchesPaymobIntention({ ...expected, provider: { ...valid, id: "" } }), false, "missing provider intention ID should fail");
assert.equal(matchesPaymobIntention({ ...expected, provider: { ...valid, currency: "USD" } }), false, "provider currency mismatch should fail");
assert.equal(matchesPaymobIntention({ ...expected, provider: { ...valid, special_reference: "different" } }), false, "provider reference mismatch should fail");
assert.equal(matchesPaymobIntention({ ...expected, provider: { ...valid, amount: 1 } }), false, "provider amount mismatch should fail");

console.log("Paymob intention correlation tests PASS: exact cents, amount/currency/reference binding, and required provider identifiers.");
