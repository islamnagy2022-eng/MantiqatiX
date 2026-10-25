export function normalizeBranchId(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value.length ? value : null;
}

export function matchesIdempotentIntent(intent, order, provider = "CASH_ON_DELIVERY") {
  if (!intent || !order) return false;
  const amount = Number(intent.amount);
  const expectedAmount = Number(order.total);
  return String(intent.order_id ?? "") === String(order.id ?? "") &&
    Number.isFinite(amount) && Number.isFinite(expectedAmount) &&
    Math.abs(amount - expectedAmount) <= 0.01 &&
    String(intent.currency ?? "").toUpperCase() === String(order.currency ?? "").toUpperCase() &&
    String(intent.provider ?? "") === provider &&
    String(intent.payment_method ?? "") === provider;
}
