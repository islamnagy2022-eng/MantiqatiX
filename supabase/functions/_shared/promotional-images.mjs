export const MAX_PROMOTIONAL_IMAGES = 10;
const MAX_PROMOTIONAL_IMAGE_URL_LENGTH = 1500;

const isPublicHttpsImageUrl = (value) => {
  if (typeof value !== "string") return false;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_PROMOTIONAL_IMAGE_URL_LENGTH) return false;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const isIpLiteral = hostname.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    return url.protocol === "https:"
      && Boolean(hostname)
      && !url.username
      && !url.password
      && !url.port
      && !isIpLiteral
      && hostname !== "localhost"
      && !hostname.endsWith(".localhost")
      && !hostname.endsWith(".local");
  } catch {
    return false;
  }
};

/**
 * Validate the owner-provided public promotional image URL list.
 * Returns a fail-closed result; callers must not persist invalid lists.
 */
export const validatePromotionalImages = (value) => {
  if (!Array.isArray(value)) {
    return { valid: false, images: [], error: "PROMOTIONAL_IMAGES_MUST_BE_ARRAY" };
  }
  if (value.length > MAX_PROMOTIONAL_IMAGES) {
    return { valid: false, images: [], error: "PROMOTIONAL_IMAGES_LIMIT_EXCEEDED" };
  }
  const images = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string") {
      return { valid: false, images: [], error: "PROMOTIONAL_IMAGE_URL_INVALID" };
    }
    const candidate = entry.trim();
    if (!candidate) continue;
    if (!isPublicHttpsImageUrl(candidate)) {
      return { valid: false, images: [], error: "PROMOTIONAL_IMAGE_URL_INVALID" };
    }
    const normalized = new URL(candidate).toString();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      images.push(normalized);
    }
  }
  return { valid: true, images, error: null };
};

/** Public readers silently omit malformed stored values rather than returning them. */
export const sanitizePublicPromotionalImages = (value) => {
  const result = validatePromotionalImages(value);
  return result.valid ? result.images : [];
};