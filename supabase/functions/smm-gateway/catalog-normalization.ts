export type ExistingSmmService = { selling_price: unknown; active: unknown };

export function normalizeProviderService(
  raw: unknown,
  providerId: string,
  existing?: ExistingSmmService,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const service = raw as Record<string, unknown>;
  const externalId = String(service.service ?? service.id ?? "").trim().slice(0, 128);
  if (!externalId) return null;

  if (service.rate == null || (typeof service.rate === "string" && service.rate.trim() === "")) return null;
  const providerCost = Number(service.rate);
  const minQuantity = service.min == null ? 1 : Number(service.min);
  const maxQuantity = service.max == null ? 1_000_000 : Number(service.max);
  if (!Number.isFinite(providerCost) || providerCost < 0 ||
      !Number.isSafeInteger(minQuantity) || minQuantity < 1 ||
      !Number.isSafeInteger(maxQuantity) || maxQuantity < minQuantity ||
      maxQuantity > 1_000_000_000) return null;

  const existingPrice = existing == null ? NaN : Number(existing.selling_price);
  const hasValidExistingPrice = Number.isFinite(existingPrice) && existingPrice >= 0;
  const hasReviewedMargin = hasValidExistingPrice && Number.isFinite(providerCost) && existingPrice > providerCost;
  const keepExistingActivation = existing != null && typeof existing.active === "boolean" && hasReviewedMargin;
  const boundedText = (value: unknown, fallback: string, max: number) =>
    String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

  return {
    provider_id: providerId,
    external_service_id: externalId,
    platform: boundedText(service.platform ?? service.category, "Other", 80),
    category: boundedText(service.category, "Other", 120),
    name: boundedText(service.name, "Service", 200),
    description: boundedText(service.description, "", 1000),
    provider_cost: providerCost,
    // Never equate wholesale provider cost with the customer price. New services
    // remain zero-priced and inactive until an admin reviews pricing and activates them.
    selling_price: hasValidExistingPrice ? existingPrice : 0,
    min_quantity: minQuantity,
    max_quantity: maxQuantity,
    refill: service.refill === true,
    cancel: service.cancel === true,
    dripfeed: service.dripfeed === true,
    active: keepExistingActivation ? existing.active === true : false,
    // Persist only a small allowlisted summary; never store the arbitrary provider object.
    metadata: { provider_service_id: externalId, provider_rate: providerCost },
  };
}
