import test from "node:test";
import assert from "node:assert/strict";
import { isValidPaymobAmountCents, matchesPaymobIntention } from "../../supabase/functions/_shared/paymob-intent-correlation.mjs";

// Paymob intention API amounts are expressed in the currency's smallest unit.
const expected = {
  ledgerId: "MGO-FIN-526-001",
  amountCents: 12550,
  currency: "EGP",
  provider: {
    special_reference: "MGO-FIN-526-001",
    intention_detail: { amount: "12550", currency: "EGP" },
  },
};

test("accepts an exact minor-unit amount, currency, and ledger-reference match", () => {
  assert.equal(matchesPaymobIntention(expected), true);
});

test("normalizes currency case and surrounding whitespace only", () => {
  assert.equal(matchesPaymobIntention({
    ...expected,
    currency: " egp ",
    provider: { ...expected.provider, intention_detail: { amount: 12550, currency: "EGP" } },
  }), true);
});

test("rejects minor-unit amount mismatch, including a major-unit amount", () => {
  for (const amount of [12549, 12551, 125.5, "125.50"]) {
    assert.equal(matchesPaymobIntention({
      ...expected,
      provider: { ...expected.provider, intention_detail: { amount, currency: "EGP" } },
    }), false);
  }
});

test("rejects missing, non-numeric, non-finite, or non-integer provider amounts", () => {
  for (const amount of [undefined, null, "", "not-a-number", "Infinity", Infinity, NaN, 12550.5]) {
    assert.equal(matchesPaymobIntention({
      ...expected,
      provider: { ...expected.provider, intention_detail: { amount, currency: "EGP" } },
    }), false);
  }
});

test("rejects currency mismatch or missing currency", () => {
  for (const currency of ["USD", "", undefined, null]) {
    assert.equal(matchesPaymobIntention({
      ...expected,
      provider: { ...expected.provider, intention_detail: { amount: 12550, currency } },
    }), false);
  }
});

test("rejects a different ledger special_reference", () => {
  assert.equal(matchesPaymobIntention({
    ...expected,
    provider: { ...expected.provider, special_reference: "OTHER-LEDGER" },
  }), false);
});

test("rejects missing or malformed intention_detail", () => {
  for (const provider of [
    { special_reference: expected.ledgerId },
    { special_reference: expected.ledgerId, intention_detail: null },
    { special_reference: expected.ledgerId, intention_detail: [] },
    null,
    [],
  ]) {
    assert.equal(matchesPaymobIntention({ ...expected, provider }), false);
  }
});

test("rejects missing ledger reference and invalid expected minor-unit amounts", () => {
  assert.equal(matchesPaymobIntention({ ...expected, ledgerId: "" }), false);
  for (const amountCents of [0, -1, 12550.5, "not-a-number"]) {
    assert.equal(matchesPaymobIntention({ ...expected, amountCents }), false);
  }
});

test("accepts only positive, safe, exact major-to-minor-unit conversions", () => {
  assert.equal(isValidPaymobAmountCents(125.5, 12550), true);
  assert.equal(isValidPaymobAmountCents(0.01, 1), true);
  assert.equal(isValidPaymobAmountCents(125.505, 12551), false);
  assert.equal(isValidPaymobAmountCents(1e308, Infinity), false);
  assert.equal(isValidPaymobAmountCents(Number.MAX_VALUE, Number.MAX_SAFE_INTEGER + 1), false);
  assert.equal(isValidPaymobAmountCents(0, 0), false);
  assert.equal(isValidPaymobAmountCents(-1, -100), false);
  assert.equal(isValidPaymobAmountCents(NaN, 1), false);
});
