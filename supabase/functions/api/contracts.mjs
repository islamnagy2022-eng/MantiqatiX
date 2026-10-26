export function normalizeBranchId(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value.length ? value : null;
}

export function matchesIdempotentIntent(intent, order, provider = "CASH_ON_DELIVERY") {
  if (!intent || !order) return false;

  const orderId = String(intent.order_id ?? "").trim();
  const expectedOrderId = String(order.id ?? "").trim();
  const currency = String(intent.currency ?? "").trim().toUpperCase();
  const expectedCurrency = String(order.currency ?? "").trim().toUpperCase();
  const intentProvider = String(intent.provider ?? "").trim().toUpperCase();
  const expectedProvider = String(provider ?? "").trim().toUpperCase();
  const paymentMethod = String(intent.payment_method ?? "").trim().toUpperCase();

  // Do not let Number(null), Number(""), or missing identity fields collapse to
  // zero/empty values and accidentally qualify as a matching financial intent.
  if (intent.amount == null || order.total == null) return false;
  if (typeof intent.amount === "string" && !intent.amount.trim()) return false;
  if (typeof order.total === "string" && !order.total.trim()) return false;
  const amount = Number(intent.amount);
  const expectedAmount = Number(order.total);

  return orderId.length > 0 && orderId === expectedOrderId &&
    Number.isFinite(amount) && Number.isFinite(expectedAmount) &&
    Math.abs(amount - expectedAmount) <= 0.01 &&
    currency.length > 0 && currency === expectedCurrency &&
    intentProvider.length > 0 && intentProvider === expectedProvider &&
    paymentMethod.length > 0 && paymentMethod === expectedProvider;
}
