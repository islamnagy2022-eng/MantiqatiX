export const MAX_PROMOTIONAL_IMAGES = 10;

export type PromotionalImagesValidation = {
  valid: boolean;
  images: string[];
  error?: string;
};

const isPublicHttpsImageUrl = (value: string): boolean => {
  if (!value || value.length > 1500) return false;
  try {
    const url = new URL(value);
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

/** Parses one public HTTPS image URL per line, deduplicating and capping at ten. */
export function normalizePromotionalImageLines(value: string): PromotionalImagesValidation {
  const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_PROMOTIONAL_IMAGES) {
    return { valid: false, images: [], error: "الحد الأقصى 10 صور ترويجية." };
  }
  const images: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (!isPublicHttpsImageUrl(line)) {
      return { valid: false, images: [], error: "كل صورة تحتاج رابط HTTPS صالحًا، بدون منافذ مخصصة أو روابط داخلية." };
    }
    const normalized = new URL(line).toString();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      images.push(normalized);
    }
  }
  return { valid: true, images };
}