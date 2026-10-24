import assert from "node:assert/strict";
import { matchesPaymobAmountCents } from "../supabase/functions/_shared/paymob-intent-correlation.mjs";

assert.equal(matchesPaymobAmountCents(10.25, 1025), true, "exact cents should pass");
assert.equal(matchesPaymobAmountCents("10.25", 1025), true, "database numeric strings should pass");
assert.equal(matchesPaymobAmountCents(10.25, 1024), false, "one-cent short must fail");
assert.equal(matchesPaymobAmountCents(10.25, 1026), false, "one-cent over must fail");
assert.equal(matchesPaymobAmountCents(10.255, 1026), false, "fractional-cent expected amount must fail");
assert.equal(matchesPaymobAmountCents(0, 0), false, "zero amount must fail");
assert.equal(matchesPaymobAmountCents(-1, -100), false, "negative amount must fail");
assert.equal(matchesPaymobAmountCents(10.25, 1025.5), false, "fractional provider cents must fail");
assert.equal(matchesPaymobAmountCents(Number.NaN, 1025), false, "NaN expected amount must fail");
assert.equal(matchesPaymobAmountCents(10.25, Number.MAX_SAFE_INTEGER + 1), false, "unsafe integer cents must fail");

console.log("Paymob amount correlation tests PASS: exact cents and fail-closed invalid/mismatched amounts.");
