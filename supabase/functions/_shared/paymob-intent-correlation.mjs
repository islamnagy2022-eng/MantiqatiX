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
