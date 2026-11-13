export type PublicCatalogPriceAvailabilityMetadata = {
  show_price?: unknown;
  is_available?: unknown;
};

export type PublicCatalogPriceAvailabilityItem = {
  requiresQuote?: unknown;
  available?: unknown;
};

/**
 * Resolve public availability without requiring a numeric price for quote-only
 * catalogue entries. This applies equally to products and services.
 */
export function resolvePublicCatalogAvailability(
  metadata: PublicCatalogPriceAvailabilityMetadata,
  item: PublicCatalogPriceAvailabilityItem,
  price: unknown,
): { requiresQuote: boolean; available: boolean } {
  const requiresQuote = metadata.show_price === false || item.requiresQuote === true;
  const available = metadata.is_available !== false
    && item.available !== false
    && (requiresQuote || Boolean(price));
  return { requiresQuote, available };
}
