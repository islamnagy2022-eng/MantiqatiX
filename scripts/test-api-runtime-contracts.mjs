import assert from "node:assert/strict";
import { normalizeBranchId, matchesIdempotentIntent } from "../supabase/functions/api/contracts.mjs";

assert.equal(normalizeBranchId(null), null);
assert.equal(normalizeBranchId(""), null);
assert.equal(normalizeBranchId("   "), null);
assert.equal(normalizeBranchId(" branch-a "), "branch-a");

const order = { id: "order-1", total: 125.5, currency: "EGP" };
const intent = {
  order_id: "order-1", amount: 125.5, currency: "egp",
  provider: "CASH_ON_DELIVERY", payment_method: "CASH_ON_DELIVERY"
};
assert.equal(matchesIdempotentIntent(intent, order), true);
assert.equal(matchesIdempotentIntent({ ...intent, order_id: "order-2" }, order), false);
assert.equal(matchesIdempotentIntent({ ...intent, amount: 126 }, order), false);
assert.equal(matchesIdempotentIntent({ ...intent, currency: "USD" }, order), false);
assert.equal(matchesIdempotentIntent({ ...intent, provider: "PAYMOB" }, order), false);
assert.equal(matchesIdempotentIntent({ ...intent, payment_method: "CARD" }, order), false);
assert.equal(matchesIdempotentIntent({ ...intent, amount: "NaN" }, order), false);
assert.equal(matchesIdempotentIntent(null, order), false);

console.log("API runtime identity contract tests: PASS");
