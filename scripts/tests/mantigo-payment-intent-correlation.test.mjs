import test from "node:test";
import assert from "node:assert/strict";
import { matchesPaymobIntention } from "../../supabase/functions/_shared/paymob-intent-correlation.mjs";

const expected = {
  ledgerId: "MGO-FIN-526-001",
  amount: 125.5,
  currency: "EGP",
  provider: {
    special_reference: "MGO-FIN-526-001",
    intention_detail: { amount: "125.50", currency: "EGP" },
  },
};

test("accepts an exact amount, currency, and ledger-reference match", () => {
  assert.equal(matchesPaymobIntention(expected), true);
});

test("normalizes currency case and surrounding whitespace only", () => {
  assert.equal(matchesPaymobIntention({
    ...expected,
    currency: " egp ",
    provider: { ...expected.provider, intention_detail: { amount: 125.5, currency: "EGP" } },
  }), true);
});

test("rejects an amount mismatch", () => {
  assert.equal(matchesPaymobIntention({
    ...expected,
    provider: { ...expected.provider, intention_detail: { amount: 125.49, currency: "EGP" } },
  }), false);
});

test("rejects missing, non-numeric, and non-finite provider amounts", () => {
  for (const amount of [undefined, null, "", "not-a-number", "Infinity", Infinity, NaN]) {
    assert.equal(matchesPaymobIntention({
      ...expected,
      provider: { ...expected.provider, intention_detail: { amount, currency: "EGP" } },
    }), false, `amount should be rejected: ${String(amount)}`);
  }
});

test("rejects currency mismatch or missing currency", () => {
  for (const currency of ["USD", "", undefined, null]) {
    assert.equal(matchesPaymobIntention({
      ...expected,
      provider: { ...expected.provider, intention_detail: { amount: 125.5, currency } },
    }), false, `currency should be rejected: ${String(currency)}`);
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

test("rejects missing ledger reference and non-positive expected amounts", () => {
  assert.equal(matchesPaymobIntention({ ...expected, ledgerId: "" }), false);
  assert.equal(matchesPaymobIntention({ ...expected, amount: 0 }), false);
  assert.equal(matchesPaymobIntention({ ...expected, amount: -1 }), false);
});
