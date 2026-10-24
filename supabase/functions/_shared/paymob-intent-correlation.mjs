// Fail-closed correlation checks for Paymob intention creation responses.
const record = (value) =>
  value !== null && typeof value === "object" ? value : {};

export function isValidPaymobAmountCents(amount, amountCents) {
  return Number.isFinite(amount) && amount > 0 &&
    Number.isSafeInteger(amountCents) && amountCents > 0 &&
    Math.abs(amount * 100 - amountCents) < 0.000001;
}

export function matchesPaymobIntention(input) {
  const provider = record(input.provider);
  const detail = record(provider.intention_detail);
  const extras = record(provider.extras);
  const amount = Number(provider.amount ?? provider.amount_cents ?? detail.amount);
  const currency = String(provider.currency ?? detail.currency ?? "").toUpperCase();
  const reference = String(provider.special_reference ?? provider.merchant_order_id ??
    extras.special_reference ?? extras.mantiqatix_payment_intent_id ?? "");
  const providerId = String(provider.id ?? "");
  const orderId = String(provider.intention_order_id ?? provider.order_id ?? "");
  const clientSecret = String(provider.client_secret ?? "");
  return Number.isSafeInteger(input.amountCents) && input.amountCents > 0 &&
    Number.isFinite(amount) && amount === input.amountCents &&
    currency === String(input.currency).toUpperCase() &&
    reference === input.reference && providerId.length > 0 &&
    orderId.length > 0 && clientSecret.length > 0;
}

export function matchesPaymobAmountCents(expectedAmount, providerAmountCents) {
  const expected = Number(expectedAmount);
  const cents = Number(providerAmountCents);
  if (!Number.isFinite(expected) || expected <= 0 || !Number.isSafeInteger(cents) || cents <= 0) return false;
  const scaled = expected * 100;
  const rounded = Math.round(scaled);
  return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 0.000001 && rounded === cents;
}

export function matchesCurrencyAmounts(leftAmount, rightAmount) {
  const left = Number(leftAmount);
  const right = Number(rightAmount);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return false;
  const leftCents = Math.round(left * 100);
  const rightCents = Math.round(right * 100);
  return Number.isSafeInteger(leftCents) && Number.isSafeInteger(rightCents) &&
    Math.abs(left * 100 - leftCents) < 0.000001 &&
    Math.abs(right * 100 - rightCents) < 0.000001 &&
    leftCents === rightCents;
}

export function matchesPaymobEventOutcome(storedStatus, callbackSuccess) {
  return String(storedStatus ?? "").toUpperCase() === "FAILED" ? callbackSuccess === false :
    String(storedStatus ?? "").toUpperCase() !== "" && callbackSuccess === true;
}

export function matchesPaymobSubscriptionEventType(storedEventType, callbackSuccess) {
  const expected = callbackSuccess ? "SUBSCRIPTION_SUCCESS" : "SUBSCRIPTION_FAILURE";
  return String(storedEventType ?? "") === expected;
}
