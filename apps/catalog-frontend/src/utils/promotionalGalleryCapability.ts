export type CatalogReadCapabilityResponse = {
  business?: {
    profile?: Record<string, unknown>;
  };
};

/**
 * The RC928 gallery is writable only when the active catalog-admin Edge
 * bundle's read projection explicitly returns the gallery field. Older
 * bundles silently ignored promotionalImages during profile writes.
 */
export const hasPromotionalGalleryCapability = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const business = (value as CatalogReadCapabilityResponse).business;
  const profile = business?.profile;
  return Boolean(
    profile &&
    Object.prototype.hasOwnProperty.call(profile, "promotionalImages") &&
    Array.isArray(profile.promotionalImages),
  );
};

const normalizeImageList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
};

/** Compare normalized gallery state to avoid blocking ordinary profile saves. */
export const hasPromotionalGalleryChanges = (current: unknown, requested: unknown): boolean =>
  Array.isArray(requested) && JSON.stringify(normalizeImageList(current)) !== JSON.stringify(normalizeImageList(requested));
