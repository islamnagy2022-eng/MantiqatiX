export type SmmOrderInput = { service_id?: unknown; target_url?: unknown; quantity?: unknown };

export type ValidatedSmmOrderInput =
  | { ok: true; serviceId: string; targetUrl: string; quantity: number }
  | { ok: false; code: "INVALID_ORDER" | "INVALID_TARGET_URL" };

export function validateSmmOrderInput(input: SmmOrderInput): ValidatedSmmOrderInput {
  const serviceId = typeof input.service_id === "string" ? input.service_id.trim() : "";
  const quantity = typeof input.quantity === "number" ? input.quantity : Number(input.quantity);
  if (!serviceId || serviceId.length > 128 || !Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, code: "INVALID_ORDER" };
  }
  const rawUrl = typeof input.target_url === "string" ? input.target_url.trim() : "";
  if (!rawUrl || rawUrl.length > 2048) return { ok: false, code: "INVALID_TARGET_URL" };
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, code: "INVALID_TARGET_URL" };
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || !hostname ||
      !hostname.includes(".") || hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") ||
      hostname.endsWith(".test") || hostname.endsWith(".invalid") ||
      hostname.endsWith(".example") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
      hostname.startsWith("[") || hostname.includes("..")) {
    return { ok: false, code: "INVALID_TARGET_URL" };
  }
  return { ok: true, serviceId, targetUrl: url.toString(), quantity };
}

export type SmmOrderPricing = { sellingPrice: number; providerCost: number; quantity: number };

export function validateSmmOrderPricing(input: SmmOrderPricing): { ok: true; charged: number; cost: number; profit: number } | { ok: false; code: "INVALID_SERVICE_PRICING" | "NON_POSITIVE_MARGIN" } {
  const { sellingPrice, providerCost, quantity } = input;
  if (!Number.isFinite(sellingPrice) || !Number.isFinite(providerCost) ||
      !Number.isSafeInteger(quantity) || quantity <= 0 ||
      sellingPrice <= 0 || providerCost < 0 || sellingPrice <= providerCost) {
    if (Number.isFinite(sellingPrice) && Number.isFinite(providerCost) &&
        Number.isSafeInteger(quantity) && quantity > 0 &&
        sellingPrice > 0 && providerCost >= 0 && sellingPrice <= providerCost) {
      return { ok: false, code: "NON_POSITIVE_MARGIN" };
    }
    return { ok: false, code: "INVALID_SERVICE_PRICING" };
  }
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const charged = roundMoney(sellingPrice * quantity / 1000);
  const cost = roundMoney(providerCost * quantity / 1000);
  const profit = roundMoney(charged - cost);
  if (![charged, cost, profit].every(Number.isFinite) || charged <= 0 || profit <= 0 || charged <= cost) {
    return { ok: false, code: "INVALID_SERVICE_PRICING" };
  }
  return { ok: true, charged, cost, profit };
}
