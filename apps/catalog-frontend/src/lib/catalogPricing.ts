export type PublicCatalogPriceAvailabilityMetadata = {
  show_price?: unknown;
  is_available?: unknown;
};

export type PublicCatalogPriceAvailabilityItem = {
  requiresQuote?: unknown;
  available?: unknown;
};

/**
 * Public prices are opt-in. Missing, false, or malformed permission must
 * never expose a numeric price; keep an otherwise available item quote-only.
 */
export function resolvePublicCatalogAvailability(
  metadata: PublicCatalogPriceAvailabilityMetadata,
  item: PublicCatalogPriceAvailabilityItem,
  price: unknown,
): { requiresQuote: boolean; available: boolean } {
  const requiresQuote = metadata.show_price !== true || item.requiresQuote === true;
  const available = metadata.is_available !== false
    && item.available !== false
    && (requiresQuote || Boolean(price));
  return { requiresQuote, available };
}
